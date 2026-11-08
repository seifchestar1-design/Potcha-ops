import { db } from '@/lib/db';
import { ok, requireSession, route } from '@/lib/api';

// GET /api/limits — quota usage for the CALLER's company (any member).
// Used by the Events and Team views to show "x / max" badges and disable
// create buttons when the platform-admin quota is exhausted.
export const GET = route(async (req: Request) => {
  const auth = await requireSession(req);

  const company = await db.company.findUnique({
    where: { id: auth.companyId },
    select: { maxEvents: true, maxTeamMembers: true, isPlatform: true },
  });

  if (!company || company.isPlatform) {
    // Platform admin (or missing company): no subscriber quotas apply.
    return ok({ events: null, members: null });
  }

  const [usedEvents, usedMembers] = await Promise.all([
    db.event.count({ where: { companyId: auth.companyId, status: { not: 'ARCHIVED' } } }),
    db.user.count({ where: { companyId: auth.companyId, status: { not: 'DISABLED' } } }),
  ]);

  return ok({
    events: { used: usedEvents, max: company.maxEvents },
    members: { used: usedMembers, max: company.maxTeamMembers },
  });
});
