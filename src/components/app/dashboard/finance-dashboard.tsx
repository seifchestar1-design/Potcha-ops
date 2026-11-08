'use client';

import {
  Wallet, Banknote, Clock3, PiggyBank, TrendingUp, AlertTriangle,
  CalendarClock, Scale, Percent, Megaphone, Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useState } from 'react';
import { api } from '@/lib/client/api';
import { fmtMoney, fmtDate } from '@/lib/client/format';
import { useAppStore } from '@/components/app/store';
import { navigate } from '@/components/app/router';
import { KpiCard } from '@/components/app/ui/kpi-card';
import { PageHeader } from '@/components/app/ui/page-header';
import { UpcomingEventsCard, AlertsCard, ActivityCard, useDashboard } from './shared';
import { EmptyState } from '@/components/app/ui/empty-state';
import type { DashboardData } from '@/lib/client/types';

export function FinanceDashboard() {
  const user = useAppStore((s) => s.user);
  const { data, isLoading } = useDashboard();
  const k = data?.kpis ?? {};
  const cur = user?.currency ?? 'EGP';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Financial overview"
        description={`Revenue, commitments and margins across ${user?.companyName ?? 'the company'}`}
        actions={
          <>
            <Button size="sm" onClick={() => navigate('/finance')}>
              <Plus className="mr-1 h-4 w-4" aria-hidden /> Record payment
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/reports')}>
              Export reports
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <KpiCard label="Total event revenue" value={k.totalContractedRevenue} isMoney currency={cur} icon={Wallet} tone="info" loading={isLoading} onPress={() => navigate('/finance')} />
        <KpiCard label="Collected revenue" value={k.totalCollected} isMoney currency={cur} icon={Banknote} tone="positive" loading={isLoading} onPress={() => navigate('/finance')} />
        <KpiCard label="Outstanding client balances" value={k.outstandingClientPayments} isMoney currency={cur} icon={Clock3} tone="warning" loading={isLoading} onPress={() => navigate('/finance')} />
        <KpiCard label="Vendor commitments" value={k.vendorCommitments} isMoney currency={cur} icon={PiggyBank} loading={isLoading} onPress={() => navigate('/finance')} />
        <KpiCard label="Paid to vendors" value={k.paidVendorAmounts} isMoney currency={cur} icon={Banknote} tone="positive" loading={isLoading} onPress={() => navigate('/finance')} />
        <KpiCard label="Unpaid vendor amounts" value={k.unpaidVendorAmounts} isMoney currency={cur} icon={PiggyBank} tone="warning" loading={isLoading} onPress={() => navigate('/finance')} />
        <KpiCard label="Upcoming deadlines (14d)" value={k.upcomingPaymentDeadlines} icon={CalendarClock} tone={k.upcomingPaymentDeadlines ? 'warning' : 'positive'} loading={isLoading} onPress={() => navigate('/finance')} />
        <KpiCard label="Overdue payments" value={k.overduePayments} icon={AlertTriangle} tone={k.overduePayments ? 'negative' : 'positive'} loading={isLoading} onPress={() => navigate('/finance')} />
        <KpiCard label="Expenses vs budget" value={k.plannedExpenses ? `${Math.round(((k.actualExpenses ?? 0) / k.plannedExpenses) * 100)}%` : '—'} icon={Scale} tone="info" loading={isLoading} hint={`${fmtMoney(k.actualExpenses, cur)} of ${fmtMoney(k.plannedExpenses, cur)}`} onPress={() => navigate('/finance')} />
        <KpiCard label="Estimated profit" value={k.estimatedProfit} isMoney currency={cur} icon={TrendingUp} tone="positive" loading={isLoading} onPress={() => navigate('/reports')} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <UpcomingEventsCard data={data} loading={isLoading} />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Percent className="h-4 w-4 text-muted-foreground" aria-hidden /> Estimated profit per event
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto scroll-slim">
              {(data?.eventFinancials?.length ?? 0) === 0 ? (
                <EmptyState icon={Wallet} title="No confirmed events yet" description="Profit per event appears once an event is confirmed." className="border-0 py-6" />
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 pr-2 font-medium">Event</th>
                      <th className="pb-2 pr-2 text-right font-medium">Revenue</th>
                      <th className="pb-2 pr-2 text-right font-medium">Planned exp.</th>
                      <th className="pb-2 pr-2 text-right font-medium">Actual exp.</th>
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
                        aria-label={`Open ${e.eventName} budget`}
                        className="cursor-pointer border-b last:border-0 hover:bg-accent/40"
                        onClick={() => navigate(`/events/${e.eventId}/budget`)}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter' || ev.key === ' ') {
                            ev.preventDefault();
                            navigate(`/events/${e.eventId}/budget`);
                          }
                        }}
                      >
                        <td className="max-w-40 truncate py-2 pr-2 font-medium">{e.eventName}</td>
                        <td className="py-2 pr-2 text-right">{fmtMoney(e.totalRevenue ?? 0, cur)}</td>
                        <td className="py-2 pr-2 text-right">{fmtMoney(e.plannedExpenses ?? 0, cur)}</td>
                        <td className="py-2 pr-2 text-right">{fmtMoney(e.actualExpenses ?? 0, cur)}</td>
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

          <OverduePaymentsCard data={data} loading={isLoading} />
        </div>

        <div className="space-y-4">
          <FlagRiskCard events={data?.events ?? []} />
          <AlertsCard data={data} loading={isLoading} />
          <ActivityCard data={data} loading={isLoading} />
        </div>
      </div>
    </div>
  );
}

