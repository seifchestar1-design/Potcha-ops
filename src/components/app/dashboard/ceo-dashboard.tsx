'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CalendarDays, Wallet, TrendingUp, AlertTriangle, ListChecks, Building2,
  CheckCircle2, Clock3, Banknote, PiggyBank, Plus, Megaphone,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/client/api';
import { fmtMoney, fmtRelative } from '@/lib/client/format';
import { useAppStore } from '@/components/app/store';
import { navigate } from '@/components/app/router';
import { KpiCard } from '@/components/app/ui/kpi-card';
import { PageHeader } from '@/components/app/ui/page-header';
import { UpcomingEventsCard, AlertsCard, ActivityCard, useDashboard } from './shared';
import { EmptyState } from '@/components/app/ui/empty-state';
import { Badge } from '@/components/ui/badge';

export function CeoDashboard() {
  const user = useAppStore((s) => s.user);
  const { data, isLoading } = useDashboard();
  const queryClient = useQueryClient();
  const k = data?.kpis ?? {};
  const cur = user?.currency ?? 'EGP';

  const markRead = useMutation({
    mutationFn: (id: string) => api(`/notices/${id}/read`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  });

  const money = (v: number | undefined) => (v === undefined ? null : v);

  // ---- Tap targets: every KPI opens the workspace where the number lives.
  const hasFinance = user?.perms.includes('finance.view') ?? false;
  const atRiskIds = data?.alerts?.atRiskEventIds ?? [];
  // One at-risk event → open it directly; several → the events list.
  const atRiskTarget = atRiskIds.length === 1 ? `/events/${atRiskIds[0]}/overview` : '/events';
  const overduePaymentTarget =
    hasFinance && (k.overduePayments ?? 0) > 0 ? '/finance' : '/events';

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Company overview — ${user?.companyName ?? ''}`}
        description="Full oversight of events, finances, operations and team across the company"
        actions={
          <>
            <Button size="sm" onClick={() => navigate('/events')}>
              <Plus className="mr-1 h-4 w-4" aria-hidden /> New event
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/team')}>
              <Building2 className="mr-1 h-4 w-4" aria-hidden /> Team
            </Button>
          </>
        }
      />

      {/* KPI grid — CEO scorecard (every card is tappable, opens its workspace) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <KpiCard label="Active events" value={k.activeEvents} icon={CalendarDays} hint="Confirmed → ready" loading={isLoading} onPress={() => navigate('/events')} />
        <KpiCard label="Upcoming weddings" value={k.upcomingWeddings} icon={CalendarDays} loading={isLoading} onPress={() => navigate('/events')} />
        <KpiCard label="Contracted revenue" value={money(k.totalContractedRevenue)} isMoney currency={cur} icon={Wallet} tone="info" loading={isLoading} onPress={hasFinance ? () => navigate('/finance') : undefined} />
        <KpiCard label="Collected payments" value={money(k.totalCollected)} isMoney currency={cur} icon={Banknote} tone="positive" loading={isLoading} onPress={hasFinance ? () => navigate('/finance') : undefined} />
        <KpiCard label="Outstanding (clients)" value={money(k.outstandingClientPayments)} isMoney currency={cur} icon={Clock3} tone="warning" loading={isLoading} onPress={hasFinance ? () => navigate('/finance') : undefined} />
        <KpiCard label="Planned expenses" value={money(k.plannedExpenses)} isMoney currency={cur} icon={PiggyBank} loading={isLoading} onPress={hasFinance ? () => navigate('/finance') : undefined} />
        <KpiCard label="Actual expenses" value={money(k.actualExpenses)} isMoney currency={cur} icon={PiggyBank} tone="warning" loading={isLoading} onPress={hasFinance ? () => navigate('/finance') : undefined} />
        <KpiCard label="Estimated profit" value={money(k.estimatedProfit)} isMoney currency={cur} icon={TrendingUp} tone="positive" loading={isLoading} onPress={() => navigate('/reports')} />
        <KpiCard label="Events at risk" value={k.eventsAtRisk} icon={AlertTriangle} tone={k.eventsAtRisk ? 'negative' : 'positive'} loading={isLoading} onPress={() => navigate(atRiskTarget)} />
        <KpiCard label="Tasks overdue" value={k.tasksOverdue} icon={ListChecks} tone={k.tasksOverdue ? 'negative' : 'positive'} loading={isLoading} onPress={() => navigate('/tasks?due=OVERDUE')} />
        <KpiCard label="Vendor confirmations out." value={k.vendorConfirmationsOutstanding} icon={Building2} tone="warning" loading={isLoading} onPress={() => navigate('/vendors')} />
        <KpiCard label="Overdue payments" value={k.overduePayments} icon={Clock3} tone={k.overduePayments ? 'negative' : 'positive'} loading={isLoading} onPress={() => navigate(overduePaymentTarget)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Notices from finance */}
          {(data?.notices?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Megaphone className="h-4 w-4 text-primary" aria-hidden /> Notices from your team
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data!.notices.slice(0, 4).map((n) => {
                  const rowStyle = {
                    borderColor: n.level === 'CRITICAL' ? 'var(--destructive-border, rgba(220,38,38,.3))' : undefined,
                    background: n.level === 'CRITICAL' ? 'rgba(220,38,38,.05)' : undefined,
                  };
                  // Whole notice opens the assigned event (when linked);
                  // "Mark read" stays a separate button next to it.
                  const body = (
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={n.level === 'CRITICAL' ? 'destructive' : n.level === 'WARNING' ? 'secondary' : 'outline'} className="text-[10px]">
                          {n.level}
                        </Badge>
                        {n.eventName && <span className="text-xs font-medium">{n.eventName}</span>}
                        {!n.readAt && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="Unread" />}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{n.message}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {n.fromUserName} · {fmtRelative(n.createdAt)}
                      </p>
                    </div>
                  );
                  return (
                    <div
                      key={n.id}
                      className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5"
                      style={rowStyle}
                    >
                      {n.eventId ? (
                        <a
                          href={`#/events/${n.eventId}/overview`}
                          aria-label={`Open ${n.eventName} — notice: ${n.message}`}
                          className="min-w-0 flex-1 cursor-pointer rounded text-left transition-colors hover:bg-accent/30 active:bg-accent/50"
                        >
                          {body}
                        </a>
                      ) : (
                        body
                      )}
                      {!n.readAt && (
                        <Button size="sm" variant="ghost" className="h-7 shrink-0" onClick={() => markRead.mutate(n.id)}>
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden /> Mark read
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <UpcomingEventsCard data={data} loading={isLoading} />

          {/* Event financial table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Event profitability</CardTitle>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto scroll-slim">
              {(data?.eventFinancials?.length ?? 0) === 0 ? (
                <EmptyState icon={Wallet} title="No won events yet" description="Financial rollups appear once events are confirmed." className="border-0 py-6" />
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 pr-2 font-medium">Event</th>
                      <th className="pb-2 pr-2 text-right font-medium">Revenue</th>
                      <th className="pb-2 pr-2 text-right font-medium">Collected</th>
                      <th className="pb-2 pr-2 text-right font-medium">Outstanding</th>
                      <th className="pb-2 pr-2 text-right font-medium">Est. profit</th>
                      <th className="pb-2 text-right font-medium">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {data!.eventFinancials.map((e) => (
                      <tr
                        key={e.eventId}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open ${e.eventName} overview`}
                        className="cursor-pointer border-b last:border-0 hover:bg-accent/40"
                        onClick={() => navigate(`/events/${e.eventId}/overview`)}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter' || ev.key === ' ') {
                            ev.preventDefault();
                            navigate(`/events/${e.eventId}/overview`);
                          }
                        }}
                      >
                        <td className="max-w-40 truncate py-2 pr-2 font-medium">{e.eventName}</td>
                        <td className="py-2 pr-2 text-right">{fmtMoney(e.totalRevenue ?? 0, cur)}</td>
                        <td className="py-2 pr-2 text-right text-emerald-600 dark:text-emerald-400">{fmtMoney(e.collectedFromClient ?? 0, cur)}</td>
                        <td className="py-2 pr-2 text-right text-amber-600 dark:text-amber-400">{fmtMoney(e.outstandingClientBalance ?? 0, cur)}</td>
                        <td className={`py-2 pr-2 text-right ${(e.grossEstimatedProfit ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {fmtMoney(e.grossEstimatedProfit ?? 0, cur)}
                        </td>
                        <td className="py-2 text-right">{(e.profitMargin ?? 0).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <AlertsCard data={data} loading={isLoading} />
          <ActivityCard data={data} loading={isLoading} />
        </div>
      </div>
    </div>
  );
}
