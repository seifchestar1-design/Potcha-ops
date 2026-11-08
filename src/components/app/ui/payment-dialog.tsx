'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api, ApiClientError } from '@/lib/client/api';
import type { EventRow, EventVendorRow } from '@/lib/client/types';
import { PAYMENT_METHODS } from '@/lib/constants';
import { useAppStore } from '@/components/app/store';

export function PaymentDialog({
  open,
  onOpenChange,
  presetEventId,
  presetKind,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  presetEventId?: string;
  presetKind?: 'CLIENT_PAYMENT' | 'VENDOR_PAYMENT' | 'EXPENSE';
}) {
  const user = useAppStore((s) => s.user);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [f, setF] = useState({
    eventId: presetEventId ?? '',
    kind: presetKind ?? 'CLIENT_PAYMENT',
    amount: '',
    method: 'BANK_TRANSFER',
    reference: '',
    note: '',
    status: 'COMPLETED',
    dueDate: '',
    eventVendorId: 'none',
  });

  // Reset when reopened
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setError(null);
      setF({
        eventId: presetEventId ?? '',
        kind: presetKind ?? 'CLIENT_PAYMENT',
        amount: '', method: 'BANK_TRANSFER', reference: '', note: '',
        status: 'COMPLETED', dueDate: '', eventVendorId: 'none',
      });
    }
  }

  const { data: events } = useQuery({
    queryKey: ['events', ''],
    queryFn: () => api<{ events: EventRow[] }>('/events'),
    enabled: open,
  });

  const { data: vendors } = useQuery({
    queryKey: ['event-vendors', f.eventId],
    queryFn: () => api<{ vendors: EventVendorRow[] }>(`/events/${f.eventId}/vendors`),
    enabled: open && !!f.eventId,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/payments', {
        method: 'POST',
        body: {
          eventId: f.eventId,
          direction: f.kind === 'CLIENT_PAYMENT' ? 'INFLOW' : 'OUTFLOW',
          kind: f.kind,
          amount: Number(f.amount),
          method: f.method,
          reference: f.reference || null,
          note: f.note || null,
          status: f.status,
          dueDate: f.status === 'PENDING' && f.dueDate ? new Date(f.dueDate).toISOString() : null,
          eventVendorId: f.kind === 'VENDOR_PAYMENT' && f.eventVendorId !== 'none' ? f.eventVendorId : null,
        },
      });
      toast.success(
        f.status === 'PENDING' ? 'Payment plan added' : 'Payment recorded',
        { description: 'The transaction is audited and immutable once completed.' }
      );
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['event-finance', f.eventId] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['event-vendors', f.eventId] });
      queryClient.invalidateQueries({ queryKey: ['event', f.eventId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const selectedEvent = (events?.events ?? []).find((e) => e.id === f.eventId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record a transaction</DialogTitle>
          <DialogDescription>
            Completed transactions are immutable — corrections are made through reversals, keeping the audit trail intact.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Event</Label>
              <Select value={f.eventId} onValueChange={(v) => setF({ ...f, eventId: v, eventVendorId: 'none' })}>
                <SelectTrigger aria-label="Select event"><SelectValue placeholder="Choose an event" /></SelectTrigger>
                <SelectContent>
                  {(events?.events ?? []).map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v, eventVendorId: 'none' })}>
                <SelectTrigger aria-label="Transaction type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLIENT_PAYMENT">Client payment (in)</SelectItem>
                  <SelectItem value="VENDOR_PAYMENT">Vendor payment (out)</SelectItem>
                  <SelectItem value="EXPENSE">Other expense (out)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Amount ({user?.currency ?? 'EGP'})</Label>
              <Input id="pay-amount" type="number" min={0.01} step="0.01" placeholder="0.00"
                value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required />
            </div>
            {f.kind === 'VENDOR_PAYMENT' && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Link to engaged vendor (optional)</Label>
                <Select value={f.eventVendorId} onValueChange={(v) => setF({ ...f, eventVendorId: v })} disabled={!f.eventId}>
                  <SelectTrigger aria-label="Link to vendor"><SelectValue placeholder="No specific vendor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Not linked —</SelectItem>
                    {(vendors?.vendors ?? []).map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} {v.contractAmount !== undefined ? `(contract ${v.contractAmount.toLocaleString()})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Linking keeps the vendor's paid-to-date amount in sync automatically.
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={f.method} onValueChange={(v) => setF({ ...f, method: v })}>
                <SelectTrigger aria-label="Payment method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-ref">Reference (optional)</Label>
              <Input id="pay-ref" placeholder="e.g. TRX-88412" value={f.reference}
                onChange={(e) => setF({ ...f, reference: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
                <SelectTrigger aria-label="Payment status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPLETED">Completed — money moved</SelectItem>
                  <SelectItem value="PENDING">Planned — due later</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {f.status === 'PENDING' && (
              <div className="space-y-1.5">
                <Label htmlFor="pay-due">Due date</Label>
                <Input id="pay-due" type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pay-note">Note</Label>
              <Textarea id="pay-note" rows={2} placeholder="e.g. Installment 2 — 50% balance"
                value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
            </div>
          </div>
          {selectedEvent && f.kind === 'CLIENT_PAYMENT' && selectedEvent.contractValue !== undefined && (
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
              Contract {selectedEvent.contractValue.toLocaleString()} · collected so far{' '}
              {selectedEvent.financials?.collectedFromClient?.toLocaleString() ?? '—'} · outstanding{' '}
              {selectedEvent.financials?.outstandingClientBalance?.toLocaleString() ?? '—'}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || !f.eventId || !f.amount}>
              {busy ? 'Recording…' : f.status === 'PENDING' ? 'Add to payment plan' : 'Record transaction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
