'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { api, ApiClientError } from '@/lib/client/api';
import type { TaskRow, EventRow, TeamMemberRow } from '@/lib/client/types';
import { TASK_PRIORITIES, TASK_STATUSES } from '@/lib/constants';
import { toInputDate, fmtDateTime } from '@/lib/client/format';
import { useAppStore } from '@/components/app/store';

export function TaskDialog({
  open,
  onOpenChange,
  task,
  presetEventId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task?: TaskRow | null;
  presetEventId?: string;
  onSaved?: () => void;
}) {
  const user = useAppStore((s) => s.user);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    eventId: presetEventId ?? '',
    title: '',
    description: '',
    assignedToId: 'none',
    priority: 'MEDIUM',
    status: 'TODO',
    dueDate: '',
  });

  const { data: events } = useQuery({
    queryKey: ['events', ''],
    queryFn: () => api<{ events: EventRow[] }>('/events'),
    enabled: open && !presetEventId,
  });
  const { data: team } = useQuery({
    queryKey: ['team'],
    queryFn: () => api<{ members: TeamMemberRow[] }>('/team'),
    enabled: open && !!user?.perms.includes('team.manage'),
  });

  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setError(null);
      setF(
        task
          ? {
              eventId: task.eventId,
              title: task.title,
              description: task.description ?? '',
              assignedToId: task.assignedToId ?? 'none',
              priority: task.priority,
              status: task.status,
              dueDate: toInputDate(task.dueDate),
            }
          : {
              eventId: presetEventId ?? '',
              title: '', description: '', assignedToId: 'none',
              priority: 'MEDIUM', status: 'TODO', dueDate: '',
            }
      );
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        title: f.title,
        description: f.description || null,
        assignedToId: f.assignedToId === 'none' ? null : f.assignedToId,
        priority: f.priority,
        status: f.status,
        dueDate: f.dueDate ? new Date(f.dueDate).toISOString() : null,
      };
      if (task) {
        await api(`/tasks/${task.id}`, { method: 'PATCH', body });
        toast.success('Task updated');
      } else {
        await api(`/events/${f.eventId}/tasks`, { method: 'POST', body });
        toast.success('Task created');
      }
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['event-tasks', f.eventId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onSaved?.();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const members = (team?.members ?? []).filter((m) => m.status !== 'DISABLED');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit task' : 'New task'}</DialogTitle>
          <DialogDescription>Operational task with owner, priority and due date.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            {!presetEventId && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Event</Label>
                <Select value={f.eventId} onValueChange={(v) => setF({ ...f, eventId: v })}>
                  <SelectTrigger aria-label="Select event"><SelectValue placeholder="Choose an event" /></SelectTrigger>
                  <SelectContent>
                    {(events?.events ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tk-title">Title</Label>
              <Input id="tk-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required minLength={2} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tk-desc">Description</Label>
              <Textarea id="tk-desc" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </div>
            {members.length > 0 && (
              <div className="space-y-1.5">
                <Label>Assignee</Label>
                <Select value={f.assignedToId} onValueChange={(v) => setF({ ...f, assignedToId: v })}>
                  <SelectTrigger aria-label="Assignee"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v })}>
                <SelectTrigger aria-label="Priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p.toLowerCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
                <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tk-due">Due date</Label>
              <Input id="tk-due" type="datetime-local" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || (!task && !f.eventId)}>{busy ? 'Saving…' : task ? 'Save task' : 'Create task'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TaskCommentsDialog({
  task,
  onOpenChange,
}: {
  task: TaskRow | null;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');

  const { data } = useQuery({
    queryKey: ['task-comments', task?.id],
    queryFn: () => api<{ comments: { id: string; body: string; createdAt: string; userName: string; userRole: string }[] }>(`/tasks/${task!.id}/comments`),
    enabled: !!task,
  });

  const add = useMutation({
    mutationFn: () => api(`/tasks/${task!.id}/comments`, { method: 'POST', body: { body } }),
    onSuccess: () => {
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['task-comments', task?.id] });
      queryClient.invalidateQueries({ queryKey: ['event-tasks', task?.eventId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={!!task} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-8 text-base leading-snug">{task?.title}</DialogTitle>
          <DialogDescription>
            {task?.eventName} · {task?.priority.toLowerCase()} priority
            {task?.dueDate ? ` · due ${fmtDateTime(task.dueDate, 'dd MMM, HH:mm')}` : ''}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-72 rounded-lg border p-3">
          {(data?.comments ?? []).length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No comments yet.</p>
          ) : (
            <ul className="space-y-3">
              {(data?.comments ?? []).map((c) => (
                <li key={c.id}>
                  <p className="text-xs font-medium">{c.userName} <span className="font-normal text-muted-foreground">· {c.userRole}</span></p>
                  <p className="mt-0.5 text-xs leading-relaxed">{c.body}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{fmtDateTime(c.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) add.mutate();
          }}
        >
          <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a comment…" maxLength={1000} />
          <Button type="submit" size="sm" disabled={!body.trim() || add.isPending}>Send</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
