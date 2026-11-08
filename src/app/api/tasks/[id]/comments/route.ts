import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError, audit, ok, parseBody, requireEventAccess, requireSession, route,
} from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

async function loadTask(auth: Parameters<typeof requireSession>[0], id: string) {
  const task = await db.task.findFirst({ where: { id, companyId: auth.companyId } });
  if (!task) throw new ApiError(404, 'Task not found');
  await requireEventAccess(auth, task.eventId); // event-level RBAC
  return task;
}

// GET /api/tasks/:id/comments
export const GET = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  const task = await loadTask(auth, id);
  if (!auth.perms.has('tasks.view') && !auth.perms.has('tasks.manage')) {
    throw new ApiError(403, 'Forbidden: missing task permission');
  }
  const comments = await db.taskComment.findMany({
    where: { taskId: task.id },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { id: true, name: true, role: true } } },
  });
  return ok({
    comments: comments.map((c) => ({
      id: c.id, body: c.body, createdAt: c.createdAt,
      userId: c.userId, userName: c.user.name, userRole: c.user.role,
    })),
  });
});

// POST /api/tasks/:id/comments
export const POST = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  const task = await loadTask(auth, id);
  const body = await parseBody(req, z.object({ body: z.string().trim().min(1).max(1000) }));

  const created = await db.taskComment.create({
    data: { taskId: task.id, userId: auth.id, body: body.body },
  });
  await audit(auth, {
    action: 'task.commented',
    entityType: 'Task',
    entityId: task.id,
    eventId: task.eventId,
    summary: `Commented on task "${task.title}"`,
  });
  return ok({ comment: { id: created.id } }, { status: 201 });
});
