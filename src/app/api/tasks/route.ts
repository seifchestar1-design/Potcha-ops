import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError, audit, ok, parseBody, requireSession, route,
} from '@/lib/api';
import { serializeTask } from '@/lib/serialize';
import { TASK_PRIORITIES, TASK_STATUSES } from '@/lib/constants';
import { visibleEventsWhere } from '@/lib/event-data';

// GET /api/tasks — global task list with filters.
// Operations: tasks on their assigned events. Finance (tasks.view): all.
export const GET = route(async (req: Request) => {
  const auth = await requireSession(req);
  if (!auth.perms.has('tasks.view') && !auth.perms.has('tasks.manage')) {
    throw new ApiError(403, 'Forbidden: missing task permission');
  }
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const priority = url.searchParams.get('priority');
  const assignedTo = url.searchParams.get('assignedTo');
  const eventId = url.searchParams.get('eventId');
  const due = url.searchParams.get('due'); // today | overdue | upcoming
  const q = url.searchParams.get('q')?.trim().toLowerCase() ?? '';

  const where: Record<string, unknown> = {
    companyId: auth.companyId,
    event: visibleEventsWhere(auth),
  };
  if (status && TASK_STATUSES.includes(status as (typeof TASK_STATUSES)[number])) where.status = status;
  if (priority && TASK_PRIORITIES.includes(priority as (typeof TASK_PRIORITIES)[number])) where.priority = priority;
  if (assignedTo === 'me') where.assignedToId = auth.id;
  else if (assignedTo) where.assignedToId = assignedTo;
  if (eventId) where.eventId = eventId;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  if (due === 'today') where.dueDate = { gte: startOfToday, lte: endOfToday };
  else if (due === 'overdue') where.dueDate = { lt: startOfToday };
  else if (due === 'upcoming') where.dueDate = { gte: startOfToday };
  if (q) where.title = { contains: q };

  const tasks = await db.task.findMany({
    where,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    include: {
      event: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { comments: true } },
    },
    take: 300,
  });

  const now = new Date();
  return ok({
    tasks: tasks.map((t) => ({
      ...serializeTask(t),
      isOverdue: t.dueDate !== null && t.dueDate < now && t.status !== 'COMPLETED',
    })),
  });
});
