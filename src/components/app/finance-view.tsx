'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, CheckCircle2, Ban, Undo2, Banknote, Clock3, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api, ApiClientError } from '@/lib/client/api';
import type { PaymentRow } from '@/lib/client/types';
import { fmtDate, fmtDateTime, fmtMoney, formatMoney, paymentKindLabel, paymentMethodLabel } from '@/lib/client/format';
import { useAppStore } from '@/components/app/store';
import { navigate } from '@/components/app/router';
import { StatusBadge } from '@/components/app/ui/status-badge';
import { PageHeader } from '@/components/app/ui/page-header';
import { EmptyState } from '@/components/app/ui/empty-state';
import { ConfirmDialog } from '@/components/app/ui/confirm-dialog';
import { PaymentDialog } from '@/components/app/ui/payment-dialog';

export function FinanceView() {
  const user = useAppStore((s) => s.user);
  const queryClient = useQueryClient();
  const canManage = user?.perms.includes('finance.manage') ?? false;
  const cur = user?.currency ?? 'EGP';
  const [kind, setKind] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [direction, setDirection] = useState('ALL');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [reversing, setReversing] = useState<PaymentRow | null>(null);
  const [cancelling, setCancelling] = useState<PaymentRow | null>(null);
  const [reason, setReason] = useState('');

  const params = new URLSearchParams();
  if (kind !== 'ALL') params.set('kind', kind);
  if (status !== 'ALL') params.set('status', status);
  if (direction !== 'ALL') params.set('direction', direction);
  if (overdueOnly) params.set('overdue', '1');

  const { data, isLoading } = useQuery({
    queryKey: ['payments', kind, status, direction, overdueOnly],
    queryFn: () => api<{ payments: PaymentRow[] }>(`/payments?${params.toString()}`),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['payments'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['events'] });
  };

  const markPaid = useMutation({
    mutationFn: (id: string) => api(`/payments/${id}`, { method: 'PATCH', body: { status: 'COMPLETED' } }),
    onSuccess: () => { toast.success('Marked as paid'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const reverse = useMutation({
    mutationFn: () => api(`/payments/${reversing!.id}/reverse`, { method: 'POST', body: { reason } }),
    onSuccess: () => {
      toast.success('Reversal recorded', { description: 'A corrective entry was added to the ledger.' });
      setReversing(null);
      setReason('');
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api(`/payments/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Plan entry cancelled'); setCancelling(null); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const payments = data?.payments ?? [];

  // Access guard: an Operations user without the CEO-granted `finance.view`
  // perm can still type #/finance directly — show a clear message instead of
  // an empty ledger skeleton. (The API also returns 403/404; this is UX only.)
  if (!user?.perms.includes('finance.view')) {
    return (
      <div className="space-y-4">
        <PageHeader title="Finance" description="Financial access is restricted." />
        <EmptyState
          icon={Lock}
          title="You don't have access to finance"
          description="Operations team members can't see budgets, payments or margins unless the CEO grants finance access. Ask your CEO to enable it from the Team page."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Finance — transaction ledger"
        description="Every client payment, vendor payment and expense across the company. Completed transactions are immutable; corrections are recorded as reversals."
        actions={canManage && (
          <Button size="sm" onClick={() => setPayOpen(true)}>
            <Plus className="mr-1 h-4 w-4" aria-hidden /> Record transaction
          </Button>
        )}
      />

      {/* Filters */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Select value={direction} onValueChange={setDirection}>
          <SelectTrigger aria-label="Filter direction"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All directions</SelectItem>
            <SelectItem value="INFLOW">Money in (clients)</SelectItem>
            <SelectItem value="OUTFLOW">Money out (vendors/expenses)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger aria-label="Filter type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            <SelectItem value="CLIENT_PAYMENT">Client payments</SelectItem>
            <SelectItem value="VENDOR_PAYMENT">Vendor payments</SelectItem>
            <SelectItem value="EXPENSE">Expenses</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Filter status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="REVERSED">Reversed</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={overdueOnly ? 'secondary' : 'outline'}
          className={overdueOnly ? 'border-red-500/40 text-red-700 dark:text-red-400' : ''}
          onClick={() => setOverdueOnly(!overdueOnly)}
        >
          <Clock3 className="mr-1 h-4 w-4" aria-hidden /> {overdueOnly ? 'Showing overdue' : 'Overdue only'}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      ) : payments.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="No transactions match"
          description="Record client payments, vendor payments and expenses, or clear the filters."
          action={canManage && <Button size="sm" onClick={() => setPayOpen(true)}><Plus className="mr-1 h-4 w-4" aria-hidden /> Record transaction</Button>}
        />
      ) : (
        <>
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <div className="max-h-[560px] overflow-y-auto scroll-slim">
                {/* table-fixed: max-width on <td> is ignored in auto layout,
                    which let long event names overlap the description column. */}
                <Table className="table-fixed">
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead className="w-24">Date</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-28">Method / ref</TableHead>
                      <TableHead className="w-24">Status</TableHead>
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
                          <button className="block max-w-full truncate text-xs font-medium underline-offset-2 hover:underline"
                            onClick={() => navigate(`/events/${p.eventId}/budget`)}>
                            {p.eventName ?? '—'}
                          </button>
                        </TableCell>
                        <TableCell className="px-2">
                          <p className="truncate text-xs font-medium">
                            {paymentKindLabel(p.kind)}
                            {p.reversalOfId && <span className="ml-1 text-red-600 dark:text-red-400">(reversal)</span>}
                          </p>
                          {p.note && <p className="truncate text-[11px] text-muted-foreground">{p.note}</p>}
                        </TableCell>
                        <TableCell className="px-2 text-xs">
                          <p className="truncate">{paymentMethodLabel(p.method)}</p>
                          {p.reference && <p className="truncate text-[10px] text-muted-foreground">{p.reference}</p>}
                        </TableCell>
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
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Mark as paid" aria-label="Mark as paid"
                                    onClick={() => markPaid.mutate(p.id)}>
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Cancel plan entry" aria-label="Cancel plan entry"
                                    onClick={() => setCancelling(p)}>
                                    <Ban className="h-3.5 w-3.5 text-muted-foreground" />
                                  </Button>
                                </>
                              )}
                              {p.status === 'COMPLETED' && !p.reversalOfId && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Record a reversal" aria-label="Record a reversal"
                                  onClick={() => setReversing(p)}>
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
            </CardContent>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {payments.slice(0, 60).map((p) => (
              <Card key={p.id} className={p.reversalOfId ? 'bg-red-500/5' : undefined}>
                <CardContent className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.eventName ?? '—'}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {paymentKindLabel(p.kind)} · {fmtDate(p.paidAt ?? p.dueDate ?? p.createdAt)}
                      </p>
                    </div>
                    <span className={`shrink-0 text-sm font-semibold tabular ${
                      p.amount < 0 ? 'text-red-600 dark:text-red-400'
                        : p.direction === 'INFLOW' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                    }`}>
                      {p.direction === 'INFLOW' ? '+' : '−'}{fmtMoney(Math.abs(p.amount), cur)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <StatusBadge kind="payment" value={p.status} />
                    {p.isOverdue && <Badge variant="destructive" className="text-[9px]">Overdue</Badge>}
                    <span className="ml-auto text-[10px] text-muted-foreground">{paymentMethodLabel(p.method)}</span>
                  </div>
                  {canManage && p.status === 'PENDING' && (
                    <div className="mt-2 flex justify-end gap-1">
                      <Button size="sm" variant="outline" className="h-7" onClick={() => markPaid.mutate(p.id)}>
                        <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden /> Mark paid
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} />

      {/* Reversal dialog */}
      <Dialog open={!!reversing} onOpenChange={(v) => { if (!v) { setReversing(null); setReason(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reverse this transaction?</DialogTitle>
            <DialogDescription>
              {reversing && (
                <>
                  {paymentKindLabel(reversing.kind)} of <span className="font-semibold">{fmtMoney(Math.abs(reversing.amount), cur)}</span>
                  {reversing.eventName ? ` on ${reversing.eventName}` : ''} recorded {fmtDateTime(reversing.createdAt)}.
                  A corrective negative entry is added; the original stays visible, marked REVERSED. Nothing is deleted.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rev-reason-g">Reason (audited)</Label>
            <Textarea id="rev-reason-g" rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Cheque bounced — reissuing after clearance" />
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
