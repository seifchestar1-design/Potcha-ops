import { db } from '@/lib/db';
import {
  ApiError, ok, paging, requireSession, route,
} from '@/lib/api';

// GET /api/audit — role-scoped audit trail.
// CEO: everything. Finance: financial activity + own entries.
// Operations: own entries only.
export const GET = route(async (req: Request) => {
  const auth = await requireSession(req);
  if (!auth.perms.has('audit.view.all') && !auth.perms.has('audit.view.finance') && !auth.perms.has('audit.view.own')) {
    throw new ApiError(403, 'Forbidden: missing audit permission');
  }
  const url = new URL(req.url);
  const eventId = url.searchParams.get('eventId');
  const userId = url.searchParams.get('userId');
  const q = url.searchParams.get('q')?.trim().toLowerCase() ?? '';
  const { skip, take, page, pageSize } = paging(url.searchParams);

  const where: Record<string, unknown> = { companyId: auth.companyId };
  if (auth.perms.has('audit.view.all')) {
    if (userId) where.userId = userId;
  } else if (auth.perms.has('audit.view.finance')) {
    where.OR = [{ metadata: { contains: '"financial":true' } }, { userId: auth.id }];
  } else {
    where.userId = auth.id;
  }
  if (eventId) where.eventId = eventId;
  if (q) where.summary = { contains: q };

  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        user: { select: { id: true, name: true, role: true } },
        event: { select: { id: true, name: true } },
      },
    }),
  ]);

  return ok({
    total,
    page,
    pageSize,
    logs: logs.map((l) => {
      let financial = false;
      try {
        financial = (JSON.parse(l.metadata) as { financial?: boolean }).financial === true;
      } catch { /* ignore */ }
      return {
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        summary: l.summary,
        financial,
        createdAt: l.createdAt,
        userId: l.userId,
        userName: l.user?.name ?? 'System',
        userRole: l.user?.role ?? null,
        eventId: l.eventId,
        eventName: l.event?.name ?? null,
      };
    }),
    scope: auth.perms.has('audit.view.all') ? 'company' : auth.perms.has('audit.view.finance') ? 'financial+own' : 'own',
  });
});