function OverduePaymentsCard({ data, loading }: { data?: DashboardData; loading: boolean }) {
  const rows = data?.overduePaymentRows ?? [];
  if (loading || rows.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
          <AlertTriangle className="h-4 w-4" aria-hidden /> Overdue payments ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {rows.map((p) => (
          <a
            key={p.id}
            href={`#/events/${p.eventId}/budget`}
            aria-label={`Open budget — ${p.note ?? p.kind}, ${fmtMoney(p.amount, data?.currency)} due ${p.dueDate ? fmtDate(p.dueDate) : 'soon'}`}
            className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2 text-left transition-transform hover:border-red-500/45 hover:bg-red-500/10 active:scale-[0.99]"
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{p.note ?? p.kind}</p>
              <p className="text-[10px] text-muted-foreground">Due {fmtDate(p.dueDate)}</p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-red-600 dark:text-red-400 tabular">
              {fmtMoney(p.amount, data?.currency)}
            </span>
          </a>
        ))}
      </CardContent>
    </Card>
  );
}

function FlagRiskCard({ events }: { events: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [eventId, setEventId] = useState<string>('none');
  const [level, setLevel] = useState<'INFO' | 'WARNING' | 'CRITICAL'>('WARNING');
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();

  const send = useMutation({
    mutationFn: () =>
      api('/notices', {
        method: 'POST',
        body: { eventId: eventId === 'none' ? null : eventId, level, message },
      }),
    onSuccess: () => {
      toast.success('Notice sent to the CEO');
      setOpen(false);
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className="cursor-pointer border-dashed transition-colors hover:border-primary/50 hover:bg-accent/30">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <Megaphone className="h-4 w-4 text-primary" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium">Notify the CEO of a financial risk</p>
              <p className="text-xs text-muted-foreground">Flag overdue payments, budget overruns or risky exposure</p>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Raise a notice to the CEO</DialogTitle>
          <DialogDescription>The CEO sees this on their dashboard immediately.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Event (optional)</Label>
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Company-wide</SelectItem>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Level</Label>
              <Select value={level} onValueChange={(v) => setLevel(v as 'INFO' | 'WARNING' | 'CRITICAL')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INFO">Info</SelectItem>
                  <SelectItem value="WARNING">Warning</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notice-msg">Message</Label>
            <Textarea
              id="notice-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Installment overdue, client asked to shift the payment date…"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => send.mutate()} disabled={message.trim().length < 5 || send.isPending}>
            {send.isPending ? 'Sending…' : 'Send notice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
