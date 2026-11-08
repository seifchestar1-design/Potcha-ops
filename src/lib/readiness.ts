// Potcha Ops — Event readiness scoring
// ------------------------------------------------------------------
// Transparent, weighted model (total = 100 pts). The exact score and the
// per-criterion breakdown are shown to users in the UI, together with
// the list of missing requirements and recommended next actions.
//
//  1. Vendors confirmed ........ 25 pts  (share of engaged vendors whose
//                                          confirmation status is at least
//                                          CONFIRMED; 0 if none engaged)
//  2. Critical tasks completed . 20 pts  (share of HIGH/CRITICAL tasks done;
//                                          full marks if none exist)
//  3. Run sheet prepared ....... 15 pts  (min(items/6, 1), scaled by share
//                                          of items with an owner)
//  4. Venue confirmed .......... 15 pts  (a VENUE-category vendor confirmed,
//                                          or event status >= CONFIRMED
//                                          with a venue recorded)
//  5. Documents available ...... 10 pts  (min(documents/2, 1))
//  6. Critical issues clear .... 15 pts  (no open HIGH/CRITICAL issues)

import { READINESS_WEIGHTS } from '@/lib/constants';

export type ReadinessCriterion = {
  key: string;
  label: string;
  weight: number;
  score: number; // 0..1
  detail: string;
  met: boolean;
};

export type ReadinessResult = {
  score: number; // 0..100
  band: 'on_track' | 'attention' | 'at_risk';
  criteria: ReadinessCriterion[];
  missing: string[];
  criticalBlockers: string[];
  recommendedActions: string[];
};

type ReadinessInput = {
  eventVendors: { category: string; confirmationStatus: string }[];
  tasks: { priority: string; status: string }[];
  runSheet: { responsibleId: string | null; responsibleName: string | null }[];
  documents: number;
  issues: { priority: string; status: string }[];
  eventStatus: string;
  hasVenue: boolean;
};

const CONFIRMED_VENDOR_STATUSES = ['CONFIRMED', 'DEPOSIT_REQUIRED', 'PAID', 'COMPLETED'];

export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const criteria: ReadinessCriterion[] = [];

  // 1 — vendors confirmed
  {
    const total = input.eventVendors.length;
    const confirmed = input.eventVendors.filter((v) =>
      CONFIRMED_VENDOR_STATUSES.includes(v.confirmationStatus)
    ).length;
    const score = total === 0 ? 0 : confirmed / total;
    criteria.push({
      key: 'vendorsConfirmed',
      label: 'Required vendors confirmed',
      weight: READINESS_WEIGHTS.vendorsConfirmed,
      score,
      detail:
        total === 0
          ? 'No vendors engaged yet'
          : `${confirmed} of ${total} vendors confirmed or beyond`,
      met: total > 0 && confirmed === total,
    });
  }

  // 2 — critical tasks completed
  {
    const critical = input.tasks.filter((t) => t.priority === 'HIGH' || t.priority === 'CRITICAL');
    const done = critical.filter((t) => t.status === 'COMPLETED').length;
    const score = critical.length === 0 ? 1 : done / critical.length;
    criteria.push({
      key: 'criticalTasks',
      label: 'Critical tasks completed',
      weight: READINESS_WEIGHTS.criticalTasks,
      score,
      detail:
        critical.length === 0
          ? 'No critical-priority tasks open'
          : `${done} of ${critical.length} high/critical tasks completed`,
      met: done === critical.length,
    });
  }

  // 3 — run sheet prepared
  {
    const items = input.runSheet.length;
    const withOwner = input.runSheet.filter((r) => r.responsibleId || r.responsibleName).length;
    const coverage = items === 0 ? 0 : Math.min(items / 6, 1);
    const ownerShare = items === 0 ? 0 : withOwner / items;
    const score = round(coverage * (0.6 + 0.4 * ownerShare));
    criteria.push({
      key: 'runSheet',
      label: 'Run sheet prepared',
      weight: READINESS_WEIGHTS.runSheet,
      score,
      detail:
        items === 0
          ? 'Run sheet is empty'
          : `${items} timeline items${withOwner < items ? `, ${items - withOwner} missing an owner` : ', all owned'}`,
      met: items >= 6 && withOwner === items,
    });
  }

  // 4 — venue confirmed
  {
    const venueVendorConfirmed = input.eventVendors.some(
      (v) => v.category === 'VENUE' && CONFIRMED_VENDOR_STATUSES.includes(v.confirmationStatus)
    );
    const statusConfirmed = ['CONFIRMED', 'IN_PREPARATION', 'READY', 'COMPLETED'].includes(
      input.eventStatus
    );
    const score = venueVendorConfirmed || (statusConfirmed && input.hasVenue) ? 1 : 0;
    criteria.push({
      key: 'venueConfirmed',
      label: 'Venue confirmed',
      weight: READINESS_WEIGHTS.venueConfirmed,
      score,
      detail: venueVendorConfirmed
        ? 'Venue vendor confirmed'
        : score === 1
          ? 'Event confirmed with venue recorded'
          : 'Venue not confirmed yet',
      met: score === 1,
    });
  }

  // 5 — documents available
  {
    const score = Math.min(input.documents / 2, 1);
    criteria.push({
      key: 'documents',
      label: 'Required documents available',
      weight: READINESS_WEIGHTS.documents,
      score,
      detail: `${input.documents} document${input.documents === 1 ? '' : 's'} uploaded`,
      met: input.documents >= 2,
    });
  }

  // 6 — critical issues resolved
  {
    const openCritical = input.issues.filter(
      (i) => (i.priority === 'HIGH' || i.priority === 'CRITICAL') && i.status !== 'RESOLVED'
    );
    const score = openCritical.length === 0 ? 1 : 0;
    criteria.push({
      key: 'criticalIssues',
      label: 'Critical issues resolved',
      weight: READINESS_WEIGHTS.criticalIssues,
      score,
      detail:
        openCritical.length === 0
          ? 'No open high/critical issues'
          : `${openCritical.length} open high/critical issue${openCritical.length === 1 ? '' : 's'}`,
      met: openCritical.length === 0,
    });
  }

  const total = criteria.reduce((s, c) => s + c.weight * c.score, 0);
  const score = Math.round(total);

  const missing = criteria.filter((c) => !c.met).map((c) => `${c.label}: ${c.detail}`);
  const criticalBlockers = criteria
    .filter((c) => !c.met && c.score === 0 && (c.key === 'criticalIssues' || c.key === 'venueConfirmed'))
    .map((c) => c.label);

  const recommendedActions: string[] = [];
  const byKey = Object.fromEntries(criteria.map((c) => [c.key, c]));
  if (!byKey.vendorsConfirmed.met)
    recommendedActions.push('Follow up with unconfirmed vendors and lock their status.');
  if (!byKey.criticalTasks.met)
    recommendedActions.push('Close out remaining high/critical tasks before the event date.');
  if (!byKey.runSheet.met)
    recommendedActions.push('Complete the wedding-day run sheet and assign an owner to every item.');
  if (!byKey.venueConfirmed.met)
    recommendedActions.push('Confirm the venue in writing and record it on the event.');
  if (!byKey.documents.met)
    recommendedActions.push('Upload the signed contract and floor plan to event documents.');
  if (!byKey.criticalIssues.met)
    recommendedActions.push('Resolve open critical issues or escalate them to the CEO.');

  return {
    score,
    band: score >= 85 ? 'on_track' : score >= 70 ? 'attention' : 'at_risk',
    criteria,
    missing,
    criticalBlockers,
    recommendedActions,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
