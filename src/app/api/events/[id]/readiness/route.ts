import { ok, requireEventAccess, requireSession, route } from '@/lib/api';
import { computeReadinessForEvents } from '@/lib/event-data';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/events/:id/readiness — transparent readiness breakdown
export const GET = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  const event = await requireEventAccess(auth, id);
  const map = await computeReadinessForEvents([event]);
  return ok({ readiness: map.get(event.id) ?? null });
});
