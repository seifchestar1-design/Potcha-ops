import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError, audit, ok, parseBody, requireEventAccess, requireSession, route,
} from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/events/:id/assignments — assign a team member (events.edit)
export const POST = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  const event = await requireEventAccess(auth, id);
  if (!auth.perms.has('events.edit')) {
    throw new ApiError(403, 'Forbidden: missing permission "events.edit"');
  }
  const body = await parseBody(req, z.object({
    userId: z.string().min(1),
    roleNote: z.string().trim().max(80).optional().nullable(),
  }));

  const member = await db.user.findFirst({
    where: { id: body.userId, companyId: auth.companyId, status: { not: 'DISABLED' } },
  });
  if (!member) throw new ApiError(400, 'Member not found in this company');

  const existing = await db.eventAssignment.findFirst({
    where: { eventId: event.id, userId: member.id },
  });
  if (existing) throw new ApiError(409, 'This member is already assigned to the event');

  await db.eventAssignment.create({
    data: { eventId: event.id, userId: member.id, roleNote: body.roleNote || null },
  });
  await audit(auth, {
    action: 'event.member_assigned',
    entityType: 'Event',
    entityId: event.id,
    eventId: event.id,
    summary: `Assigned ${member.name} to "${event.name}"`,
  });
  return ok({ success: true }, { status: 201 });
});

// DELETE /api/events/:id/assignments?userId=...
export const DELETE = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  const event = await requireEventAccess(auth, id);
  if (!auth.perms.has('events.edit')) {
    throw new ApiError(403, 'Forbidden: missing permission "events.edit"');
  }
  const userId = new URL(req.url).searchParams.get('userId');
  if (!userId) throw new ApiError(400, 'userId query parameter is required');

  const assignment = await db.eventAssignment.findFirst({
    where: { eventId: event.id, userId },
  });
  if (!assignment) throw new ApiError(404, 'Assignment not found');

  await db.eventAssignment.delete({ where: { id: assignment.id } });
  const member = await db.user.findUnique({ where: { id: userId } });
  await audit(auth, {
    action: 'event.member_unassigned',
    entityType: 'Event',
    entityId: event.id,
    eventId: event.id,
    summary: `Unassigned ${member?.name ?? userId} from "${event.name}"`,
  });
  return ok({ success: true });
});
