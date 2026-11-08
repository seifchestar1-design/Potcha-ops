'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Users, MapPin, Phone, Mail, StickyNote, Gauge, ListChecks, CheckCircle2,
  ArrowRight, Lightbulb, ShieldAlert,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/client/api';
import type { EventRow } from '@/lib/client/types';
import { fmtDate, fmtDateTime, formatMoney, eventTypeLabel, vendorCategoryLabel, countdownLabel } from '@/lib/client/format';
import { useAppStore } from '@/components/app/store';
import { navigate } from '@/components/app/router';
import { StatusBadge } from '@/components/app/ui/status-badge';
import { ReadinessRing } from '@/components/app/ui/readiness-ring';
import { useDashboard } from '@/components/app/dashboard/shared';

export function OverviewTab({ eventId }: { eventId: string }) {
  const user = useAppStore((s) => s.user);
  const { data, isLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api<{ event: EventRow }>(`/events/${eventId}`),
  });
  const { data: dash } = useDashboard();

  if (isLoading || !data?.event) {
    return <div className="space-y-3"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>;
  }

  const e = data.event;
  const canFin = user?.perms.includes('finance.view') ?? false;
  const cur = user?.currency ?? 'EGP';
  const readiness = e.readiness;
  const dashEvent = dash?.events.find((x) => x.id === eventId);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {/* Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Event details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Detail icon={Users} label="Client" value={e.clientName} />
            <Detail icon={Phone} label="Client phone" value={e.clientPhone} />
            <Detail icon={Mail} label="Client email" value={e.clientEmail} />
            <Detail icon={MapPin} label="Venue" value={e.venue ? `${e.venue}${e.venueAddress ? ` — ${e.venueAddress}` : ''}` : null} />
            <Detail label="Event date" value={`${fmtDate(e.eventDate)} (${fmtDateTime(e.eventDate, 'HH:mm')})`} />
            <Detail label="Event type" value={eventTypeLabel(e.eventType)} />
            <Detail label="Guest count" value={e.guestCount ? `${e.guestCount} guests` : '—'} />
            <Detail label="Planner" value={e.plannerName} />
            {canFin && <Detail label="Contract value" value={formatMoney(e.contractValue ?? 0, cur)} />}
            {canFin && <Detail label="Additional services" value={formatMoney(e.additionalRevenue ?? 0, cur)} />}
            <div className="sm:col-span-2">
              <Detail icon={StickyNote} label="Important notes" value={e.notes} />
            </div>
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Assigned team</p>
              <div className="flex flex-wrap gap-1.5">
                {(e.team ?? []).map((t) => (
                  <span key={t.userId} className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1 text-xs">
                    {t.name}
                    {t.roleNote && <span className="text-[10px] text-muted-foreground">· {t.roleNote}</span>}
                  </span>
                ))}
                {(e.team ?? []).length === 0 && <span className="text-xs text-muted-foreground">No team assigned yet</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Readiness breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Gauge className="h-4 w-4 text-primary" aria-hidden /> Readiness score — transparent model
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!readiness ? (
              <p className="text-sm text-muted-foreground">Readiness is computed once the event has activity.</p>
            ) : (
              <>
                <div className="mb-4 flex items-center gap-4">
                  <ReadinessRing readiness={readiness} size={72} />
                  <div>
                    <p className="text-sm font-semibold">
                      {readiness.score}% —{' '}
                      {readiness.band === 'on_track' ? 'On track' : readiness.band === 'attention' ? 'Needs attention' : 'At risk'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Weighted: vendors 25 · critical tasks 20 · run sheet 15 · venue 15 · documents 10 · issues 15
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  {readiness.criteria.map((c) => (
                    <div key={c.key}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-1.5 font-medium">
                          {c.met ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                          ) : (
                            <ShieldAlert className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                          )}
                          {c.label}
                          <span className="text-[10px] text-muted-foreground">({c.weight} pts)</span>
                        </span>
                        <span className="tabular text-muted-foreground">{Math.round(c.score * c.weight)}/{c.weight}</span>
                      </div>
                      <Progress value={c.score * 100} className="h-1.5" />
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{c.detail}</p>
                    </div>
                  ))}
                </div>

                {(readiness.recommendedActions?.length ?? 0) > 0 && (
                  <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold">
                      <Lightbulb className="h-3.5 w-3.5 text-amber-600" aria-hidden /> Recommended next actions
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {readiness.recommendedActions.map((a) => (
                        <li key={a} className="text-xs text-muted-foreground">• {a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {/* Quick stats */}
        {canFin && e.financials && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Financial snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <FinRow label="Total revenue" value={formatMoney(e.financials.totalRevenue, cur)} />
              <FinRow label="Collected" value={formatMoney(e.financials.collectedFromClient, cur)} tone="positive" />
              <FinRow label="Outstanding" value={formatMoney(e.financials.outstandingClientBalance, cur)} tone="warning" />
              <FinRow label="Planned expenses" value={formatMoney(e.financials.plannedExpenses, cur)} />
              <FinRow label="Actual expenses" value={formatMoney(e.financials.actualExpenses, cur)} />
              <FinRow label="Est. profit" value={formatMoney(e.financials.grossEstimatedProfit, cur)} tone="positive" />
              <FinRow label="Margin" value={`${e.financials.profitMargin.toFixed(1)}%`} />
              <button
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                onClick={() => navigate(`/events/${eventId}/budget`)}
              >
                Open full budget <ArrowRight className="h-3 w-3" aria-hidden />
              </button>
            </CardContent>
          </Card>
        )}

        {/* Vendor summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Vendor categories engaged</CardTitle>
          </CardHeader>
          <CardContent>
            <VendorCategorySummary eventId={eventId} />
          </CardContent>
        </Card>

        {/* Countdown card */}
        <Card className="bg-primary/5">
          <CardContent className="flex items-center gap-3 p-4">
            <ListChecks className="h-8 w-8 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-semibold">
                {dashEvent ? countdownLabel(e.eventDate) : fmtDate(e.eventDate)}
              </p>
              <p className="text-xs text-muted-foreground">
                {e.guestCount} guests · {e.venue ?? 'venue TBD'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon?: typeof Users; label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-start gap-2.5">
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm">{value || '—'}</p>
      </div>
    </div>
  );
}

