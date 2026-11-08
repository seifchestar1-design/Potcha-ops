import { db } from '@/lib/db';
import { ok, requireEventAccess, requireSession, route } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/events/:id/activity — audit history for this event.
// Role-filtered: Operations see their own entries; Finance sees
// financial activity + own; CEO sees everything.
export const GET = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  const event = await requireEventAccess(auth, id);

  const where: Record<string, unknown> = { eventId: event.id };
  if (!auth.perms.has('audit.view.all')) {
    if (auth.perms.has('audit.view.finance')) {
      where.OR = [{ metadata: { contains: '"financial":true' } }, { userId: auth.id }];
    } else {
      where.userId = auth.id;
    }
  }

  const logs = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { id: true, name: true, role: true } } },
  });

  return ok({
    activity: logs.map((l) => ({
      id: l.id,
      action: l.action,
      summary: l.summary,
      createdAt: l.createdAt,
      userId: l.userId,
      userName: l.user?.name ?? 'System',
      userRole: l.user?.role ?? null,
    })),
  });
});
