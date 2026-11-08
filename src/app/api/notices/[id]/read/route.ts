import { db } from '@/lib/db';
import { ApiError, ok, route } from '@/lib/api';
import { requireSession } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/notices/:id/read — CEO marks a notice as read
export const POST = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  if (!auth.perms.has('team.manage')) {
    throw new ApiError(403, 'Forbidden: only the CEO can manage notices');
  }
  const notice = await db.notice.findFirst({ where: { id, companyId: auth.companyId } });
  if (!notice) throw new ApiError(404, 'Notice not found');

  await db.notice.update({ where: { id: notice.id }, data: { readAt: new Date() } });
  return ok({ success: true });
});
