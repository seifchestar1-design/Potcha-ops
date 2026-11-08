import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError, audit, ok, parseBody, requireEventAccess, requireSession, route,
} from '@/lib/api';
import { serializeIssue } from '@/lib/serialize';
import { ISSUE_STATUSES, TASK_PRIORITIES } from '@/lib/constants';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/events/:id/issues
export const GET = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  const event = await requireEventAccess(auth, id);
  if (!auth.perms.has('issues.view') && !auth.perms.has('issues.manage')) {
    throw new ApiError(403, 'Forbidden: missing issue permission');
  }
  const issues = await db.issue.findMany({
    where: { eventId: event.id },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      assignedTo: { select: { id: true, name: true } },
      event: { select: { id: true, name: true } },
    },
  });
  return ok({ issues: issues.map((i) => serializeIssue(i)) });
});

// POST /api/events/:id/issues
const createSchema = z.object({
  title: z.string().trim().min(2, 'Issue title is required'),
  description: z.string().optional().nullable(),
  priority: z.enum(TASK_PRIORITIES).default('MEDIUM'),
  assignedToId: z.string().optional().nullable(),
});

export const POST = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  const event = await requireEventAccess(auth, id);
  if (!auth.perms.has('issues.manage')) {
    throw new ApiError(403, 'Forbidden: missing permission "issues.manage"');
  }
  const body = await parseBody(req, createSchema);

  if (body.assignedToId) {
    const member = await db.user.findFirst({
      where: { id: body.assignedToId, companyId: auth.companyId, status: { not: 'DISABLED' } },
    });
    if (!member) throw new ApiError(400, 'Assignee not found in this company');
  }

  const created = await db.issue.create({
    data: {
      companyId: auth.companyId,
      eventId: event.id,
      title: body.title,
      description: body.description || null,
      priority: body.priority,
      assignedToId: body.assignedToId || null,
      status: 'OPEN',
    },
  });

  await audit(auth, {
    action: 'issue.created',
    entityType: 'Issue',
    entityId: created.id,
    eventId: event.id,
    summary: `Reported issue "${created.title}" (${created.priority}) on "${event.name}"`,
  });
  return ok({ issue: { id: created.id } }, { status: 201 });
});
