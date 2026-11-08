'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Search, Building2, Pencil, Trash2, Phone, MessageCircle, User, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api, ApiClientError } from '@/lib/client/api';
import type { VendorRow } from '@/lib/client/types';
import { VENDOR_CATEGORIES } from '@/lib/constants';
import { vendorCategoryLabel } from '@/lib/client/format';
import { useAppStore } from '@/components/app/store';
import { PageHeader } from '@/components/app/ui/page-header';
import { EmptyState } from '@/components/app/ui/empty-state';
import { ConfirmDialog } from '@/components/app/ui/confirm-dialog';

type VendorFormValues = {
  name: string;
  category: string;
  contactPerson?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  notes?: string | null;
};

export function VendorsView() {
  const user = useAppStore((s) => s.user);
  const queryClient = useQueryClient();
  const canManage = user?.perms.includes('vendors.contacts.manage') ?? false;
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VendorRow | null>(null);
  const [deleting, setDeleting] = useState<VendorRow | null>(null);

  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (category !== 'ALL') params.set('category', category);

  const { data, isLoading } = useQuery({
    queryKey: ['vendors', q, category],
    queryFn: () => api<{ vendors: VendorRow[] }>(`/vendors?${params.toString()}`),
  });

  const onSubmit = async (values: VendorFormValues, id?: string) => {
    if (id) {
      await api(`/vendors/${id}`, { method: 'PATCH', body: values });
      toast.success('Vendor updated');
    } else {
      await api('/vendors', { method: 'POST', body: values });
      toast.success('Vendor added to directory');
    }
    queryClient.invalidateQueries({ queryKey: ['vendors'] });
  };

  const remove = useMutation({
    mutationFn: (id: string) => api(`/vendors/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Vendor deleted');
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const vendors = data?.vendors ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Vendor directory"
        description="Your company's saved vendor contacts — venues, catering, décor, photographers and more"
        actions={canManage && (
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" aria-hidden /> Add vendor
          </Button>
        )}
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, contact or phone…" className="pl-9" aria-label="Search vendors" />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Filter category"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {VENDOR_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{vendorCategoryLabel(c)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : vendors.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No vendors in the directory yet"
          description={canManage ? 'Add the vendors you work with — they can then be engaged on any event in one click.' : 'The team will build the vendor directory here.'}
          action={canManage && <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="mr-1 h-4 w-4" aria-hidden /> Add vendor</Button>}
        />
      ) : (
        <>
          <Card className="hidden md:block">
            <CardContent className="p-0">
              {/* table-fixed: max-width on <td> is ignored in auto layout —
                  keeps long vendor names from overlapping later columns. */}
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="w-36">Category</TableHead>
                    <TableHead className="w-36">Contact person</TableHead>
                    <TableHead className="w-44">Phone / WhatsApp</TableHead>
                    <TableHead>Email</TableHead>
                    {canManage && <TableHead className="w-20" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="px-2">
                        <p className="truncate font-medium">{v.name}</p>
                        {v.notes && <p className="truncate text-xs text-muted-foreground" title={v.notes}>{v.notes}</p>}
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{vendorCategoryLabel(v.category)}</Badge></TableCell>
                      <TableCell className="text-xs">{v.contactPerson ?? '—'}</TableCell>
                      <TableCell className="text-xs">
                        {v.phone ? (
                          <span className="block">{v.phone}</span>
                        ) : '—'}
                        {v.whatsapp && <span className="block text-muted-foreground">WA: {v.whatsapp}</span>}
                      </TableCell>
                      <TableCell className="px-2 text-xs"><p className="truncate" title={v.email ?? ''}>{v.email ?? '—'}</p></TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex gap-0.5">
                            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Edit ${v.name}`}
                              onClick={() => { setEditing(v); setDialogOpen(true); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label={`Delete ${v.name}`}
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

          <div className="space-y-2 md:hidden">
            {vendors.map((v) => (
              <Card key={v.id}>
                <CardContent className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{v.name}</p>
                      <Badge variant="outline" className="mt-1 text-[10px]">{vendorCategoryLabel(v.category)}</Badge>
                    </div>
                    {canManage && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Edit ${v.name}`}
                        onClick={() => { setEditing(v); setDialogOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {v.contactPerson && <p className="flex items-center gap-1.5"><User className="h-3 w-3" aria-hidden /> {v.contactPerson}</p>}
                    {v.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" aria-hidden /> {v.phone}</p>}
                    {v.whatsapp && <p className="flex items-center gap-1.5"><MessageCircle className="h-3 w-3" aria-hidden /> {v.whatsapp}</p>}
                    {v.email && <p className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3" aria-hidden /> {v.email}</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <VendorDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }}
        vendor={editing}
        onSubmit={onSubmit}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        description="The vendor is removed from the company directory. Vendors engaged on events must be removed from those events first."
        confirmLabel="Delete vendor"
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}

function VendorDialog({
  open, onOpenChange, vendor, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vendor: VendorRow | null;
  onSubmit: (values: VendorFormValues, id?: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState<VendorFormValues>({ name: '', category: 'VENUE', contactPerson: '', phone: '', whatsapp: '', email: '', notes: '' });

  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setError(null);
      setF(
        vendor
          ? {
              name: vendor.name, category: vendor.category,
              contactPerson: vendor.contactPerson ?? '', phone: vendor.phone ?? '',
              whatsapp: vendor.whatsapp ?? '', email: vendor.email ?? '', notes: vendor.notes ?? '',
            }
          : { name: '', category: 'VENUE', contactPerson: '', phone: '', whatsapp: '', email: '', notes: '' }
      );
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ ...f, email: f.email || null }, vendor?.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{vendor ? `Edit ${vendor.name}` : 'Add a vendor'}</DialogTitle>
          <DialogDescription>Company-level directory contact. Financial terms are set per event when the vendor is engaged.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vn-name">Vendor name</Label>
              <Input id="vn-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
                <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VENDOR_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{vendorCategoryLabel(c)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vn-person">Contact person</Label>
              <Input id="vn-person" value={f.contactPerson ?? ''} onChange={(e) => setF({ ...f, contactPerson: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vn-phone">Phone</Label>
              <Input id="vn-phone" value={f.phone ?? ''} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+20 1XX XXX XXXX" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vn-wa">WhatsApp</Label>
              <Input id="vn-wa" value={f.whatsapp ?? ''} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} placeholder="+20 1XX XXX XXXX" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vn-email">Email</Label>
              <Input id="vn-email" type="email" value={f.email ?? ''} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="vn-notes">Notes</Label>
              <Textarea id="vn-notes" rows={2} value={f.notes ?? ''} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Reliability, pricing style, past experience…" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : vendor ? 'Save vendor' : 'Add vendor'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
