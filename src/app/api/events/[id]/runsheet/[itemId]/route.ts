import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError, audit, ok, parseBody, requireEventAccess, requireSession, route,
} from '@/lib/api';
import { RUNSHEET_STATUSES } from '@/lib/constants';

type Ctx = { params: Promise<{ id: string; itemId: string }> };

const patchSchema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  activity: z.string().trim().min(2).optional(),
  responsibleId: z.string().nullable().optional(),
  responsibleName: z.string().trim().nullable().optional(),
  eventVendorId: z.string().nullable().optional(),
  location: z.string().trim().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(RUNSHEET_STATUSES).optional(),
  move: z.enum(['up', 'down']).optional(),
});

async function loadItem(auth: Parameters<typeof requireEventAccess>[0], eventId: string, itemId: string) {
  const event = await requireEventAccess(auth, eventId);
  const item = await db.runSheetItem.findFirst({
    where: { id: itemId, eventId: event.id, event: { companyId: auth.companyId } },
  });
  if (!item) throw new ApiError(404, 'Run sheet item not found');
  return { event, item };
}

function requireRunSheetManage(perms: Set<string>) {
  if (!perms.has('runsheet.manage')) {
    throw new ApiError(403, 'Forbidden: missing permission "runsheet.manage"');
  }
}

// PATCH /api/events/:id/runsheet/:itemId — edit fields, status, or reorder
export const PATCH = route<{ id: string; itemId: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id, itemId } = await ctx.params;
  const { event, item } = await loadItem(auth, id, itemId);
  requireRunSheetManage(auth.perms);
  const body = await parseBody(req, patchSchema);

  if (body.responsibleId) {
    const member = await db.user.findFirst({
      where: { id: body.responsibleId, companyId: auth.companyId, status: { not: 'DISABLED' } },
    });
    if (!member) throw new ApiError(400, 'Responsible member not found in this company');
  }
  if (body.eventVendorId) {
    const ev = await db.eventVendor.findFirst({ where: { id: body.eventVendorId, eventId: event.id } });
    if (!ev) throw new ApiError(400, 'Vendor not found on this event');
  }

  // Reorder: swap sortOrder with the neighbour
  if (body.move) {
    const neighbour = await db.runSheetItem.findFirst({
      where: {
        eventId: event.id,
        sortOrder: body.move === 'up' ? { lt: item.sortOrder } : { gt: item.sortOrder },
      },
      orderBy: { sortOrder: body.move === 'up' ? 'desc' : 'asc' },
    });
    if (neighbour) {
      await db.$transaction([
        db.runSheetItem.update({ where: { id: item.id }, data: { sortOrder: neighbour.sortOrder } }),
        db.runSheetItem.update({ where: { id: neighbour.id }, data: { sortOrder: item.sortOrder } }),
      ]);
    }
  }

  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (['time', 'activity', 'responsibleId', 'responsibleName', 'eventVendorId', 'location', 'notes', 'status'].includes(k)) {
      if (v !== undefined) data[k] = v === '' ? null : v;
    }
  }
  if (Object.keys(data).length > 0) {
    await db.runSheetItem.update({ where: { id: item.id }, data });
  }

  const action =
    body.status && body.status !== item.status
      ? body.status === 'DONE'
        ? 'runsheet.item_completed'
        : 'runsheet.status_changed'
      : 'runsheet.updated';
  await audit(auth, {
    action,
    entityType: 'RunSheetItem',
    entityId: item.id,
    eventId: event.id,
    summary:
      action === 'runsheet.item_completed'
        ? `Completed run sheet item ${item.time} — ${item.activity}`
        : `Updated run sheet item ${item.time} — ${item.activity}`,
    metadata: { move: body.move, status: body.status },
  });
  return ok({ success: true });
});

// DELETE /api/events/:id/runsheet/:itemId
export const DELETE = route<{ id: string; itemId: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id, itemId } = await ctx.params;
  const { event, item } = await loadItem(auth, id, itemId);
  requireRunSheetManage(auth.perms);

  await db.runSheetItem.delete({ where: { id: item.id } });
  // Compact sort order
  const rest = await db.runSheetItem.findMany({
    where: { eventId: event.id },
    orderBy: { sortOrder: 'asc' },
    select: { id: true },
  });
  await db.$transaction(
    rest.map((r, i) => db.runSheetItem.update({ where: { id: r.id }, data: { sortOrder: i } }))
  );

  await audit(auth, {
    action: 'runsheet.item_deleted',
    entityType: 'RunSheetItem',
    entityId: item.id,
    eventId: event.id,
    summary: `Removed run sheet item ${item.time} — ${item.activity}`,
  });
  return ok({ success: true });
});
