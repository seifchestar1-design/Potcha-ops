'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus, Printer, ArrowUp, ArrowDown, Trash2, Pencil, Clock3, MapPin, User, ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api, ApiClientError } from '@/lib/client/api';
import type { RunSheetItemRow, EventVendorRow } from '@/lib/client/types';
import { RUNSHEET_STATUSES } from '@/lib/constants';
import { useAppStore } from '@/components/app/store';
import { StatusBadge } from '@/components/app/ui/status-badge';
import { EmptyState } from '@/components/app/ui/empty-state';
import { ConfirmDialog } from '@/components/app/ui/confirm-dialog';

type RunFormValues = {
  time: string;
  activity: string;
  responsibleId?: string | null;
  responsibleName?: string | null;
  eventVendorId?: string | null;
  location?: string | null;
  notes?: string | null;
  status?: string;
};

export function RunSheetTab({ eventId }: { eventId: string }) {
  const user = useAppStore((s) => s.user);
  const queryClient = useQueryClient();
  const canManage = user?.perms.includes('runsheet.manage') ?? false;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RunSheetItemRow | null>(null);
  const [deleting, setDeleting] = useState<RunSheetItemRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['runsheet', eventId],
    queryFn: () => api<{ items: RunSheetItemRow[] }>(`/events/${eventId}/runsheet`),
  });
  const { data: vendors } = useQuery({
    queryKey: ['event-vendors', eventId],
    queryFn: () => api<{ vendors: EventVendorRow[] }>(`/events/${eventId}/vendors`),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['runsheet', eventId] });
    queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const mutate = useMutation({
    mutationFn: ({ id, body, move }: { id?: string; body?: RunFormValues; move?: 'up' | 'down' }) => {
      if (move) return api(`/events/${eventId}/runsheet/${id}`, { method: 'PATCH', body: { move } });
      if (id) return api(`/events/${eventId}/runsheet/${id}`, { method: 'PATCH', body });
      return api(`/events/${eventId}/runsheet`, { method: 'POST', body });
    },
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/events/${eventId}/runsheet/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Run sheet item removed'); setDeleting(null); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const onSubmit = async (values: RunFormValues, id?: string) => {
    await mutate.mutateAsync({ id, body: values });
    toast.success(id ? 'Run sheet updated' : 'Timeline item added');
  };

  const items = data?.items ?? [];
  const done = items.filter((i) => i.status === 'DONE').length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 no-print">
        <p className="text-sm text-muted-foreground">
          {items.length} timeline items · {done} completed ({items.length ? Math.round((done / items.length) * 100) : 0}%)
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" aria-hidden /> Print run sheet
          </Button>
          {canManage && (
            <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="mr-1 h-4 w-4" aria-hidden /> Add item
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="The wedding-day run sheet is empty"
          description={canManage
            ? 'Build the minute-by-minute timeline: venue access, vendor arrivals, setup, zaffa, dinner, cake and send-off.'
            : 'The run sheet will appear here once the operations team builds it.'}
        />
      ) : (
        // Print area
        <div className="print-area space-y-2">
          {items.map((item, idx) => (
            <Card
              key={item.id}
              className={
                item.status === 'DELAYED'
                  ? 'border-red-500/40 bg-red-500/5'
                  : item.status === 'DONE'
                    ? 'opacity-70'
                    : undefined
              }
            >
              <CardContent className="flex items-start gap-3 p-3.5">
                <div className="flex w-16 shrink-0 flex-col items-center">
                  <p className={`text-sm font-bold tabular ${item.status === 'DELAYED' ? 'text-red-600 dark:text-red-400' : ''}`}>
                    {item.time}
                  </p>
                  <StatusBadge kind="runsheet" value={item.status} className="mt-1" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${item.status === 'DONE' ? 'text-muted-foreground line-through' : ''}`}>
                    {item.activity}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    {(item.responsibleName) && (
                      <span className="inline-flex items-center gap-1"><User className="h-3 w-3" aria-hidden /> {item.responsibleName}</span>
                    )}
                    {item.eventVendorName && (
                      <span className="inline-flex items-center gap-1">
                        <ClipboardList className="h-3 w-3" aria-hidden /> {item.eventVendorName}
                      </span>
                    )}
                    {item.location && (
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden /> {item.location}</span>
                    )}
                  </div>
                  {item.notes && <p className="mt-1 text-xs italic text-muted-foreground">{item.notes}</p>}
                </div>
                {canManage && (
                  <div className="flex shrink-0 flex-col gap-0.5 no-print">
                    <div className="flex">
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0}
                        aria-label="Move up" onClick={() => mutate.mutate({ id: item.id, move: 'up' })}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === items.length - 1}
                        aria-label="Move down" onClick={() => mutate.mutate({ id: item.id, move: 'down' })}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Edit item"
                        onClick={() => { setEditing(item); setDialogOpen(true); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" aria-label="Delete item"
                        onClick={() => setDeleting(item)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex justify-end">
                      <Select
                        value={item.status}
                        onValueChange={(v) => mutate.mutate({ id: item.id, body: { status: v } })}
                      >
                        <SelectTrigger className="h-6 w-28 text-[10px]" aria-label={`Set status for ${item.activity}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RUNSHEET_STATUSES.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">
                              {s === 'PENDING' ? 'Pending' : s === 'IN_PROGRESS' ? 'Running' : s === 'DONE' ? 'Done' : 'Delayed'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RunItemDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }}
        item={editing}
        vendors={vendors?.vendors ?? []}
        onSubmit={onSubmit}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Remove "${deleting?.activity}"?`}
        description="This timeline item is removed from the run sheet."
        confirmLabel="Remove"
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}

function RunItemDialog({
  open, onOpenChange, item, vendors, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: RunSheetItemRow | null;
  vendors: EventVendorRow[];
  onSubmit: (values: RunFormValues, id?: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState<RunFormValues>({ time: '', activity: '', responsibleName: '', eventVendorId: 'none', location: '', notes: '' });

  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setError(null);
      setF(
        item
          ? {
              time: item.time,
              activity: item.activity,
              responsibleId: item.responsibleId,
              responsibleName: item.responsibleId ? null : (item.responsibleName ?? ''),
              eventVendorId: item.eventVendorId ?? 'none',
              location: item.location ?? '',
              notes: item.notes ?? '',
              status: item.status,
            }
          : { time: '', activity: '', responsibleName: '', eventVendorId: 'none', location: '', notes: '' }
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
          eventVendorId: f.eventVendorId === 'none' ? null : f.eventVendorId,
        },
        item?.id
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit timeline item' : 'Add timeline item'}</DialogTitle>
          <DialogDescription>Wedding-day schedule entry with time, owner and location.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rs-time">Time (24h)</Label>
              <Input id="rs-time" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rs-location">Location</Label>
              <Input id="rs-location" placeholder="e.g. Grand Ballroom" value={f.location ?? ''} onChange={(e) => setF({ ...f, location: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="rs-activity">Activity</Label>
              <Input id="rs-activity" placeholder="e.g. Zaffa & couple entrance" value={f.activity} onChange={(e) => setF({ ...f, activity: e.target.value })} required minLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rs-owner">Responsible (free text)</Label>
              <Input id="rs-owner" placeholder="e.g. Dina / MC / Security lead" value={f.responsibleName ?? ''} onChange={(e) => setF({ ...f, responsibleName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Vendor involved</Label>
              <Select value={f.eventVendorId ?? 'none'} onValueChange={(v) => setF({ ...f, eventVendorId: v })}>
                <SelectTrigger aria-label="Vendor involved"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="rs-notes">Notes</Label>
              <Textarea id="rs-notes" rows={2} placeholder="Sound check at 16:30, confirm entrance song with MC…" value={f.notes ?? ''} onChange={(e) => setF({ ...f, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : item ? 'Save item' : 'Add to run sheet'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
