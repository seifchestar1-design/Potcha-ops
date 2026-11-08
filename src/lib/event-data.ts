// Potcha Ops — event aggregation helpers (readiness + financial rollups)
import { db } from '@/lib/db';
import { computeReadiness, type ReadinessResult } from '@/lib/readiness';
import { eventFinancials, isOverdue } from '@/lib/finance';
import type { AuthUser } from '@/lib/auth';

type EventLike = {
  id: string;
  status: string;
  venue: string | null;
  contractValue: number;
  additionalRevenue: number;
  currency: string;
};

/** Prisma `where` for events the user may see (tenant + role scoped). */
export function visibleEventsWhere(auth: AuthUser) {
  const base = { companyId: auth.companyId };
  if (auth.role === 'OPERATIONS' && !auth.perms.has('events.view.all')) {
    return {
      ...base,
      OR: [{ plannerId: auth.id }, { assignments: { some: { userId: auth.id } } }],
    };
  }
  return base;
}

/** Readiness scores for many events in batched queries. */
export async function computeReadinessForEvents(
  events: { id: string; status: string; venue: string | null }[]
): Promise<Map<string, ReadinessResult>> {
  const ids = events.map((e) => e.id);
  const map = new Map<string, ReadinessResult>();
  if (ids.length === 0) return map;

  const [eventVendors, tasks, runItems, docCounts, issues] = await Promise.all([
    db.eventVendor.findMany({
      where: { eventId: { in: ids } },
      select: { eventId: true, category: true, confirmationStatus: true },
    }),
    db.task.findMany({
      where: { eventId: { in: ids } },
      select: { eventId: true, priority: true, status: true },
    }),
    db.runSheetItem.findMany({
      where: { eventId: { in: ids } },
      select: { eventId: true, responsibleId: true, responsibleName: true },
    }),
    db.document.groupBy({ by: ['eventId'], where: { eventId: { in: ids } }, _count: { _all: true } }),
    db.issue.findMany({
      where: { eventId: { in: ids } },
      select: { eventId: true, priority: true, status: true },
    }),
  ]);

  for (const e of events) {
    const result = computeReadiness({
      eventVendors: eventVendors.filter((v) => v.eventId === e.id),
      tasks: tasks.filter((t) => t.eventId === e.id),
      runSheet: runItems.filter((r) => r.eventId === e.id),
      documents: docCounts.find((d) => d.eventId === e.id)?._count._all ?? 0,
      issues: issues.filter((i) => i.eventId === e.id),
      eventStatus: e.status,
      hasVenue: Boolean(e.venue),
    });
    map.set(e.id, result);
  }
  return map;
}

/** Full financial rollup per event (only called for finance-permitted users). */
export async function computeFinancialsForEvents(
  events: EventLike[]
): Promise<Map<string, ReturnType<typeof eventFinancials> & { overduePayments: number }>> {
  const ids = events.map((e) => e.id);
  const map = new Map();
  if (ids.length === 0) return map;

  const [payments, vendors] = await Promise.all([
    db.payment.findMany({ where: { eventId: { in: ids } } }),
    db.eventVendor.findMany({
      where: { eventId: { in: ids } },
      select: { eventId: true, contractAmount: true },
    }),
  ]);

  for (const e of events) {
    const evPayments = payments.filter((p) => p.eventId === e.id);
    const evVendors = vendors.filter((v) => v.eventId === e.id);
    const fin = eventFinancials(
      e,
      evPayments,
      evVendors.map((v) => ({ contractAmount: v.contractAmount }))
    );
    const overdue = evPayments.filter((p) => isOverdue(p)).length;
    map.set(e.id, { ...fin, overduePayments: overdue });
  }
  return map;
}
