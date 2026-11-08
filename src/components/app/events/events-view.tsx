'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Search, CalendarDays, Inbox, MoreHorizontal, Pencil, Archive, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/client/api';
import type { EventRow, TeamMemberRow, LimitsData } from '@/lib/client/types';
import { EVENT_STATUSES } from '@/lib/constants';
import { fmtDate, countdownLabel, formatMoney, eventTypeLabel } from '@/lib/client/format';
import { useAppStore } from '@/components/app/store';
import { navigate } from '@/components/app/router';
import { StatusBadge } from '@/components/app/ui/status-badge';
import { ReadinessRing } from '@/components/app/ui/readiness-ring';
import { PageHeader } from '@/components/app/ui/page-header';
import { EmptyState } from '@/components/app/ui/empty-state';
import { ConfirmDialog } from '@/components/app/ui/confirm-dialog';
import { EventFormDialog, type EventFormValues } from './event-form-dialog';

export function EventsView() {
  const user = useAppStore((s) => s.user);
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<EventRow | null>(null);
  const [deleteEvent, setDeleteEvent] = useState<EventRow | null>(null);
  const [archiveEvent, setArchiveEvent] = useState<EventRow | null>(null);

  const canCreate = user?.perms.includes('events.create') ?? false;
  const canEdit = user?.perms.includes('events.edit') ?? false;
  const canDelete = user?.perms.includes('events.delete') ?? false;
  const canFin = user?.perms.includes('finance.view') ?? false;
  const cur = user?.currency ?? 'EGP';

  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (status !== 'ALL' && status !== 'ACTIVE') params.set('status', status);
  if (status === 'ACTIVE' || includeArchived) params.set('includeArchived', '1');

  const { data, isLoading } = useQuery({
    queryKey: ['events', q, status],
    queryFn: () => api<{ events: EventRow[] }>(`/events?${params.toString()}`),
  });

  // Platform-admin event quota — shown as a badge; the New event button is
  // disabled when the quota is exhausted (the API rejects with 409 anyway).
  const { data: limits } = useQuery({
    queryKey: ['limits'],
    queryFn: () => api<LimitsData>('/limits'),
    staleTime: 30_000,
  });
  const eventsFull = !!limits?.events && limits.events.used >= limits.events.max;

  const events = (data?.events ?? []).filter((e) =>
    status === 'ACTIVE' ? e.status !== 'ARCHIVED' && e.status !== 'COMPLETED' : true
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['limits'] });
  };

  const archive = useMutation({
    mutationFn: (id: string) =>
      api(`/events/${id}`, { method: 'PATCH', body: { status: 'ARCHIVED' } }),
    onSuccess: () => {
      toast.success('Event archived');
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/events/${id}`, { method: 'DELETE', body: { confirmName: deleteEvent?.name } }),
    onSuccess: () => {
      toast.success('Event permanently deleted', {
        description: 'All related vendors, payments, tasks and documents were removed. The deletion is recorded in the audit log.',
      });
      setDeleteEvent(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const onSubmit = async (values: EventFormValues, id?: string) => {
    if (id) {
      await api(`/events/${id}`, { method: 'PATCH', body: values });
      toast.success('Event updated');
    } else {
      await api('/events', { method: 'POST', body: values });
      toast.success('Event created');
    }
    invalidate();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Events"
        description={
          user?.role === 'OPERATIONS'
            ? 'Weddings you are assigned to'
            : 'All company events — pipeline, preparation and delivery'
        }
        actions={
          canCreate && (
            <div className="flex flex-wrap items-center gap-2">
              {limits?.events && (
                <Badge
                  variant={eventsFull ? 'destructive' : 'outline'}
                  className="text-[10px] tabular"
                  aria-label={`${limits.events.used} of ${limits.events.max} events used`}
                >
                  {limits.events.used} / {limits.events.max} events
                </Badge>
              )}
              <Button
                size="sm"
                onClick={() => setCreateOpen(true)}
                disabled={eventsFull}
                title={eventsFull ? 'Event limit reached — ask the platform administrator to raise the limit' : undefined}
              >
                <Plus className="mr-1 h-4 w-4" aria-hidden /> New event
              </Button>
            </div>
          )
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by event, client or venue…"
            className="pl-9"
            aria-label="Search events"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE">Active events</SelectItem>
            <SelectItem value="ALL">All statuses</SelectItem>
            {EVENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No events found"
          description={
            q || status !== 'ACTIVE'
              ? 'Try clearing the filters.'
              : user?.role === 'OPERATIONS'
                ? 'You have no assigned events yet. Ask your CEO to assign you to an event.'
                : 'Create your first event to start planning.'
          }
          action={canCreate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" aria-hidden /> New event
            </Button>
          )}
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Ready</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Guests</TableHead>
                    {canFin && <TableHead className="text-right">Contract</TableHead>}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((e) => (
                    <TableRow
                      key={e.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/events/${e.id}/overview`)}
                    >
                      <TableCell><ReadinessRing readiness={e.readiness} size={42} /></TableCell>
                      <TableCell className="max-w-64">
                        <p className="truncate font-medium">{e.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{e.clientName} · {e.venue ?? 'Venue TBD'}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{fmtDate(e.eventDate)}</p>
                        <p className="text-xs text-muted-foreground">{countdownLabel(e.eventDate)}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge kind="event" value={e.status} />
                          <span className="text-[10px] text-muted-foreground">{eventTypeLabel(e.eventType)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular">{e.guestCount}</TableCell>
                      {canFin && (
                        <TableCell className="text-right tabular font-medium">
                          {formatMoney(e.contractValue ?? 0, cur)}
                        </TableCell>
                      )}
                      <TableCell className="text-right" onClick={(ev) => ev.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${e.name}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/events/${e.id}/overview`)}>
                              <CalendarDays className="h-4 w-4" /> Open workspace
                            </DropdownMenuItem>
                            {canEdit && (
                              <DropdownMenuItem onClick={() => setEditEvent(e)}>
                                <Pencil className="h-4 w-4" /> Edit event
                              </DropdownMenuItem>
                            )}
                            {canEdit && e.status !== 'ARCHIVED' && (
                              <DropdownMenuItem onClick={() => setArchiveEvent(e)}>
                                <Archive className="h-4 w-4" /> Archive
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem variant="destructive" onClick={() => setDeleteEvent(e)}>
                                <Trash2 className="h-4 w-4" /> Delete permanently…
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {events.map((e) => (
              <Card key={e.id} className="cursor-pointer transition-colors hover:bg-accent/30" onClick={() => navigate(`/events/${e.id}/overview`)}>
                <CardContent className="flex items-center gap-3 p-3.5">
                  <ReadinessRing readiness={e.readiness} size={46} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{e.clientName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {fmtDate(e.eventDate)} · {countdownLabel(e.eventDate)}
                    </p>
                  </div>
                  <StatusBadge kind="event" value={e.status} />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Dialogs */}
      {canCreate && (
        <EventFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSubmit={onSubmit}
        />
      )}
      {editEvent && (
        <EventFormDialog
          open={!!editEvent}
          onOpenChange={(v) => !v && setEditEvent(null)}
          event={editEvent}
          onSubmit={onSubmit}
        />
      )}

      <ConfirmDialog
        open={!!archiveEvent}
        onOpenChange={(v) => !v && setArchiveEvent(null)}
        title={`Archive "${archiveEvent?.name}"?`}
        description="The event moves out of active lists but keeps all its records. You can find it under 'All statuses'."
        confirmLabel="Archive event"
        destructive={false}
        onConfirm={() => archiveEvent && archive.mutate(archiveEvent.id)}
      />

      <ConfirmDialog
        open={!!deleteEvent}
        onOpenChange={(v) => !v && setDeleteEvent(null)}
        title={`Delete "${deleteEvent?.name}"?`}
        description="This permanently removes the event and all its vendors, payments, tasks, run sheet, issues and documents. This cannot be undone and is recorded in the audit log."
        confirmLabel="Delete permanently"
        requireText={deleteEvent?.name}
        onConfirm={() => deleteEvent && remove.mutate(deleteEvent.id)}
      />
    </div>
  );
}
