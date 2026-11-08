import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError, audit, ok, parseBody, requireEventAccess, requireSession, route,
} from '@/lib/api';
import { serializeEvent } from '@/lib/serialize';
import { computeReadinessForEvents, computeFinancialsForEvents } from '@/lib/event-data';
import { EVENT_STATUSES } from '@/lib/constants';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/events/:id — full event header + readiness (+ financials if permitted)
export const GET = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  // includeRefs: hydrate planner + assignments so serializeEvent can populate
  // plannerName and assignedUserIds. Without this the edit form would round-
  // trip an empty assignee list and PATCH would wipe existing assignments.
  const event = await requireEventAccess(auth, id, { includeRefs: true });

  const [assignments, readinessMap, finMap] = await Promise.all([
    db.eventAssignment.findMany({
      where: { eventId: event.id },
      include: { user: { select: { id: true, name: true, role: true } } },
    }),
    computeReadinessForEvents([event]),
    auth.perms.has('finance.view') ? computeFinancialsForEvents([event]) : null,
  ]);

  return ok({
    event: {
      ...serializeEvent(auth, event),
      team: assignments.map((a) => ({
        userId: a.userId,
        name: a.user.name,
        role: a.user.role,
        roleNote: a.roleNote,
      })),
      readiness: readinessMap.get(event.id) ?? null,
      financials: finMap?.get(event.id) ?? null,
    },
    readiness: readinessMap.get(event.id) ?? null,
    financials: finMap?.get(event.id) ?? null,
  });
});

// PATCH /api/events/:id — edit (events.edit — CEO by default)
const patchSchema = z.object({
  name: z.string().trim().min(2).optional(),
  clientName: z.string().trim().min(2).optional(),
  clientPhone: z.string().trim().nullable().optional(),
  clientEmail: z.string().trim().email().nullable().optional().or(z.literal('')),
  eventDate: z.string().optional(),
  venue: z.string().trim().nullable().optional(),
  venueAddress: z.string().trim().nullable().optional(),
  guestCount: z.number().int().min(0).optional(),
  eventType: z.enum(['WEDDING', 'ENGAGEMENT', 'HENNA', 'RECEPTION', 'OTHER']).optional(),
  contractValue: z.number().min(0).optional(),
  additionalRevenue: z.number().min(0).optional(),
  status: z.enum(EVENT_STATUSES).optional(),
  plannerId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  assignedUserIds: z.array(z.string()).optional(),
  confirmName: z.string().optional(), // required for ARCHIVED / DELETE flows client-side
});

export const PATCH = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  const event = await requireEventAccess(auth, id);
  if (!auth.perms.has('events.edit')) {
    throw new ApiError(403, 'Forbidden: missing permission "events.edit"');
  }
  const body = await parseBody(req, patchSchema);

  // Tenant check on planner / assignees
  const memberIds = [body.plannerId, ...(body.assignedUserIds ?? [])].filter(Boolean) as string[];
  if (memberIds.length > 0) {
    const count = await db.user.count({ where: { id: { in: memberIds }, companyId: auth.companyId } });
    if (count !== new Set(memberIds).size) throw new ApiError(400, 'Assignee is not a member of this company');
  }

  const data: Record<string, unknown> = {};
  const copy = (key: string) => {
    if ((body as Record<string, unknown>)[key] !== undefined) data[key] = (body as Record<string, unknown>)[key];
  };
  ['name', 'clientName', 'clientPhone', 'venue', 'venueAddress', 'guestCount',
    'eventType', 'status', 'notes', 'plannerId'].forEach(copy);
  if (body.clientEmail !== undefined) data.clientEmail = body.clientEmail || null;
  if (body.eventDate !== undefined) data.eventDate = new Date(body.eventDate);
  if (auth.perms.has('finance.view')) {
    if (body.contractValue !== undefined) data.contractValue = body.contractValue;
    if (body.additionalRevenue !== undefined) data.additionalRevenue = body.additionalRevenue;
  }

  const updated = await db.event.update({ where: { id: event.id }, data });

  if (body.assignedUserIds !== undefined) {
    await db.eventAssignment.deleteMany({ where: { eventId: event.id } });
    if (body.assignedUserIds.length > 0) {
      await db.eventAssignment.createMany({
        data: body.assignedUserIds.map((userId: string) => ({ eventId: event.id, userId })),
      });
    }
  }

  await audit(auth, {
    action: body.status && body.status !== event.status ? 'event.status_changed' : 'event.updated',
    entityType: 'Event',
    entityId: event.id,
    eventId: event.id,
    summary:
      body.status && body.status !== event.status
        ? `Status of "${updated.name}" changed ${event.status} → ${body.status}`
        : `Updated event "${updated.name}"`,
    metadata: { fields: Object.keys(data) },
  });
  return ok({ success: true });
});

// DELETE /api/events/:id — hard delete with typed confirmation (CEO)
const deleteSchema = z.object({ confirmName: z.string().min(1, 'Confirmation is required') });

export const DELETE = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  const event = await requireEventAccess(auth, id);
  if (!auth.perms.has('events.delete')) {
    throw new ApiError(403, 'Forbidden: missing permission "events.delete"');
  }
  const body = await parseBody(req, deleteSchema);
  if (body.confirmName !== event.name) {
    throw new ApiError(400, 'Confirmation failed — you must type the exact event name');
  }

  await db.event.delete({ where: { id: event.id } });
  await audit(auth, {
    action: 'event.deleted',
    entityType: 'Event',
    entityId: event.id,
    eventId: null,
    summary: `Deleted event "${event.name}" (all related records removed)`,
    metadata: { name: event.name },
  });
  return ok({ success: true });
});
