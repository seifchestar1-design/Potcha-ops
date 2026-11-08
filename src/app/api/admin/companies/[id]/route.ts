import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, audit, ok, parseBody, requireAdmin, route } from '@/lib/api';

// PATCH /api/admin/companies/[id] — platform administrator only.
// Update a subscriber: rename, change plan, adjust event/team quotas, or
// suspend / restore the workspace (suspension revokes every live session
// of the company's members immediately and blocks new logins).
const patchSchema = z.object({
  name: z.string().trim().min(2, 'Company name is required').optional(),
  plan: z.enum(['TRIAL', 'GROWTH', 'PRO']).optional(),
  maxEvents: z.number().int().min(0).max(10_000).optional(),
  maxTeamMembers: z.number().int().min(1).max(1_000).optional(),
  disabled: z.boolean().optional(),
});

export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const auth = await requireAdmin(req);
  const { id } = await ctx.params;
  const body = await parseBody(req, patchSchema);

  const company = await db.company.findFirst({ where: { id, isPlatform: false } });
  if (!company) throw new ApiError(404, 'Company not found');

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.plan !== undefined) data.plan = body.plan;
  if (body.maxEvents !== undefined) data.maxEvents = body.maxEvents;
  if (body.maxTeamMembers !== undefined) data.maxTeamMembers = body.maxTeamMembers;

  // Suspend / restore the workspace.
  let revokedSessions = 0;
  if (body.disabled === true && !company.disabledAt) {
    data.disabledAt = new Date();
    const res = await db.session.deleteMany({ where: { user: { companyId: company.id } } });
    revokedSessions = res.count;
  } else if (body.disabled === false && company.disabledAt) {
    data.disabledAt = null;
  }

  const updated = await db.company.update({ where: { id: company.id }, data });

  // One audit entry describing what changed, written into the subscriber's
  // own trail so their CEO can see quota/suspension changes.
  const changes: string[] = [];
  if (body.name !== undefined && body.name !== company.name) changes.push(`renamed to "${body.name}"`);
  if (body.plan !== undefined && body.plan !== company.plan) changes.push(`plan → ${body.plan}`);
  if (body.maxEvents !== undefined && body.maxEvents !== company.maxEvents) changes.push(`event quota ${company.maxEvents} → ${body.maxEvents}`);
  if (body.maxTeamMembers !== undefined && body.maxTeamMembers !== company.maxTeamMembers) changes.push(`seat quota ${company.maxTeamMembers} → ${body.maxTeamMembers}`);
  if (body.disabled === true && !company.disabledAt) changes.push('workspace suspended');
  if (body.disabled === false && company.disabledAt) changes.push('workspace restored');

  if (changes.length > 0) {
    await audit(
      { ...auth, companyId: company.id },
      {
        action: body.disabled === true ? 'company.suspended' : body.disabled === false ? 'company.restored' : 'company.updated',
        entityType: 'Company',
        entityId: company.id,
        summary: `Platform admin updated "${updated.name}": ${changes.join(', ')}`,
        metadata: { maxEvents: updated.maxEvents, maxTeamMembers: updated.maxTeamMembers },
      }
    );
  }

  return ok({
    company: {
      id: updated.id,
      name: updated.name,
      plan: updated.plan,
      maxEvents: updated.maxEvents,
      maxTeamMembers: updated.maxTeamMembers,
      disabledAt: updated.disabledAt,
    },
    revokedSessions,
  });
});
