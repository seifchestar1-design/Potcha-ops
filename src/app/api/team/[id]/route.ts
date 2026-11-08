import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError, audit, ok, parseBody, requireSession, route,
} from '@/lib/api';
import { PERMISSIONS, type PermissionKey } from '@/lib/permissions';

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  role: z.enum(['CEO', 'FINANCE', 'OPERATIONS']).optional(),
  status: z.enum(['ACTIVE', 'INVITED', 'DISABLED']).optional(),
  extraPerms: z.array(z.string()).optional(),
  name: z.string().trim().min(2).optional(),
  phone: z.string().trim().nullable().optional(),
});

// PATCH /api/team/:id — role / status / permission grants (CEO).
// Business rules enforced:
//  - The company must always keep at least one ACTIVE CEO.
//  - Grants are validated against the permission catalogue.
//  - Role/status changes revoke the target's live sessions.
export const PATCH = route<{ id: string }>(async (req, ctx) => {
  const auth = await requireSession(req);
  const { id } = await ctx.params;
  if (!auth.perms.has('team.manage')) {
    throw new ApiError(403, 'Forbidden: missing permission "team.manage"');
  }
  const body = await parseBody(req, patchSchema);

  const member = await db.user.findFirst({ where: { id, companyId: auth.companyId } });
  if (!member) throw new ApiError(404, 'Member not found');
  if (member.id === auth.id && body.role && body.role !== 'CEO') {
    throw new ApiError(400, 'You cannot demote yourself. Promote another CEO first.');
  }

  // Guard: last active CEO cannot be demoted or disabled
  if ((body.role && body.role !== 'CEO' && member.role === 'CEO') ||
      (body.status && body.status !== 'ACTIVE' && member.role === 'CEO' && member.status === 'ACTIVE')) {
    if (member.id === auth.id || (await countActiveCEOs(auth.companyId, member.id)) === 0) {
      throw new ApiError(400, 'The company must keep at least one active CEO');
    }
  }

  if (body.extraPerms) {
    if (!auth.perms.has('permissions.grant')) {
      throw new ApiError(403, 'Forbidden: missing permission "permissions.grant"');
    }
    const valid = (Object.keys(PERMISSIONS) as PermissionKey[]);
    const invalid = body.extraPerms.filter((p) => !valid.includes(p as PermissionKey));
    if (invalid.length > 0) throw new ApiError(400, `Unknown permissions: ${invalid.join(', ')}`);
    if (member.role === 'CEO') {
      throw new ApiError(400, 'CEO accounts already hold every permission');
    }
    // Prevent granting permissions the grantor doesn't hold
    const notHeld = body.extraPerms.filter((p) => !auth.perms.has(p as PermissionKey));
    if (notHeld.length > 0) {
      throw new ApiError(403, `You cannot grant permissions you do not hold: ${notHeld.join(', ')}`);
    }
  }

  const data: Record<string, unknown> = {};
  if (body.role) data.role = body.role;
  if (body.status) data.status = body.status;
  if (body.name) data.name = body.name;
  if (body.phone !== undefined) data.phone = body.phone || null;
  if (body.extraPerms) data.extraPerms = JSON.stringify([...new Set(body.extraPerms)]);

  const updated = await db.user.update({ where: { id: member.id }, data });

  // Security: revoke live sessions when role or status changes
  if (body.role || body.status) {
    await db.session.deleteMany({ where: { userId: member.id } });
  }

  const changes: string[] = [];
  if (body.role) changes.push(`role → ${body.role}`);
  if (body.status) changes.push(`status → ${body.status}`);
  if (body.extraPerms) changes.push(`grants → [${[...new Set(body.extraPerms)].join(', ')}]`);
  await audit(auth, {
    action: 'team.member_updated',
    entityType: 'User',
    entityId: member.id,
    summary: `Updated ${updated.name}: ${changes.join('; ') || 'profile'}`,
    metadata: { changes },
  });
  return ok({ success: true });
});

async function countActiveCEOs(companyId: string, excludeUserId: string): Promise<number> {
  return db.user.count({
    where: { companyId, role: 'CEO', status: 'ACTIVE', id: { not: excludeUserId } },
  });
}
