import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError, audit, ok, parseBody, requireSession, route,
} from '@/lib/api';

// GET /api/notices — CEO (team.manage) sees company notices;
// Finance (notices.create) sees the notices they raised.
export const GET = route(async (req: Request) => {
  const auth = await requireSession(req);
  if (!auth.perms.has('team.manage') && !auth.perms.has('notices.create')) {
    throw new ApiError(403, 'Forbidden: missing notice permission');
  }
  const where: Record<string, unknown> = { companyId: auth.companyId };
  if (!auth.perms.has('team.manage')) where.fromUserId = auth.id;

  const notices = await db.notice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      fromUser: { select: { id: true, name: true, role: true } },
      event: { select: { id: true, name: true } },
    },
  });
  return ok({
    notices: notices.map((n) => ({
      id: n.id,
      level: n.level,
      message: n.message,
      createdAt: n.createdAt,
      readAt: n.readAt,
      eventId: n.eventId,
      eventName: n.event?.name ?? null,
      fromUserId: n.fromUserId,
      fromUserName: n.fromUser.name,
      fromUserRole: n.fromUser.role,
    })),
  });
});

// POST /api/notices — raise a financial-risk / attention flag to the CEO.
// Requires notices.create (Finance & CEO by default).
export const POST = route(async (req: Request) => {
  const auth = await requireSession(req);
  if (!auth.perms.has('notices.create')) {
    throw new ApiError(403, 'Forbidden: missing permission "notices.create"');
  }
  const body = await parseBody(req, z.object({
    eventId: z.string().optional().nullable(),
    level: z.enum(['INFO', 'WARNING', 'CRITICAL']).default('WARNING'),
    message: z.string().trim().min(5, 'Message is required').max(500),
  }));

  let eventId: string | null = null;
  if (body.eventId) {
    const event = await db.event.findFirst({ where: { id: body.eventId, companyId: auth.companyId } });
    if (!event) throw new ApiError(404, 'Event not found');
    eventId = event.id;
  }

  const created = await db.notice.create({
    data: {
      companyId: auth.companyId,
      eventId,
      fromUserId: auth.id,
      level: body.level,
      message: body.message,
    },
  });
  await audit(auth, {
    action: 'notice.created',
    entityType: 'Notice',
    entityId: created.id,
    eventId,
    summary: `Raised ${body.level} notice to the CEO${eventId ? ' (event-scoped)' : ''}`,
  });
  return ok({ notice: { id: created.id } }, { status: 201 });
});
