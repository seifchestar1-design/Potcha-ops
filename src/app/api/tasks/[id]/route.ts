import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError, audit, ok, parseBody, requireEventAccess, requireSession, route,
} from '@/lib/api';
import { TASK_PRIORITIES, TASK_STATUSES } from '@/lib/constants';

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().trim().min(2).optional(),
  description: z.string().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  dueDate: z.string().nullable().optional(),
});

async function loadTask(auth: Parameters<typeof requireSession>[0], id: string) {
  const task = await db.task.findFirst({
    where: { id, companyId: auth.companyId },
    include: { event: { select: { id: true, name: true, companyId: true } } },
  });
  if (!task) throw new ApiError(404, 'Task not found');
  // Re-check event-level access (Operations: only assigned events)
  await requireEventAccess(auth, task.eventId);
  return task;
}

// PATCH /api/tasks/:id — update (tasks.manage)
export const PATCH = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  const task = await loadTask(auth, id);
  if (!auth.perms.has('tasks.manage')) {
    throw new ApiError(403, 'Forbidden: missing permission "tasks.manage"');
  }
  const body = await parseBody(req, patchSchema);

  if (body.assignedToId) {
    const member = await db.user.findFirst({
      where: { id: body.assignedToId, companyId: auth.companyId, status: { not: 'DISABLED' } },
    });
    if (!member) throw new ApiError(400, 'Assignee not found in this company');
  }

  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === 'dueDate') {
      if (v !== undefined) data.dueDate = v ? new Date(v as string) : null;
    } else if (v !== undefined) {
      data[k] = v === '' ? null : v;
    }
  }
  if (body.status === 'COMPLETED' && task.status !== 'COMPLETED') data.completedAt = new Date();
  if (body.status && body.status !== 'COMPLETED') data.completedAt = null;

  await db.task.update({ where: { id: task.id }, data });

  const action = body.status === 'COMPLETED' && task.status !== 'COMPLETED' ? 'task.completed' : 'task.updated';
  await audit(auth, {
    action,
    entityType: 'Task',
    entityId: task.id,
    eventId: task.eventId,
    summary: action === 'task.completed' ? `Completed task "${task.title}"` : `Updated task "${task.title}"`,
    metadata: { status: body.status ?? task.status, priority: body.priority ?? task.priority },
  });
  return ok({ success: true });
});

// DELETE /api/tasks/:id — creator or events.edit
export const DELETE = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  const task = await loadTask(auth, id);
  const mayDelete = task.createdById === auth.id || auth.perms.has('events.edit');
  if (!mayDelete) throw new ApiError(403, 'Only the task creator or the CEO can delete a task');

  await db.task.delete({ where: { id: task.id } });
  await audit(auth, {
    action: 'task.deleted',
    entityType: 'Task',
    entityId: task.id,
    eventId: task.eventId,
    summary: `Deleted task "${task.title}"`,
  });
  return ok({ success: true });
});
