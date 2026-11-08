import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, audit, ok, parseBody, requireAdmin, route } from '@/lib/api';
import { hashPassword } from '@/lib/auth';

// ============================================================================
// /api/admin/companies — platform administrator only (role === 'ADMIN').
// Subscriber management: list workspaces with quota usage, create a new
// subscriber company with its CEO account and event/team quotas.
// ============================================================================

// GET /api/admin/companies — every subscriber with live usage counts.
export const GET = route(async (req: Request) => {
  await requireAdmin(req);

  const companies = await db.company.findMany({
    where: { isPlatform: false },
    orderBy: { createdAt: 'desc' },
    include: {
      users: {
        select: { id: true, name: true, email: true, role: true, status: true, lastLoginAt: true },
      },
    },
  });

  // Quota usage: non-archived events and non-disabled member seats.
  const [eventCounts, memberCounts] = await Promise.all([
    db.event.groupBy({
      by: ['companyId'],
      where: { status: { not: 'ARCHIVED' } },
      _count: { _all: true },
    }),
    db.user.groupBy({
      by: ['companyId'],
      where: { status: { not: 'DISABLED' } },
      _count: { _all: true },
    }),
  ]);
  const eventsBy = new Map(eventCounts.map((r) => [r.companyId, r._count._all]));
  const membersBy = new Map(memberCounts.map((r) => [r.companyId, r._count._all]));

  return ok({
    companies: companies.map((c) => {
      const ceo = c.users.find((u) => u.role === 'CEO') ?? null;
      return {
        id: c.id,
        name: c.name,
        plan: c.plan,
        currency: c.currency,
        isDemo: c.isDemo,
        maxEvents: c.maxEvents,
        maxTeamMembers: c.maxTeamMembers,
        usedEvents: eventsBy.get(c.id) ?? 0,
        usedMembers: membersBy.get(c.id) ?? 0,
        memberCount: c.users.length,
        disabledAt: c.disabledAt,
        createdAt: c.createdAt,
        ceoName: ceo?.name ?? null,
        ceoEmail: ceo?.email ?? null,
        ceoLastLoginAt: ceo?.lastLoginAt ?? null,
      };
    }),
  });
});

// POST /api/admin/companies — create a subscriber workspace + its CEO.
const createSchema = z.object({
  companyName: z.string().trim().min(2, 'Company name is required'),
  ceoName: z.string().trim().min(2, 'CEO name is required'),
  ceoEmail: z.string().trim().toLowerCase().email('A valid email is required'),
  // Optional: leave empty to auto-generate a strong temporary password that
  // is shown ONCE in the response (same flow as team invitations).
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number')
    .optional(),
  currency: z.enum(['EGP', 'USD', 'EUR', 'SAR', 'AED']).default('EGP'),
  plan: z.enum(['TRIAL', 'GROWTH', 'PRO']).default('TRIAL'),
  maxEvents: z.number().int().min(0).max(10_000).default(10),
  maxTeamMembers: z.number().int().min(1).max(1_000).default(5),
});

export const POST = route(async (req: Request) => {
  const auth = await requireAdmin(req);
  const body = await parseBody(req, createSchema);

  const existing = await db.user.findUnique({ where: { email: body.ceoEmail } });
  if (existing) throw new ApiError(409, 'An account with this email already exists');

  const generated = !body.password;
  const password = body.password ?? `Potcha-${Math.random().toString(36).slice(2, 8)}${Math.floor(Math.random() * 90 + 10)}`;

  const company = await db.company.create({
    data: {
      name: body.companyName,
      currency: body.currency,
      plan: body.plan,
      maxEvents: body.maxEvents,
      maxTeamMembers: body.maxTeamMembers,
    },
  });

  const ceo = await db.user.create({
    data: {
      companyId: company.id,
      name: body.ceoName,
      email: body.ceoEmail,
      passwordHash: await hashPassword(password),
      role: 'CEO',
      status: 'ACTIVE',
    },
  });

  // Audit against the NEW company so its own trail shows the provisioning.
  await audit(
    { ...auth, companyId: company.id },
    {
      action: 'company.created',
      entityType: 'Company',
      entityId: company.id,
      summary: `Platform admin created company "${company.name}" with CEO ${ceo.email}`,
      metadata: { plan: company.plan, maxEvents: company.maxEvents, maxTeamMembers: company.maxTeamMembers },
    }
  );

  return ok(
    {
      company: { id: company.id, name: company.name },
      ceo: { id: ceo.id, email: ceo.email },
      ...(generated ? { tempPassword: password } : {}),
    },
    { status: 201 }
  );
});
