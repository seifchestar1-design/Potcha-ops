import { db } from '@/lib/db';
import { ok, requireSession, route } from '@/lib/api';
import { visibleEventsWhere, computeReadinessForEvents, computeFinancialsForEvents } from '@/lib/event-data';

// GET /api/reports — report summary page data (role-aware)
export const GET = route(async (req: Request) => {
  const auth = await requireSession(req);
  const events = await db.event.findMany({
    where: visibleEventsWhere(auth),
    orderBy: { eventDate: 'asc' },
    include: { planner: { select: { name: true } } },
  });
  const readinessMap = await computeReadinessForEvents(events);
  const canFin = auth.perms.has('finance.view');
  const finMap = canFin ? await computeFinancialsForEvents(events.filter((e) => e.status !== 'ARCHIVED')) : null;

  const rows = events.map((e) => ({
    id: e.id,
    name: e.name,
    clientName: e.clientName,
    eventDate: e.eventDate,
    status: e.status,
    venue: e.venue,
    guestCount: e.guestCount,
    plannerName: e.planner?.name ?? null,
    readinessScore: readinessMap.get(e.id)?.score ?? null,
    readinessBand: readinessMap.get(e.id)?.band ?? null,
    ...(canFin
      ? {
          totalRevenue: finMap?.get(e.id)?.totalRevenue ?? null,
          collected: finMap?.get(e.id)?.collectedFromClient ?? null,
          outstanding: finMap?.get(e.id)?.outstandingClientBalance ?? null,
          plannedExpenses: finMap?.get(e.id)?.plannedExpenses ?? null,
          actualExpenses: finMap?.get(e.id)?.actualExpenses ?? null,
          estimatedProfit: finMap?.get(e.id)?.grossEstimatedProfit ?? null,
          margin: finMap?.get(e.id)?.profitMargin ?? null,
        }
      : {}),
  }));

  return ok({
    currency: auth.currency,
    canExportFinancial: auth.perms.has('finance.export'),
    canExportEvents: auth.perms.has('events.view.all'),
    canExportTasks: auth.perms.has('tasks.view'),
    canExportVendors: auth.perms.has('vendors.contacts.view'),
    events: rows,
  });
});
