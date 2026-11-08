import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  checkLoginRate, clearLoginRate, createSession, setSessionCookie, verifyPassword,
} from '@/lib/auth';
import { ApiError, audit, clientIp, ok, parseBody, route } from '@/lib/api';

const schema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const POST = route(async (req: NextRequest) => {
  const body = await parseBody(req, schema);
  const rateKey = `${clientIp(req)}:${body.email}`;
  const rate = checkLoginRate(rateKey);
  if (!rate.ok) {
    throw new ApiError(429, `Too many attempts. Try again in ${rate.retryInSec}s.`);
  }

  const user = await db.user.findUnique({ where: { email: body.email }, include: { company: true } });
  // Uniform error — never reveal whether the email exists.
  const invalid = new ApiError(401, 'Invalid email or password');
  if (!user) throw invalid;

  const valid = await verifyPassword(body.password, user.passwordHash);
  if (!valid) throw invalid;

  if (user.status === 'DISABLED') throw new ApiError(403, 'This account has been deactivated. Contact your CEO.');
  if (user.status === 'INVITED') throw new ApiError(403, 'This account has not been activated yet. Contact your CEO.');
  // Suspended subscriber workspace (set by the platform administrator).
  if (user.company.disabledAt) {
    throw new ApiError(403, 'This company workspace is suspended. Contact Potcha Ops to restore access.');
  }

  const { token, expiresAt } = await createSession(user.id);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const res = ok({
    // Cookie-less session fallback: browsers that block third-party cookies
    // (iOS Safari ITP inside cross-site iframes) cannot store the Set-Cookie,
    // so the client stores this opaque token and sends it as a Bearer header.
    sessionToken: token,
    user: {
      id: user.id, name: user.name, email: user.email, role: user.role,
      companyId: user.companyId, companyName: user.company.name,
    },
  });
  setSessionCookie(res as NextResponse, token, expiresAt);
  clearLoginRate(rateKey);
  await audit(
    { id: user.id, companyId: user.companyId } as never,
    { action: 'auth.login', entityType: 'User', entityId: user.id, summary: `${user.name} signed in` }
  );
  return res;
});
