import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie, SESSION_COOKIE } from '@/lib/auth';
import { ok, route } from '@/lib/api';
import { db } from '@/lib/db';

export const POST = route(async (req: NextRequest) => {
  // Session may arrive via cookie OR Authorization: Bearer header (the
  // cookie-less fallback used when third-party cookies are blocked).
  let token: string | null = null;
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (match) token = decodeURIComponent(match.slice(SESSION_COOKIE.length + 1));
  if (!token) {
    const authHeader = req.headers.get('authorization') || '';
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.slice(7).trim() || null;
    }
  }
  if (token) {
    const { createHash } = await import('crypto');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const session = await db.session.findUnique({ where: { tokenHash }, include: { user: true } });
    await db.session.deleteMany({ where: { tokenHash } });
    if (session) {
      await db.auditLog.create({
        data: {
          companyId: session.user.companyId,
          userId: session.user.id,
          action: 'auth.logout',
          entityType: 'User',
          entityId: session.user.id,
          summary: `${session.user.name} signed out`,
          metadata: '{}',
        },
      }).catch(() => undefined);
    }
  }
  const res = ok({ success: true });
  clearSessionCookie(res as NextResponse);
  return res;
});
