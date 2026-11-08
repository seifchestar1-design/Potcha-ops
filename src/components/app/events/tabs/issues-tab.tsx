'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, AlertTriangle, CheckCircle2, Pencil, ShieldAlert } from 'lucide-react';
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
import type { IssueRow } from '@/lib/client/types';
import { TASK_PRIORITIES, ISSUE_STATUSES } from '@/lib/constants';
import { fmtDateTime, fmtRelative } from '@/lib/client/format';
import { useAppStore } from '@/components/app/store';
import { StatusBadge } from '@/components/app/ui/status-badge';
import { EmptyState } from '@/components/app/ui/empty-state';

export function IssuesTab({ eventId }: { eventId: string }) {
  const user = useAppStore((s) => s.user);
  const queryClient = useQueryClient();
  const canManage = user?.perms.includes('issues.manage') ?? false;
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<IssueRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['event-issues', eventId],
    queryFn: () => api<{ issues: IssueRow[] }>(`/events/${eventId}/issues`),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['event-issues', eventId] });
    queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const onSubmit = async (values: Record<string, unknown>, id?: string) => {
    if (id) {
      await api(`/events/${eventId}/issues/${id}`, { method: 'PATCH', body: values });
      toast.success('Issue updated');
    } else {
      await api(`/events/${eventId}/issues`, { method: 'POST', body: values });
      toast.success('Issue recorded');
    }
    invalidate();
  };

  const issues = data?.issues ?? [];
  const open = issues.filter((i) => i.status !== 'RESOLVED');
  const resolved = issues.filter((i) => i.status === 'RESOLVED');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {open.length} open · {resolved.length} resolved
        </p>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" aria-hidden /> Report issue
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : issues.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No issues recorded"
          description="Anything that goes wrong on an event gets logged here with an owner and resolution."
        />
      ) : (
        <div className="space-y-4">
          {open.length > 0 && (
            <div className="space-y-2">
              {open.some((i) => i.priority === 'CRITICAL' || i.priority === 'HIGH') && (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                  <ShieldAlert className="h-4 w-4" aria-hidden /> Critical issues are highlighted — they lower the readiness score.
                </p>
              )}
              {open.map((i) => (
                <Card key={i.id} className={i.priority === 'CRITICAL' ? 'border-red-500/50 bg-red-500/5' : i.priority === 'HIGH' ? 'border-orange-500/40' : undefined}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{i.title}</p>
                          <StatusBadge kind="priority" value={i.priority} />
                          <StatusBadge kind="issue" value={i.status} />
                        </div>
                        {i.description && <p className="mt-1 text-sm text-muted-foreground">{i.description}</p>}
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          {i.assignedToName ? `Assigned to ${i.assignedToName} · ` : ''}
                          reported {fmtRelative(i.createdAt)}
                        </p>
                      </div>
                      {canManage && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Edit issue"
                          onClick={() => setEditing(i)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {resolved.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Resolved</p>
              {resolved.map((i) => (
                <Card key={i.id} className="opacity-75">
                  <CardContent className="p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium line-through decoration-muted-foreground/50">{i.title}</p>
                          <StatusBadge kind="issue" value={i.status} />
                        </div>
                        {i.resolutionNotes && (
                          <p className="mt-1 text-xs text-muted-foreground">Resolution: {i.resolutionNotes}</p>
                        )}
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          resolved {i.resolvedAt ? fmtDateTime(i.resolvedAt, 'dd MMM yyyy') : ''}
                        </p>
                      </div>
                      {canManage && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Edit issue"
                          onClick={() => setEditing(i)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <IssueDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={onSubmit}
      />
      {editing && (
        <IssueDialog
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          issue={editing}
          onSubmit={onSubmit}
        />
      )}
    </div>
  );
}

function IssueDialog({
  open, onOpenChange, issue, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  issue?: IssueRow | null;
  onSubmit: (values: Record<string, unknown>, id?: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    title: '', description: '', priority: 'MEDIUM', status: 'OPEN', resolutionNotes: '',
  });

  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setError(null);
      setF(
        issue
          ? {
              title: issue.title,
              description: issue.description ?? '',
              priority: issue.priority,
              status: issue.status,
              resolutionNotes: issue.resolutionNotes ?? '',
            }
          : { title: '', description: '', priority: 'MEDIUM', status: 'OPEN', resolutionNotes: '' }
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
          title: f.title,
          description: f.description || null,
          priority: f.priority,
          ...(issue ? { status: f.status, resolutionNotes: f.resolutionNotes || null } : {}),
        },
        issue?.id
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
          <DialogTitle>{issue ? 'Update issue' : 'Report an issue'}</DialogTitle>
          <DialogDescription>Log anything that threatens the event — the team and CEO can see it.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="is-title">Issue title</Label>
              <Input id="is-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required minLength={2} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="is-desc">Description</Label>
              <Textarea id="is-desc" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v })}>
                <SelectTrigger aria-label="Priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p.toLowerCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {issue && (
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
                  <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ISSUE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {issue && f.status === 'RESOLVED' && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="is-resolution">Resolution notes</Label>
                <Textarea id="is-resolution" rows={2} value={f.resolutionNotes} onChange={(e) => setF({ ...f, resolutionNotes: e.target.value })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : issue ? 'Save issue' : 'Report issue'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
