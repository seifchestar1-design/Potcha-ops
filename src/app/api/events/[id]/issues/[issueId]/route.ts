import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError, audit, ok, parseBody, requireEventAccess, requireSession, route,
} from '@/lib/api';
import { ISSUE_STATUSES, TASK_PRIORITIES } from '@/lib/constants';

type Ctx = { params: Promise<{ id: string; issueId: string }> };

const patchSchema = z.object({
  title: z.string().trim().min(2).optional(),
  description: z.string().nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assignedToId: z.string().nullable().optional(),
  status: z.enum(ISSUE_STATUSES).optional(),
  resolutionNotes: z.string().nullable().optional(),
});

// PATCH /api/events/:id/issues/:issueId — update / resolve
export const PATCH = route<{ id: string; issueId: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id, issueId } = await ctx.params;
  const event = await requireEventAccess(auth, id);
  if (!auth.perms.has('issues.manage')) {
    throw new ApiError(403, 'Forbidden: missing permission "issues.manage"');
  }
  const issue = await db.issue.findFirst({
    where: { id: issueId, eventId: event.id, companyId: auth.companyId },
  });
  if (!issue) throw new ApiError(404, 'Issue not found');
  const body = await parseBody(req, patchSchema);

  if (body.assignedToId) {
    const member = await db.user.findFirst({
      where: { id: body.assignedToId, companyId: auth.companyId, status: { not: 'DISABLED' } },
    });
    if (!member) throw new ApiError(400, 'Assignee not found in this company');
  }

  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined) data[k] = v === '' ? null : v;
  }
  if (body.status === 'RESOLVED' && issue.status !== 'RESOLVED') {
    data.resolvedAt = new Date();
  }
  if (body.status && body.status !== 'RESOLVED') {
    data.resolvedAt = null;
  }

  await db.issue.update({ where: { id: issue.id }, data });

  const action = body.status === 'RESOLVED' ? 'issue.resolved' : 'issue.updated';
  await audit(auth, {
    action,
    entityType: 'Issue',
    entityId: issue.id,
    eventId: event.id,
    summary:
      action === 'issue.resolved'
        ? `Resolved issue "${issue.title}"`
        : `Updated issue "${issue.title}"`,
    metadata: { status: body.status ?? issue.status, priority: body.priority ?? issue.priority },
  });
  return ok({ success: true });
});
