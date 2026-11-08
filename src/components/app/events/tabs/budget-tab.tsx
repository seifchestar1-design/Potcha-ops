'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus, Undo2, CheckCircle2, Ban, Wallet, TrendingUp, Clock3, PiggyBank, Inbox,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api, ApiClientError } from '@/lib/client/api';
import type { EventFinancials, PaymentRow } from '@/lib/client/types';
import { fmtDate, fmtDateTime, fmtMoney, formatMoney, paymentKindLabel, paymentMethodLabel, vendorCategoryLabel } from '@/lib/client/format';
import { useAppStore } from '@/components/app/store';
import { StatusBadge } from '@/components/app/ui/status-badge';
import { KpiCard } from '@/components/app/ui/kpi-card';
import { EmptyState } from '@/components/app/ui/empty-state';
import { ConfirmDialog } from '@/components/app/ui/confirm-dialog';
import { PaymentDialog } from '@/components/app/ui/payment-dialog';

type FinanceData = {
  financials: EventFinancials | null;
  vendors: { id: string; name: string; category: string; contractAmount: number; depositAmount: number; paidAmount: number; paymentStatus: string; confirmationStatus: string }[];
  payments: PaymentRow[];
};

export function BudgetTab({ eventId }: { eventId: string }) {
  const user = useAppStore((s) => s.user);
  const queryClient = useQueryClient();
  const canManage = user?.perms.includes('finance.manage') ?? false;
  const cur = user?.currency ?? 'EGP';
  const [payOpen, setPayOpen] = useState(false);
  const [reversing, setReversing] = useState<PaymentRow | null>(null);
  const [cancelling, setCancelling] = useState<PaymentRow | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['event-finance', eventId],
    queryFn: () => api<FinanceData>(`/events/${eventId}/finance`),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['event-finance', eventId] });
    queryClient.invalidateQueries({ queryKey: ['event-vendors', eventId] });
    queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    queryClient.invalidateQueries({ queryKey: ['payments'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const markPaid = useMutation({
    mutationFn: (id: string) => api(`/payments/${id}`, { method: 'PATCH', body: { status: 'COMPLETED' } }),
    onSuccess: () => { toast.success('Marked as paid'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const reverse = useMutation({
    mutationFn: () =>
      api(`/payments/${reversing!.id}/reverse`, { method: 'POST', body: { reason } }),
    onSuccess: () => {
      toast.success('Reversal recorded', {
        description: 'A corrective entry was added; the original transaction is marked REVERSED. Nothing was deleted.',
      });
      setReversing(null);
      setReason('');
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api(`/payments/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Pending plan entry cancelled'); setCancelling(null); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="space-y-3"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>;
  }

  const fin = data?.financials;
  const payments = data?.payments ?? [];
  const vendors = data?.vendors ?? [];

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Total revenue" value={fin?.totalRevenue ?? 0} isMoney currency={cur} icon={Wallet} tone="info" />
        <KpiCard label="Collected" value={fin?.collectedFromClient ?? 0} isMoney currency={cur} icon={CheckCircle2} tone="positive" />
        <KpiCard label="Outstanding" value={fin?.outstandingClientBalance ?? 0} isMoney currency={cur} icon={Clock3} tone="warning" />
        <KpiCard label="Planned expenses" value={fin?.plannedExpenses ?? 0} isMoney currency={cur} icon={PiggyBank} />
        <KpiCard label="Actual expenses" value={fin?.actualExpenses ?? 0} isMoney currency={cur} icon={PiggyBank} tone="warning" />
        <KpiCard label="Est. profit / margin" value={fin?.grossEstimatedProfit ?? 0} isMoney currency={cur} icon={TrendingUp}
          tone={(fin?.grossEstimatedProfit ?? 0) >= 0 ? 'positive' : 'negative'}
          hint={fin ? `${fin.profitMargin.toFixed(1)}% margin · actual profit ${fmtMoney(fin.actualProfit, cur)}` : undefined} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Immutable ledger — {payments.length} transaction{payments.length === 1 ? '' : 's'}
        </p>
        {canManage && (
          <Button size="sm" onClick={() => setPayOpen(true)}>
            <Plus className="mr-1 h-4 w-4" aria-hidden /> Record transaction
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Ledger */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Transaction ledger</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {payments.length === 0 ? (
              <EmptyState icon={Inbox} title="No transactions yet" description="Record client payments, vendor payments and expenses here." className="m-4" />
            ) : (
              <div className="max-h-[520px] overflow-y-auto scroll-slim">
                {/* table-fixed: max-width on <td> is ignored in auto layout —
                    keeps long notes from overlapping later columns. */}
                <Table className="table-fixed">
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead className="w-24">Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-24">Method</TableHead>
                      <TableHead className="w-28">Status</TableHead>
                      <TableHead className="w-28 text-right">Amount</TableHead>
                      {canManage && <TableHead className="w-24" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id} className={p.reversalOfId ? 'bg-red-500/5' : undefined}>
                        <TableCell className="whitespace-nowrap text-xs tabular">
                          {fmtDate(p.paidAt ?? p.dueDate ?? p.createdAt)}
                        </TableCell>
                        <TableCell className="px-2">
                          <p className="truncate text-xs font-medium">
                            {paymentKindLabel(p.kind)}
                            {p.reversalOfId && <span className="ml-1 text-red-600 dark:text-red-400">(reversal)</span>}
                          </p>
                          {p.note && <p className="truncate text-[11px] text-muted-foreground">{p.note}</p>}
                          {p.reference && <p className="truncate text-[10px] text-muted-foreground">ref: {p.reference}</p>}
                        </TableCell>
                        <TableCell className="text-xs">{paymentMethodLabel(p.method)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <StatusBadge kind="payment" value={p.status} />
                            {p.isOverdue && <Badge variant="destructive" className="text-[9px]">Overdue</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className={`text-right text-xs font-semibold tabular ${
                          p.amount < 0 ? 'text-red-600 dark:text-red-400'
                            : p.direction === 'INFLOW' ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-700 dark:text-amber-400'
                        }`}>
                          {p.direction === 'INFLOW' ? '+' : '−'}{formatMoney(Math.abs(p.amount), cur)}
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <div className="flex justify-end gap-0.5">
                              {p.status === 'PENDING' && (
                                <>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Mark as paid"
                                    aria-label="Mark as paid" onClick={() => markPaid.mutate(p.id)}>
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Cancel plan entry"
                                    aria-label="Cancel plan entry" onClick={() => setCancelling(p)}>
                                    <Ban className="h-3.5 w-3.5 text-muted-foreground" />
                                  </Button>
                                </>
                              )}
                              {p.status === 'COMPLETED' && !p.reversalOfId && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Record a reversal"
                                  aria-label="Record a reversal" onClick={() => setReversing(p)}>
                                  <Undo2 className="h-3.5 w-3.5 text-red-600" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vendor commitments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Vendor commitments</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[520px] space-y-2 overflow-y-auto scroll-slim">
            {vendors.length === 0 && (
              <p className="text-sm text-muted-foreground">No vendors engaged yet — planned expenses come from vendor contracts.</p>
            )}
            {vendors.map((v) => (
              <div key={v.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-medium">{v.name}</p>
                  <Badge variant="outline" className="shrink-0 text-[10px]">{vendorCategoryLabel(v.category)}</Badge>
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-2 text-[11px] tabular">
                  <div>
                    <p className="text-muted-foreground">Contract</p>
                    <p className="font-medium">{formatMoney(v.contractAmount, cur)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Paid</p>
                    <p className={`font-medium ${v.paymentStatus === 'FULLY_PAID' ? 'text-emerald-600 dark:text-emerald-400' : v.paymentStatus === 'PARTIAL' ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                      {formatMoney(v.paidAmount, cur)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Remaining</p>
                    <p className="font-medium">{formatMoney(Math.max(0, v.contractAmount - v.paidAmount), cur)}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} presetEventId={eventId} />

      {/* Reversal dialog */}
      <Dialog open={!!reversing} onOpenChange={(v) => { if (!v) { setReversing(null); setReason(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reverse this transaction?</DialogTitle>
            <DialogDescription>
              {reversing && (
                <>
                  {paymentKindLabel(reversing.kind)} of{' '}
                  <span className="font-semibold">{fmtMoney(Math.abs(reversing.amount), cur)}</span>
                  {reversing.note ? ` — ${reversing.note}` : ''} recorded {fmtDateTime(reversing.createdAt)}.
                  A corrective negative entry will be added; the original stays visible and marked REVERSED.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rev-reason">Reason (audited)</Label>
            <Textarea id="rev-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Duplicate entry — bank reversal processed" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReversing(null); setReason(''); }}>Cancel</Button>
            <Button variant="destructive" onClick={() => reverse.mutate()} disabled={reason.trim().length < 3 || reverse.isPending}>
              {reverse.isPending ? 'Recording reversal…' : 'Record reversal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(v) => !v && setCancelling(null)}
        title="Cancel this planned payment?"
        description={
          cancelling
            ? `${paymentKindLabel(cancelling.kind)} of ${fmtMoney(cancelling.amount, cur)}${cancelling.dueDate ? ` due ${fmtDate(cancelling.dueDate)}` : ''}. Only pending plan entries can be cancelled — completed money movement must be reversed instead.`
            : ''
        }
        confirmLabel="Cancel plan entry"
        onConfirm={() => cancelling && cancel.mutate(cancelling.id)}
      />
    </div>
  );
}
