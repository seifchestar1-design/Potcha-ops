import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError, audit, ok, parseBody, requireSession, route,
} from '@/lib/api';
import { serializeTeamMember } from '@/lib/serialize';

// GET /api/team — CEO only (team.manage)
export const GET = route(async (req: Request) => {
  const auth = await requireSession(req);
  if (!auth.perms.has('team.manage')) {
    throw new ApiError(403, 'Forbidden: missing permission "team.manage"');
  }
  const members = await db.user.findMany({
    where: { companyId: auth.companyId },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { assignments: true, tasksAssigned: true } } },
  });
  return ok({ members: members.map(serializeTeamMember) });
});

// POST /api/team — invite a member (CEO). A temporary password is
// generated server-side and shown ONCE to the CEO to share securely.
const inviteSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  phone: z.string().trim().optional().nullable(),
  role: z.enum(['CEO', 'FINANCE', 'OPERATIONS']),
});

export const POST = route(async (req: Request) => {
  const auth = await requireSession(req);
  if (!auth.perms.has('team.manage')) {
    throw new ApiError(403, 'Forbidden: missing permission "team.manage"');
  }
  const body = await parseBody(req, inviteSchema);

  // Platform-admin seat quota: non-disabled members (INVITED accounts hold
  // a seat too). Disabled members free their seat.
  const company = await db.company.findUnique({
    where: { id: auth.companyId },
    select: { maxTeamMembers: true },
  });
  const seatsUsed = await db.user.count({
    where: { companyId: auth.companyId, status: { not: 'DISABLED' } },
  });
  if (company && seatsUsed >= company.maxTeamMembers) {
    throw new ApiError(
      409,
      `Team member limit reached (${seatsUsed}/${company.maxTeamMembers} seats used). Ask the platform administrator to add more seats.`
    );
  }

  const existing = await db.user.findUnique({ where: { email: body.email } });
  if (existing) throw new ApiError(409, 'An account with this email already exists');

  const tempPassword = `Potcha-${Math.random().toString(36).slice(2, 8)}${Math.floor(Math.random() * 90 + 10)}`;
  const { hashPassword } = await import('@/lib/auth');
  const created = await db.user.create({
    data: {
      companyId: auth.companyId,
      name: body.name,
      email: body.email,
      phone: body.phone || null,
      passwordHash: await hashPassword(tempPassword),
      role: body.role,
      status: 'INVITED',
    },
  });

  await audit(auth, {
    action: 'team.member_invited',
    entityType: 'User',
    entityId: created.id,
    summary: `Invited ${created.name} as ${created.role} (${created.email})`,
    metadata: { role: created.role },
  });
  return ok({ member: { id: created.id }, tempPassword }, { status: 201 });
});
