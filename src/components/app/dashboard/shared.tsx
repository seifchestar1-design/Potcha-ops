'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Bell, History, Inbox } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/client/api';
import type { DashboardData } from '@/lib/client/types';
import { fmtDate, fmtMoney, countdownLabel, fmtRelative } from '@/lib/client/format';
import { StatusBadge } from '@/components/app/ui/status-badge';
import { ReadinessRing } from '@/components/app/ui/readiness-ring';
import { EmptyState } from '@/components/app/ui/empty-state';

export function useDashboard() {
  const user = { currency: 'EGP' };
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardData>('/dashboard'),
    staleTime: 30_000,
  });
}

export function UpcomingEventsCard({ data, loading }: { data?: DashboardData; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-4 w-40" /></CardHeader>
        <CardContent className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </CardContent>
      </Card>
    );
  }
  const events = data?.events ?? [];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Events at a glance</CardTitle>
      </CardHeader>
      <CardContent className="max-h-96 space-y-2 overflow-y-auto scroll-slim">
        {events.length === 0 && (
          <EmptyState icon={Inbox} title="No events yet" description="Create your first event to see it here." className="border-0 py-6" />
        )}
        {events.map((e) => {
          const atRisk = data?.alerts?.atRiskEventIds?.includes(e.id);
          return (
            <a
              key={e.id}
              href={`#/events/${e.id}/overview`}
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
              <ReadinessRing readiness={e.readiness} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{e.name}</p>
                  {atRisk && (
                    <Badge variant="destructive" className="h-5 shrink-0 px-1.5 text-[10px]">At risk</Badge>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {fmtDate(e.eventDate)} · {e.venue ?? 'Venue TBD'} · {countdownLabel(e.eventDate)}
                </p>
              </div>
              <StatusBadge kind="event" value={e.status} className="shrink-0" />
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
            </a>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function AlertsCard({ data, loading }: { data?: DashboardData; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-4 w-32" /></CardHeader>
        <CardContent className="space-y-3">
          {[0, 1].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </CardContent>
      </Card>
    );
  }
  const a = data?.alerts;
  // Each row carries a tap target — the event workspace tab where the
  // alert can be handled (tasks → tasks tab, issues → issues tab, …).
  const items: { label: string; rows: { text: string; meta: string; to?: string }[] }[] = [];

  // CEO payload exposes openCriticalIssues; the Operations payload exposes
  // criticalIssues — same shape, so merge to avoid double sections.
  const critIssues = a?.openCriticalIssues?.length ? a.openCriticalIssues : a?.criticalIssues ?? [];
  if (critIssues.length) {
    items.push({
      label: 'Critical issues',
      rows: critIssues.map((i) => ({
        text: i.title,
        meta: fmtRelative(i.createdAt),
        to: i.eventId ? `/events/${i.eventId}/issues` : undefined,
      })),
    });
  }
  if (a?.overdueTasks?.length) {
    items.push({
      label: 'Overdue tasks',
      rows: a.overdueTasks.map((t) => ({
        text: t.title,
        meta: fmtDate(t.dueDate),
        to: (t.eventId ?? t.id) ? `/events/${t.eventId ?? t.id}/tasks` : undefined,
      })),
    });
  }
  if (a?.tasksDueToday?.length) {
    items.push({
      label: 'Due today',
      rows: a.tasksDueToday.map((t) => ({
        text: t.title,
        meta: 'Today',
        to: (t.eventId ?? t.id) ? `/events/${t.eventId ?? t.id}/tasks` : undefined,
      })),
    });
  }
  if (a?.overduePayments?.length) {
    items.push({
      label: 'Overdue payments',
      rows: a.overduePayments.map((p) => ({
        text: `${fmtMoney(p.amount, data?.currency)} — ${p.note ?? 'Payment'}`,
        meta: `due ${fmtDate(p.dueDate)}`,
        to: p.eventId ? `/events/${p.eventId}/budget` : undefined,
      })),
    });
  }
  if (a?.paymentDeadlines?.length) {
    items.push({
      label: 'Payment deadlines (14d)',
      rows: a.paymentDeadlines.map((p) => ({
        text: `${fmtMoney(p.amount, data?.currency)} — ${p.note ?? 'Payment'}`,
        meta: `due ${fmtDate(p.dueDate)}`,
        to: p.eventId ? `/events/${p.eventId}/budget` : undefined,
      })),
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden /> Needs attention
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-96 space-y-4 overflow-y-auto scroll-slim">
        {items.length === 0 && (
          <EmptyState icon={Bell} title="Nothing needs attention" description="All clear across your workspace." className="border-0 py-6" />
        )}
        {items.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
            <ul className="space-y-1.5">
              {group.rows.slice(0, 4).map((r, i) => {
                const rowCls =
                  'flex w-full items-start justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-left transition-transform';
                const body = (
                  <>
                    <span className="text-xs font-medium leading-snug">{r.text}</span>
                    <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                      {r.to && <ArrowRight className="h-3 w-3 text-muted-foreground/50" aria-hidden />}
                      {r.meta}
                    </span>
                  </>
                );
                return (
                  <li key={i}>
                    {r.to ? (
                      <a
                        href={`#${r.to}`}
                        aria-label={`Open ${r.text}`}
                        className={`${rowCls} cursor-pointer hover:border-red-500/40 hover:bg-red-500/10 active:scale-[0.99]`}
                      >
                        {body}
                      </a>
                    ) : (
                      <div className={rowCls}>{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ActivityCard({ data, loading }: { data?: DashboardData; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-4 w-32" /></CardHeader>
        <CardContent className="space-y-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-5 w-full" />)}
        </CardContent>
      </Card>
    );
  }
  const activity = data?.recentActivity ?? [];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <History className="h-4 w-4 text-muted-foreground" aria-hidden /> Recent activity
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-96 overflow-y-auto scroll-slim">
        {activity.length === 0 && (
          <EmptyState icon={History} title="No activity yet" description="Actions across the workspace appear here." className="border-0 py-6" />
        )}
        <ol className="relative space-y-3 border-l pl-4">
          {activity.map((a) => (
            <li key={a.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary/60" aria-hidden />
              <p className="text-xs leading-snug">{a.summary}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {a.userName} · {fmtRelative(a.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
