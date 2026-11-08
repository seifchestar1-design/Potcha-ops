'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api, ApiClientError } from '@/lib/client/api';
import type { EventRow, TeamMemberRow } from '@/lib/client/types';
import { EVENT_STATUSES, EVENT_TYPES } from '@/lib/constants';
import { toInputDate } from '@/lib/client/format';
import { useAppStore } from '@/components/app/store';

export type EventFormValues = {
  name: string;
  clientName: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  eventDate: string;
  venue?: string | null;
  venueAddress?: string | null;
  guestCount: number;
  eventType: string;
  contractValue?: number;
  additionalRevenue?: number;
  status: string;
  plannerId?: string | null;
  notes?: string | null;
  assignedUserIds?: string[];
};

export function EventFormDialog({
  open,
  onOpenChange,
  event,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  event?: EventRow | null;
  onSubmit: (values: EventFormValues, id?: string) => Promise<void>;
}) {
  const user = useAppStore((s) => s.user);
  const canFin = user?.perms.includes('finance.view') ?? false;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: team } = useQuery({
    queryKey: ['team'],
    queryFn: () => api<{ members: TeamMemberRow[] }>('/team'),
    enabled: open && !!user?.perms.includes('team.manage'),
  });

  const [f, setF] = useState<EventFormValues>({
    name: '', clientName: '', clientPhone: '', clientEmail: '',
    eventDate: '', venue: '', venueAddress: '', guestCount: 0,
    eventType: 'WEDDING', contractValue: 0, additionalRevenue: 0,
    status: 'LEAD', plannerId: '', notes: '', assignedUserIds: [],
  });

  useEffect(() => {
    if (open) {
      setError(null);
      setF(
        event
          ? {
              name: event.name,
              clientName: event.clientName,
              clientPhone: event.clientPhone ?? '',
              clientEmail: event.clientEmail ?? '',
              eventDate: toInputDate(event.eventDate),
              venue: event.venue ?? '',
              venueAddress: event.venueAddress ?? '',
              guestCount: event.guestCount,
              eventType: event.eventType,
              contractValue: event.contractValue ?? 0,
              additionalRevenue: event.additionalRevenue ?? 0,
              status: event.status,
              plannerId: event.plannerId ?? '',
              notes: event.notes ?? '',
              assignedUserIds: event.assignedUserIds ?? [],
            }
          : {
              name: '', clientName: '', clientPhone: '', clientEmail: '',
              eventDate: '', venue: '', venueAddress: '', guestCount: 100,
              eventType: 'WEDDING', contractValue: 0, additionalRevenue: 0,
              status: 'LEAD', plannerId: user?.id ?? '', notes: '', assignedUserIds: [],
            }
      );
    }
  }, [open, event, user?.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(
        {
          ...f,
          clientEmail: f.clientEmail || null,
          plannerId: f.plannerId || null,
        },
        event?.id
      );
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const members = (team?.members ?? []).filter((m) => m.status !== 'DISABLED');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto scroll-slim sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{event ? 'Edit event' : 'New event'}</DialogTitle>
          <DialogDescription>
            {event
              ? 'Update the event record. Changes are audited.'
              : 'Create a wedding or event workspace for this client.'}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ev-name">Event name</Label>
              <Input id="ev-name" placeholder="e.g. Youssef & Mariam — Nile Wedding" value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-client">Client name(s)</Label>
              <Input id="ev-client" placeholder="e.g. Youssef & Mariam" value={f.clientName}
                onChange={(e) => setF({ ...f, clientName: e.target.value })} required minLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-phone">Client phone</Label>
              <Input id="ev-phone" placeholder="+20 1XX XXX XXXX" value={f.clientPhone ?? ''}
                onChange={(e) => setF({ ...f, clientPhone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-email">Client email</Label>
              <Input id="ev-email" type="email" placeholder="client@example.com" value={f.clientEmail ?? ''}
                onChange={(e) => setF({ ...f, clientEmail: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-date">Event date & time</Label>
              <Input id="ev-date" type="datetime-local" value={f.eventDate}
                onChange={(e) => setF({ ...f, eventDate: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-venue">Venue</Label>
              <Input id="ev-venue" placeholder="e.g. The Grand Nile Ballroom" value={f.venue ?? ''}
                onChange={(e) => setF({ ...f, venue: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-address">Venue address</Label>
              <Input id="ev-address" placeholder="Street, area, city" value={f.venueAddress ?? ''}
                onChange={(e) => setF({ ...f, venueAddress: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-guests">Guest count</Label>
              <Input id="ev-guests" type="number" min={0} value={f.guestCount}
                onChange={(e) => setF({ ...f, guestCount: Number(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-type">Event type</Label>
              <Select value={f.eventType} onValueChange={(v) => setF({ ...f, eventType: v })}>
                <SelectTrigger id="ev-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {canFin && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="ev-contract">Contract value (EGP)</Label>
                  <Input id="ev-contract" type="number" min={0} step="0.01" value={f.contractValue ?? 0}
                    onChange={(e) => setF({ ...f, contractValue: Number(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ev-addrev">Additional services revenue</Label>
                  <Input id="ev-addrev" type="number" min={0} step="0.01" value={f.additionalRevenue ?? 0}
                    onChange={(e) => setF({ ...f, additionalRevenue: Number(e.target.value) || 0 })} />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="ev-status">Status</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
                <SelectTrigger id="ev-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {members.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="ev-planner">Planner</Label>
                <Select value={f.plannerId ?? 'none'} onValueChange={(v) => setF({ ...f, plannerId: v === 'none' ? null : v })}>
                  <SelectTrigger id="ev-planner"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name} ({m.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {members.length > 0 && (
            <div className="space-y-1.5">
              <Label>Assigned team (Operations visibility)</Label>
              <ScrollArea className="h-28 rounded-lg border p-3">
                <div className="space-y-2">
                  {members.filter((m) => m.role !== 'CEO').map((m) => (
                    <label key={m.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={f.assignedUserIds?.includes(m.id) ?? false}
                        onCheckedChange={(checked) =>
                          setF({
                            ...f,
                            assignedUserIds: checked
                              ? [...(f.assignedUserIds ?? []), m.id]
                              : (f.assignedUserIds ?? []).filter((id) => id !== m.id),
                          })
                        }
                      />
                      <span>{m.name}</span>
                      <span className="text-[10px] text-muted-foreground">({m.role})</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
              <p className="text-[11px] text-muted-foreground">
                Operations users only see events they are assigned to.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ev-notes">Important notes</Label>
            <Textarea id="ev-notes" rows={3} placeholder="Special requirements, family dynamics, logistics…" value={f.notes ?? ''}
              onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : event ? 'Save changes' : 'Create event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