function FinRow({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'warning' }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium tabular ${tone === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'warning' ? 'text-amber-600 dark:text-amber-400' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function VendorCategorySummary({ eventId }: { eventId: string }) {
  const { data } = useQuery({
    queryKey: ['event-vendors', eventId],
    queryFn: () => api<{ vendors: { category: string; confirmationStatus: string }[] }>(`/events/${eventId}/vendors`),
  });
  const vendors = data?.vendors ?? [];
  const byCat = new Map<string, { total: number; confirmed: number }>();
  for (const v of vendors) {
    const entry = byCat.get(v.category) ?? { total: 0, confirmed: 0 };
    entry.total += 1;
    if (['CONFIRMED', 'DEPOSIT_REQUIRED', 'PAID', 'COMPLETED'].includes(v.confirmationStatus)) entry.confirmed += 1;
    byCat.set(v.category, entry);
  }
  if (vendors.length === 0) {
    return <p className="text-sm text-muted-foreground">No vendors engaged yet.</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {[...byCat.entries()].map(([cat, counts]) => (
        <span
          key={cat}
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
          style={{
            borderColor: counts.confirmed === counts.total ? 'rgba(16,185,129,.35)' : 'rgba(245,158,11,.35)',
            background: counts.confirmed === counts.total ? 'rgba(16,185,129,.08)' : 'rgba(245,158,11,.08)',
          }}
        >
          {vendorCategoryLabel(cat)}
          <span className="text-[10px] text-muted-foreground">{counts.confirmed}/{counts.total}</span>
        </span>
      ))}
    </div>
  );
}
