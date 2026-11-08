import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, audit, ok, parseBody, requireSession, route } from '@/lib/api';
import { serializeEvent } from '@/lib/serialize';
import { visibleEventsWhere, computeReadinessForEvents, computeFinancialsForEvents } from '@/lib/event-data';
import { EVENT_STATUSES } from '@/lib/constants';

// GET /api/events — role-scoped list with readiness + financial rollups
export const GET = route(async (req: Request) => {
  const auth = await requireSession(req);
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const q = url.searchParams.get('q')?.trim().toLowerCase() ?? '';
  const includeArchived = url.searchParams.get('includeArchived') === '1';

  const where: Record<string, unknown> = visibleEventsWhere(auth);
  if (status && EVENT_STATUSES.includes(status as (typeof EVENT_STATUSES)[number])) {
    where.status = status;
  } else if (!includeArchived) {
    where.status = { not: 'ARCHIVED' };
  }
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { clientName: { contains: q } },
      { venue: { contains: q } },
    ];
  }

  const events = await db.event.findMany({
    where,
    orderBy: [{ eventDate: 'asc' }],
    include: {
      planner: { select: { id: true, name: true } },
      assignments: { select: { userId: true, roleNote: true } },
    },
  });

  const readiness = await computeReadinessForEvents(events);
  const canFin = auth.perms.has('finance.view');
  const financials = canFin ? await computeFinancialsForEvents(events) : null;

  return ok({
    events: events.map((e) => ({
      ...serializeEvent(auth, e),
      readiness: readiness.get(e.id) ?? null,
      financials: financials?.get(e.id) ?? null,
    })),
  });
});

// POST /api/events — create (CEO)
const createSchema = z.object({
  name: z.string().trim().min(2, 'Event name is required'),
  clientName: z.string().trim().min(2, 'Client name is required'),
  clientPhone: z.string().trim().optional().nullable(),
  clientEmail: z.string().trim().email().optional().nullable().or(z.literal('')),
  eventDate: z.string().datetime({ offset: true }).or(z.string().min(4)),
  venue: z.string().trim().optional().nullable(),
  venueAddress: z.string().trim().optional().nullable(),
  guestCount: z.number().int().min(0).default(0),
  eventType: z.enum(['WEDDING', 'ENGAGEMENT', 'HENNA', 'RECEPTION', 'OTHER']).default('WEDDING'),
  contractValue: z.number().min(0).default(0),
  additionalRevenue: z.number().min(0).default(0),
  status: z.enum(EVENT_STATUSES).default('LEAD'),
  plannerId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  assignedUserIds: z.array(z.string()).default([]),
});

export const POST = route(async (req: Request) => {
  const auth = await requireSession(req);
  if (!auth.perms.has('events.create')) throw new ApiError(403, 'Forbidden: missing permission "events.create"');
  const body = await parseBody(req, createSchema);

  // Platform-admin event quota: concurrent non-archived events. Archiving
  // an event frees its slot.
  const company = await db.company.findUnique({
    where: { id: auth.companyId },
    select: { maxEvents: true },
  });
  const eventsUsed = await db.event.count({
    where: { companyId: auth.companyId, status: { not: 'ARCHIVED' } },
  });
  if (company && eventsUsed >= company.maxEvents) {
    throw new ApiError(
      409,
      `Event limit reached (${eventsUsed}/${company.maxEvents} events). Archive a completed event or ask the platform administrator to raise the limit.`
    );
  }

  // Planner / assignees must belong to this company
  const memberIds = [body.plannerId, ...body.assignedUserIds].filter(Boolean) as string[];
  if (memberIds.length > 0) {
    const count = await db.user.count({ where: { id: { in: memberIds }, companyId: auth.companyId, status: { not: 'DISABLED' } } });
    if (count !== new Set(memberIds).size) throw new ApiError(400, 'Planner or assignee is not a member of this company');
  }

  const event = await db.event.create({
    data: {
      companyId: auth.companyId,
      name: body.name,
      clientName: body.clientName,
      clientPhone: body.clientPhone || null,
      clientEmail: body.clientEmail || null,
      eventDate: new Date(body.eventDate),
      venue: body.venue || null,
      venueAddress: body.venueAddress || null,
      guestCount: body.guestCount,
      eventType: body.eventType,
      contractValue: body.contractValue,
      additionalRevenue: body.additionalRevenue,
      status: body.status,
      plannerId: body.plannerId || null,
      notes: body.notes || null,
      assignments: {
        create: body.assignedUserIds.map((userId: string) => ({ userId })),
      },
    },
  });

  await audit(auth, {
    action: 'event.created',
    entityType: 'Event',
    entityId: event.id,
    eventId: event.id,
    summary: `Created event "${event.name}"`,
    metadata: { status: event.status },
  });
  return ok({ event: { id: event.id } }, { status: 201 });
});
