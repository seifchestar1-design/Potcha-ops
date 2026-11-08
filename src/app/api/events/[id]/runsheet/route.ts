import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError, audit, ok, parseBody, requireEventAccess, requireSession, route,
} from '@/lib/api';
import { serializeRunSheetItem } from '@/lib/serialize';
import { RUNSHEET_STATUSES } from '@/lib/constants';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/events/:id/runsheet — the wedding-day timeline
export const GET = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  const event = await requireEventAccess(auth, id);
  if (!auth.perms.has('runsheet.view') && !auth.perms.has('runsheet.manage')) {
    throw new ApiError(403, 'Forbidden: missing run sheet permission');
  }
  const items = await db.runSheetItem.findMany({
    where: { eventId: event.id },
    orderBy: [{ sortOrder: 'asc' }],
    include: {
      responsible: { select: { id: true, name: true } },
      eventVendor: { select: { id: true, name: true } },
    },
  });
  return ok({ items: items.map(serializeRunSheetItem) });
});

// POST /api/events/:id/runsheet — add timeline item (runsheet.manage)
const createSchema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM (24h)'),
  activity: z.string().trim().min(2, 'Activity is required'),
  responsibleId: z.string().optional().nullable(),
  responsibleName: z.string().trim().optional().nullable(),
  eventVendorId: z.string().optional().nullable(),
  location: z.string().trim().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(RUNSHEET_STATUSES).default('PENDING'),
});

export const POST = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  const event = await requireEventAccess(auth, id);
  if (!auth.perms.has('runsheet.manage')) {
    throw new ApiError(403, 'Forbidden: missing permission "runsheet.manage"');
  }
  const body = await parseBody(req, createSchema);

  if (body.eventVendorId) {
    const ev = await db.eventVendor.findFirst({ where: { id: body.eventVendorId, eventId: event.id } });
    if (!ev) throw new ApiError(400, 'Vendor not found on this event');
  }
  if (body.responsibleId) {
    const member = await db.user.findFirst({
      where: { id: body.responsibleId, companyId: auth.companyId, status: { not: 'DISABLED' } },
    });
    if (!member) throw new ApiError(400, 'Responsible member not found in this company');
  }

  const maxOrder = await db.runSheetItem.aggregate({
    where: { eventId: event.id },
    _max: { sortOrder: true },
  });
  const created = await db.runSheetItem.create({
    data: {
      eventId: event.id,
      time: body.time,
      activity: body.activity,
      responsibleId: body.responsibleId || null,
      responsibleName: body.responsibleName || null,
      eventVendorId: body.eventVendorId || null,
      location: body.location || null,
      notes: body.notes || null,
      status: body.status,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  await audit(auth, {
    action: 'runsheet.item_added',
    entityType: 'RunSheetItem',
    entityId: created.id,
    eventId: event.id,
    summary: `Added run sheet item ${created.time} — ${created.activity} on "${event.name}"`,
  });
  return ok({ item: { id: created.id } }, { status: 201 });
});
