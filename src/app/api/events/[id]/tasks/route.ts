import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError, audit, ok, parseBody, requireEventAccess, requireSession, route,
} from '@/lib/api';
import { serializeTask } from '@/lib/serialize';
import { TASK_PRIORITIES, TASK_STATUSES } from '@/lib/constants';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/events/:id/tasks
export const GET = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  const event = await requireEventAccess(auth, id);
  if (!auth.perms.has('tasks.view') && !auth.perms.has('tasks.manage')) {
    throw new ApiError(403, 'Forbidden: missing task permission');
  }
  const tasks = await db.task.findMany({
    where: { eventId: event.id },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    include: {
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { comments: true } },
    },
  });
  const now = new Date();
  return ok({
    tasks: tasks.map((t) => ({
      ...serializeTask(t),
      // Overdue flag consumed by the tasks tab (red card/badge) — kept
      // consistent with GET /api/tasks (display uses `now`).
      isOverdue: t.dueDate !== null && t.dueDate < now && t.status !== 'COMPLETED',
    })),
  });
});

// POST /api/events/:id/tasks
const createSchema = z.object({
  title: z.string().trim().min(2, 'Task title is required'),
  description: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  priority: z.enum(TASK_PRIORITIES).default('MEDIUM'),
  status: z.enum(TASK_STATUSES).default('TODO'),
  dueDate: z.string().optional().nullable(),
});

export const POST = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  const event = await requireEventAccess(auth, id);
  if (!auth.perms.has('tasks.manage')) {
    throw new ApiError(403, 'Forbidden: missing permission "tasks.manage"');
  }
  const body = await parseBody(req, createSchema);

  if (body.assignedToId) {
    const member = await db.user.findFirst({
      where: { id: body.assignedToId, companyId: auth.companyId, status: { not: 'DISABLED' } },
    });
    if (!member) throw new ApiError(400, 'Assignee not found in this company');
  }

  const created = await db.task.create({
    data: {
      companyId: auth.companyId,
      eventId: event.id,
      title: body.title,
      description: body.description || null,
      assignedToId: body.assignedToId || null,
      createdById: auth.id,
      priority: body.priority,
      status: body.status,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      completedAt: body.status === 'COMPLETED' ? new Date() : null,
    },
  });

  await audit(auth, {
    action: 'task.created',
    entityType: 'Task',
    entityId: created.id,
    eventId: event.id,
    summary: `Created task "${created.title}" (${created.priority}) on "${event.name}"`,
  });
  return ok({ task: { id: created.id } }, { status: 201 });
});
