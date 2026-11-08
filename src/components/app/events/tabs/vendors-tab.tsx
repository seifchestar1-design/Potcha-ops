'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Truck, Pencil, Trash2, Phone, MessageCircle, User, Clock3, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api, ApiClientError } from '@/lib/client/api';
import type { EventVendorRow, VendorRow } from '@/lib/client/types';
import { VENDOR_CATEGORIES, VENDOR_STATUSES } from '@/lib/constants';
import { formatMoney, vendorCategoryLabel } from '@/lib/client/format';
import { useAppStore } from '@/components/app/store';
import { StatusBadge } from '@/components/app/ui/status-badge';
import { EmptyState } from '@/components/app/ui/empty-state';
import { ConfirmDialog } from '@/components/app/ui/confirm-dialog';

type VendorFormValues = {
  vendorId?: string | null;
  name: string;
  category: string;
  contactPerson?: string | null;
  contactPhone?: string | null;
  contactWhatsapp?: string | null;
  confirmationStatus: string;
  arrivalTime?: string | null;
  setupTime?: string | null;
  responsibleId?: string | null;
  operationalNotes?: string | null;
  contractAmount?: number;
  depositAmount?: number;
  paidAmount?: number;
};

export function VendorsTab({ eventId }: { eventId: string }) {
  const user = useAppStore((s) => s.user);
  const queryClient = useQueryClient();
  const canManage = user?.perms.includes('vendors.contacts.manage') ?? false;
  const canFinance = user?.perms.includes('finance.manage') ?? false;
  const canSeeFin = user?.perms.includes('finance.view') ?? false;
  const cur = user?.currency ?? 'EGP';
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EventVendorRow | null>(null);
  const [deleting, setDeleting] = useState<EventVendorRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['event-vendors', eventId],
    queryFn: () => api<{ vendors: EventVendorRow[] }>(`/events/${eventId}/vendors`),
  });
  const { data: directory } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api<{ vendors: VendorRow[] }>('/vendors'),
  });
  const { data: team } = useQuery({
    queryKey: ['team'],
    queryFn: () => api<{ members: { id: string; name: string; role: string; status: string }[] }>('/team'),
    enabled: !!user?.perms.includes('team.manage'),
  });

  const vendors = data?.vendors ?? [];
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['event-vendors', eventId] });
    queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const save = useMutation({
    mutationFn: ({ values, id }: { values: VendorFormValues; id?: string }) =>
      id
        ? api(`/events/${eventId}/vendors/${id}`, { method: 'PATCH', body: values })
        : api(`/events/${eventId}/vendors`, { method: 'POST', body: values }),
    onSuccess: () => {
      toast.success(editing ? 'Vendor updated' : 'Vendor engaged');
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/events/${eventId}/vendors/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Vendor removed from this event');
      setDeleting(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const onSubmit = async (values: VendorFormValues, id?: string) => {
    await save.mutateAsync({ values, id });
  };

  const teamMembers = (team?.members ?? []).filter((m) => m.status !== 'DISABLED');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {canSeeFin
            ? 'Vendors engaged for this event — operational details and financial commitments.'
            : 'Vendors engaged for this event — contacts, timings and confirmation status. Financial details are restricted.'}
        </p>
        {canManage && (
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" aria-hidden /> Engage vendor
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : vendors.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No vendors engaged yet"
          description={canManage ? 'Add venues, catering, décor, photographers and more to this event.' : 'The planner will engage vendors soon.'}
        />
      ) : (
        <>
          {/* Desktop */}
          <Card className="hidden lg:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Arrival / setup</TableHead>
                    <TableHead>Responsible</TableHead>
                    <TableHead>Confirmation</TableHead>
                    {canSeeFin && <TableHead className="text-right">Contract</TableHead>}
                    {canSeeFin && <TableHead className="text-right">Paid</TableHead>}
                    {canManage && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="max-w-44">
                        <p className="truncate font-medium">{v.name}</p>
                        {v.operationalNotes && (
                          <p className="truncate text-xs text-muted-foreground" title={v.operationalNotes}>{v.operationalNotes}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{vendorCategoryLabel(v.category)}</Badge>
                      </TableCell>
                      <TableCell>
                        {v.contactPhone ? (
                          <span className="flex items-center gap-1 text-xs">
                            <Phone className="h-3 w-3 text-muted-foreground" aria-hidden /> {v.contactPhone}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs tabular">
                        {v.arrivalTime ?? '—'} / {v.setupTime ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {teamMembers.find((m) => m.id === v.responsibleId)?.name ?? '—'}
                      </TableCell>
                      <TableCell><StatusBadge kind="vendor" value={v.confirmationStatus} /></TableCell>
                      {canSeeFin && (
                        <TableCell className="text-right tabular font-medium">{formatMoney(v.contractAmount ?? 0, cur)}</TableCell>
                      )}
                      {canSeeFin && (
                        <TableCell className="text-right tabular">
                          <span className={
                            v.paymentStatus === 'FULLY_PAID'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : v.paymentStatus === 'PARTIAL'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-muted-foreground'
                          }>
                            {formatMoney(v.paidAmount ?? 0, cur)}
                          </span>
                        </TableCell>
                      )}
                      {canManage && (
                        <TableCell>
                          <div className="flex gap-0.5">
                            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Edit ${v.name}`}
                              onClick={() => { setEditing(v); setDialogOpen(true); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label={`Remove ${v.name}`}
                              onClick={() => setDeleting(v)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile */}
          <div className="space-y-2 lg:hidden">
            {vendors.map((v) => (
              <Card key={v.id}>
                <CardContent className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{v.name}</p>
                      <p className="text-xs text-muted-foreground">{vendorCategoryLabel(v.category)}</p>
                    </div>
                    <StatusBadge kind="vendor" value={v.confirmationStatus} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {v.contactPhone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" aria-hidden /> {v.contactPhone}</span>}
                    {v.arrivalTime && <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" aria-hidden /> {v.arrivalTime}</span>}
                  </div>
                  {canSeeFin && (
                    <div className="mt-2 flex items-center justify-between border-t pt-2 text-xs">
                      <span className="text-muted-foreground">Contract</span>
                      <span className="font-medium tabular">{formatMoney(v.contractAmount ?? 0, cur)}</span>
                    </div>
                  )}
                  {canManage && (
                    <div className="mt-2 flex justify-end gap-1">
                      <Button size="sm" variant="outline" className="h-7" onClick={() => { setEditing(v); setDialogOpen(true); }}>
                        <Pencil className="mr-1 h-3 w-3" aria-hidden /> Edit
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <VendorFormDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }}
        vendor={editing}
        directory={directory?.vendors ?? []}
        teamMembers={teamMembers}
        canFinance={canFinance}
        canSeeFin={canSeeFin}
        onSubmit={onSubmit}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Remove "${deleting?.name}" from this event?`}
        description="The vendor is unlinked from this event only. Recorded payments remain in the financial ledger and audit trail."
        confirmLabel="Remove vendor"
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}

function VendorFormDialog({
  open, onOpenChange, vendor, directory, teamMembers, canFinance, canSeeFin, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vendor: EventVendorRow | null;
  directory: VendorRow[];
  teamMembers: { id: string; name: string; role: string }[];
  canFinance: boolean;
  canSeeFin: boolean;
  onSubmit: (values: VendorFormValues, id?: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState<VendorFormValues>(defaultVendorForm());

  // Sync form whenever the dialog opens (with or without a vendor)
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setError(null);
      setF(
        vendor
          ? {
              vendorId: vendor.vendorId,
              name: vendor.name,
              category: vendor.category,
              contactPerson: vendor.contactPerson ?? '',
              contactPhone: vendor.contactPhone ?? '',
              contactWhatsapp: vendor.contactWhatsapp ?? '',
              confirmationStatus: vendor.confirmationStatus,
              arrivalTime: vendor.arrivalTime ?? '',
              setupTime: vendor.setupTime ?? '',
              responsibleId: vendor.responsibleId ?? 'none',
              operationalNotes: vendor.operationalNotes ?? '',
              contractAmount: vendor.contractAmount ?? 0,
              depositAmount: vendor.depositAmount ?? 0,
              paidAmount: vendor.paidAmount ?? 0,
            }
          : defaultVendorForm()
      );
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(
        {
          ...f,
          responsibleId: f.responsibleId === 'none' ? null : f.responsibleId,
          vendorId: f.vendorId || null,
          arrivalTime: f.arrivalTime || null,
          setupTime: f.setupTime || null,
        },
        vendor?.id
      );
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto scroll-slim sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{vendor ? `Edit ${vendor.name}` : 'Engage a vendor'}</DialogTitle>
          <DialogDescription>
            Operational details for everyone; financial fields{canFinance ? ' editable by you (Finance/CEO).' : ' are managed by Finance.'}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>From company directory (optional)</Label>
              <Select
                value={f.vendorId ?? 'none'}
                onValueChange={(v) => {
                  const dir = directory.find((d) => d.id === v);
                  setF({
                    ...f,
                    vendorId: v === 'none' ? null : v,
                    ...(dir && !vendor
                      ? {
                          name: dir.name,
                          category: dir.category,
                          contactPerson: dir.contactPerson ?? '',
                          contactPhone: dir.phone ?? '',
                          contactWhatsapp: dir.whatsapp ?? '',
                        }
                      : {}),
                  });
                }}
              >
                <SelectTrigger aria-label="Pick from vendor directory"><SelectValue placeholder="Pick a saved vendor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— New / ad-hoc vendor —</SelectItem>
                  {directory.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name} ({vendorCategoryLabel(d.category)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vd-name">Vendor name</Label>
              <Input id="vd-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vd-cat">Category</Label>
              <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
                <SelectTrigger id="vd-cat"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VENDOR_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{vendorCategoryLabel(c)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vd-person">Contact person</Label>
              <Input id="vd-person" value={f.contactPerson ?? ''} onChange={(e) => setF({ ...f, contactPerson: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vd-phone">Phone</Label>
              <Input id="vd-phone" value={f.contactPhone ?? ''} onChange={(e) => setF({ ...f, contactPhone: e.target.value })} placeholder="+20 1XX XXX XXXX" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vd-wa">WhatsApp</Label>
              <Input id="vd-wa" value={f.contactWhatsapp ?? ''} onChange={(e) => setF({ ...f, contactWhatsapp: e.target.value })} placeholder="+20 1XX XXX XXXX" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vd-status">Confirmation status</Label>
              <Select value={f.confirmationStatus} onValueChange={(v) => setF({ ...f, confirmationStatus: v })}>
                <SelectTrigger id="vd-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VENDOR_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vd-arrival">Arrival time</Label>
              <Input id="vd-arrival" type="time" value={f.arrivalTime ?? ''} onChange={(e) => setF({ ...f, arrivalTime: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vd-setup">Setup time</Label>
              <Input id="vd-setup" type="time" value={f.setupTime ?? ''} onChange={(e) => setF({ ...f, setupTime: e.target.value })} />
            </div>
            {teamMembers.length > 0 && (
              <div className="space-y-1.5">
                <Label>Responsible member</Label>
                <Select value={f.responsibleId ?? 'none'} onValueChange={(v) => setF({ ...f, responsibleId: v })}>
                  <SelectTrigger aria-label="Responsible team member"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {teamMembers.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {canSeeFin && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="vd-contract">Contract amount</Label>
                  <Input id="vd-contract" type="number" min={0} step="0.01" value={f.contractAmount ?? 0}
                    disabled={!canFinance}
                    onChange={(e) => setF({ ...f, contractAmount: Number(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vd-deposit">Deposit amount</Label>
                  <Input id="vd-deposit" type="number" min={0} step="0.01" value={f.depositAmount ?? 0}
                    disabled={!canFinance}
                    onChange={(e) => setF({ ...f, depositAmount: Number(e.target.value) || 0 })} />
                </div>
                {canFinance && (
                  <div className="space-y-1.5">
                    <Label htmlFor="vd-paid">Paid to date</Label>
                    <Input id="vd-paid" type="number" min={0} step="0.01" value={f.paidAmount ?? 0}
                      onChange={(e) => setF({ ...f, paidAmount: Number(e.target.value) || 0 })} />
                  </div>
                )}
              </>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vd-notes">Operational notes</Label>
            <Textarea id="vd-notes" rows={2} value={f.operationalNotes ?? ''} onChange={(e) => setF({ ...f, operationalNotes: e.target.value })}
              placeholder="Access instructions, loading dock, contact preferences…" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : vendor ? 'Save vendor' : 'Engage vendor'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function defaultVendorForm(): VendorFormValues {
  return {
    vendorId: null, name: '', category: 'VENUE', contactPerson: '', contactPhone: '',
    contactWhatsapp: '', confirmationStatus: 'NOT_CONTACTED', arrivalTime: '', setupTime: '',
    responsibleId: 'none', operationalNotes: '', contractAmount: 0, depositAmount: 0, paidAmount: 0,
  };
}
