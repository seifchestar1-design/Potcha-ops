'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, CheckCircle2, MessageSquare, Pencil, ListChecks, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/lib/client/api';
import type { TaskRow } from '@/lib/client/types';
import { TASK_STATUSES } from '@/lib/constants';
import { fmtDate } from '@/lib/client/format';
import { useAppStore } from '@/components/app/store';
import { StatusBadge } from '@/components/app/ui/status-badge';
import { EmptyState } from '@/components/app/ui/empty-state';
import { TaskDialog, TaskCommentsDialog } from '@/components/app/ui/task-dialog';

export function TasksTab({ eventId }: { eventId: string }) {
  const user = useAppStore((s) => s.user);
  const queryClient = useQueryClient();
  const canManage = user?.perms.includes('tasks.manage') ?? false;
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [commenting, setCommenting] = useState<TaskRow | null>(null);
  const [statusFilter, setStatusFilter] = useState('OPEN');

  const { data, isLoading } = useQuery({
    queryKey: ['event-tasks', eventId],
    queryFn: () => api<{ tasks: TaskRow[] }>(`/events/${eventId}/tasks`),
  });

  const toggleDone = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/tasks/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-tasks', eventId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    },
    onError: (e) => toast.error(e.message),
  });

  const tasks = (data?.tasks ?? []).filter((t) =>
    statusFilter === 'OPEN' ? t.status !== 'COMPLETED' : true
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {['OPEN', 'ALL', ...TASK_STATUSES].map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? 'secondary' : 'ghost'}
              className="h-7 px-2.5 text-xs"
              onClick={() => setStatusFilter(s)}
            >
              {s === 'OPEN' ? 'Open' : s === 'ALL' ? 'All' : s.replace(/_/g, ' ').toLowerCase()}
            </Button>
          ))}
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" aria-hidden /> New task
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={statusFilter === 'OPEN' ? 'No open tasks' : 'No tasks yet'}
          description={canManage ? 'Create tasks for setup, client approvals, vendor follow-ups and day-of logistics.' : 'The team will add tasks here.'}
          action={canManage && (
            <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" aria-hidden /> New task</Button>
          )}
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
                    onCheckedChange={(checked) =>
                      toggleDone.mutate({ id: t.id, status: checked ? 'COMPLETED' : 'TODO' })
                    }
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
                  {t.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t.assignedToName ? `Assigned to ${t.assignedToName} · ` : 'Unassigned · '}
                    {t.dueDate ? (
                      <span className={t.isOverdue ? 'font-medium text-red-600 dark:text-red-400' : ''}>
                        due {fmtDate(t.dueDate)}{t.isOverdue ? ' (overdue)' : ''}
                      </span>
                    ) : 'no due date'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Button variant="ghost" size="icon" className="relative h-7 w-7" aria-label="Comments"
                    onClick={() => setCommenting(t)}>
                    <MessageSquare className="h-3.5 w-3.5" />
                    {(t.commentCount ?? 0) > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                        {t.commentCount}
                      </span>
                    )}
                  </Button>
                  {canManage && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Edit task"
                      onClick={() => setEditing(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TaskDialog open={createOpen} onOpenChange={setCreateOpen} presetEventId={eventId} />
      {editing && (
        <TaskDialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)} task={editing} />
      )}
      <TaskCommentsDialog task={commenting} onOpenChange={(v) => !v && setCommenting(null)} />
    </div>
  );
}
