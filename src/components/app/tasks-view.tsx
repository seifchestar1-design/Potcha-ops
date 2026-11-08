'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, ListChecks, MessageSquare, Pencil, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/client/api';
import type { TaskRow } from '@/lib/client/types';
import { TASK_STATUSES, TASK_PRIORITIES } from '@/lib/constants';
import { fmtDate } from '@/lib/client/format';
import { useAppStore } from '@/components/app/store';
import { navigate } from '@/components/app/router';
import { StatusBadge } from '@/components/app/ui/status-badge';
import { PageHeader } from '@/components/app/ui/page-header';
import { EmptyState } from '@/components/app/ui/empty-state';
import { TaskDialog, TaskCommentsDialog } from '@/components/app/ui/task-dialog';

export function TasksView() {
  const user = useAppStore((s) => s.user);
  const queryClient = useQueryClient();
  const canManage = user?.perms.includes('tasks.manage') ?? false;
  // Deep-link support: dashboard KPIs navigate here as #/tasks?due=OVERDUE
  // (or ?due=TODAY / ?due=UPCOMING) — read the filter once on mount.
  const [due, setDue] = useState<'ALL' | 'TODAY' | 'OVERDUE' | 'UPCOMING'>(() => {
    if (typeof window === 'undefined') return 'ALL';
    const qs = window.location.hash.split('?')[1] ?? '';
    const v = (new URLSearchParams(qs).get('due') ?? '').toUpperCase();
    return v === 'TODAY' || v === 'OVERDUE' || v === 'UPCOMING' ? v : 'ALL';
  });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('OPEN');
  const [priority, setPriority] = useState('ALL');
  const [assignee, setAssignee] = useState('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [commenting, setCommenting] = useState<TaskRow | null>(null);

  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (status !== 'ALL' && status !== 'OPEN') params.set('status', status);
  if (priority !== 'ALL') params.set('priority', priority);
  if (assignee === 'ME') params.set('assignedTo', 'me');
  if (due !== 'ALL') params.set('due', due.toLowerCase());

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', q, status, priority, assignee, due],
    queryFn: () => api<{ tasks: TaskRow[] }>(`/tasks?${params.toString()}`),
  });

  const toggleDone = useMutation({
    mutationFn: ({ id, status: s }: { id: string; status: string }) =>
      api(`/tasks/${id}`, { method: 'PATCH', body: { status: s } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => toast.error(e.message),
  });

  // Client-side: OPEN = not completed (when no explicit status filter)
  const tasks = (data?.tasks ?? []).filter((t) =>
    status === 'OPEN' ? t.status !== 'COMPLETED' : true
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tasks"
        description={user?.role === 'OPERATIONS' ? 'Operational tasks across your assigned events' : 'Operational tasks across all company events'}
        actions={canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" aria-hidden /> New task
          </Button>
        )}
      />

      {/* Filters */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <div className="relative col-span-2 sm:col-span-3 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks…" className="pl-9" aria-label="Search tasks" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Filter status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="ALL">All statuses</SelectItem>
            {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger aria-label="Filter priority"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Any priority</SelectItem>
            {TASK_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p.toLowerCase()}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger aria-label="Filter assignee"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Anyone</SelectItem>
            <SelectItem value="ME">Assigned to me</SelectItem>
          </SelectContent>
        </Select>
        <Select value={due} onValueChange={setDue}>
          <SelectTrigger aria-label="Filter due date"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Any date</SelectItem>
            <SelectItem value="TODAY">Due today</SelectItem>
            <SelectItem value="OVERDUE">Overdue</SelectItem>
            <SelectItem value="UPCOMING">Upcoming</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No tasks match the filters"
          description="Adjust the filters, or create a new task."
          action={canManage && <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" aria-hidden /> New task</Button>}
        />
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <Card key={t.id} className={t.isOverdue ? 'border-red-500/40' : undefined}>
              <CardContent className="flex items-start gap-3 p-3.5">
                {canManage && (
                  <Checkbox
                    className="mt-1"
                    checked={t.status === 'COMPLETED'}
                    aria-label={t.status === 'COMPLETED' ? `Reopen ${t.title}` : `Complete ${t.title}`}
                    onCheckedChange={(checked) => toggleDone.mutate({ id: t.id, status: checked ? 'COMPLETED' : 'TODO' })}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`truncate text-sm font-medium ${t.status === 'COMPLETED' ? 'text-muted-foreground line-through' : ''}`}>
                      {t.title}
                    </p>
                    <StatusBadge kind="priority" value={t.priority} />
                    {t.status !== 'COMPLETED' && <StatusBadge kind="task" value={t.status} />}
                  </div>
                  {t.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{t.description}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    <button className="underline-offset-2 hover:underline" onClick={() => navigate(`/events/${t.eventId}/tasks`)}>
                      {t.eventName ?? 'Event'}
                    </button>
                    {' · '}
                    {t.assignedToName ?? 'Unassigned'}
                    {t.dueDate ? (
                      <>
                        {' · '}
                        <span className={t.isOverdue ? 'font-medium text-red-600 dark:text-red-400' : ''}>
                          due {fmtDate(t.dueDate)}{t.isOverdue ? ' (overdue)' : ''}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label="Comments" onClick={() => setCommenting(t)}>
                    <MessageSquare className="h-4 w-4" />
                    {(t.commentCount ?? 0) > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                        {t.commentCount}
                      </span>
                    )}
                  </Button>
                  {canManage && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Edit task" onClick={() => setEditing(t)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TaskDialog open={createOpen} onOpenChange={setCreateOpen} />
      {editing && <TaskDialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)} task={editing} />}
      <TaskCommentsDialog task={commenting} onOpenChange={(v) => !v && setCommenting(null)} />
    </div>
  );
}
