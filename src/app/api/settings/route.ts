import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, audit, ok, parseBody, requireSession, route } from '@/lib/api';
import { CURRENCIES } from '@/lib/constants';

// GET /api/settings — company info for any authenticated member
export const GET = route(async (req: Request) => {
  const auth = await requireSession(req);
  const company = await db.company.findUnique({ where: { id: auth.companyId } });
  if (!company) throw new Error('Company missing');
  return ok({
    company: {
      id: company.id,
      name: company.name,
      currency: company.currency,
      dateFormat: company.dateFormat,
      plan: company.plan,
      isDemo: company.isDemo,
      createdAt: company.createdAt,
    },
    canManage: auth.perms.has('company.settings.manage'),
    currencies: CURRENCIES,
  });
});

// PATCH /api/settings — CEO only (company.settings.manage)
export const PATCH = route(async (req: Request) => {
  const auth = await requireSession(req);
  if (!auth.perms.has('company.settings.manage')) {
    throw new ApiError(403, 'Forbidden: missing permission "company.settings.manage"');
  }
  const body = await parseBody(req, z.object({
    name: z.string().trim().min(2).optional(),
    currency: z.enum(CURRENCIES).optional(),
    dateFormat: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']).optional(),
  }));

  const company = await db.company.findUnique({ where: { id: auth.companyId } });
  if (!company) throw new Error('Company missing');

  const data: Record<string, unknown> = {};
  if (body.name) data.name = body.name;
  if (body.currency) data.currency = body.currency;
  if (body.dateFormat) data.dateFormat = body.dateFormat;

  const updated = await db.company.update({ where: { id: company.id }, data });
  await audit(auth, {
    action: 'company.settings_updated',
    entityType: 'Company',
    entityId: company.id,
    summary: `Updated company settings (${Object.keys(data).join(', ')})`,
  });
  return ok({
    company: { id: updated.id, name: updated.name, currency: updated.currency, dateFormat: updated.dateFormat },
  });
});
