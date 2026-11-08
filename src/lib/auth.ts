// Potcha Ops — authentication core
// - Passwords: bcrypt (cost 11), never stored or logged in plain text.
// - Sessions: opaque 384-bit random tokens, SHA-256 hashed in the DB
//   (a stolen database cannot be used to hijack live sessions),
//   delivered in an httpOnly, sameSite cookie. Revocable server-side.

import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { effectivePermissions, type PermissionKey } from '@/lib/permissions';

export const SESSION_COOKIE = 'potcha_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const BCRYPT_ROUNDS = 11;
// In-memory login rate limiter (per email+IP). Adequate for a single
// dev/demo instance; swap for a shared store when horizontally scaling.
type Bucket = { count: number; resetAt: number };
const loginBuckets = new Map<string, Bucket>();
const LOGIN_MAX = 10;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

export function checkLoginRate(key: string): { ok: boolean; retryInSec: number } {
  const now = Date.now();
  const b = loginBuckets.get(key);
  if (!b || b.resetAt < now) {
    loginBuckets.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return { ok: true, retryInSec: 0 };
  }
  b.count += 1;
  if (b.count > LOGIN_MAX) {
    return { ok: false, retryInSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { ok: true, retryInSec: 0 };
}

export function clearLoginRate(key: string) {
  loginBuckets.delete(key);
}

export async function hashPassword(plain: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.default.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.default.compare(plain, hash);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  companyId: string;
  companyName: string;
  currency: string;
  dateFormat: string;
  isDemoCompany: boolean;
  perms: Set<PermissionKey>;
};

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: { userId, tokenHash: sha256(token), expiresAt },
  });
  return { token, expiresAt };
}

export async function destroySession(token: string) {
  await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

export async function revokeAllUserSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}

async function loadUserByToken(token: string): Promise<AuthUser | null> {
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: { include: { company: true } },
    },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (session.user.status === 'DISABLED') {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  // Suspended subscriber workspace (platform admin set disabledAt): every
  // live session dies immediately — members are bounced to the login screen.
  if (session.user.company?.disabledAt) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  // Sliding expiry touch (throttled: only when >1h since lastSeenAt)
  if (Date.now() - session.lastSeenAt.getTime() > 60 * 60 * 1000) {
    await db.session
      .update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
      })
      .catch(() => undefined);
  }
  const u = session.user;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    status: u.status,
    companyId: u.companyId,
    companyName: u.company.name,
    currency: u.company.currency,
    dateFormat: u.company.dateFormat,
    isDemoCompany: u.company.isDemo,
    perms: effectivePermissions(u.role, u.extraPerms),
  };
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') || '';
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/** Reads the session from the incoming request: cookie first, then the
 *  `Authorization: Bearer <token>` fallback. The Bearer path exists because
 *  some browsers (notably iOS Safari with Intelligent Tracking Prevention)
 *  block ALL third-party cookies when the app runs embedded in a cross-site
 *  iframe — there the session token is kept in localStorage and sent as a
 *  header instead. Both mechanisms use the same opaque, server-revocable,
 *  SHA-256-hashed session tokens. */
export async function getAuth(req: Request): Promise<AuthUser | null> {
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (match) {
    const token = decodeURIComponent(match.slice(SESSION_COOKIE.length + 1));
    if (token) {
      const user = await loadUserByToken(token);
      if (user) return user;
    }
  }
  const bearer = extractBearerToken(req);
  if (bearer) return loadUserByToken(bearer);
  return null;
}

/** Reads the session inside Server Components / Route Handlers via next/headers. */
export async function getAuthFromCookieStore(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return loadUserByToken(token);
}

// ---------------------------------------------------------------------------
// Cookie strategy — dual Set-Cookie headers under the SAME cookie name.
//
// The app is reached both as a top-level page (e.g. "Open in New Tab") and
// embedded inside a cross-site iframe (preview panels). Browsers refuse to
// store/send SameSite=Lax cookies in third-party iframe contexts, which used
// to leave the session cookie silently dropped: login returned 200 but every
// follow-up request (e.g. /api/auth/me) arrived unauthenticated -> 401.
//
// Fix: emit two Set-Cookie headers for the identical name + token:
//   1. SameSite=Lax            — accepted on plain HTTP and first-party contexts.
//   2. SameSite=None; Secure   — accepted inside cross-site HTTPS iframes.
// The browser keeps whichever variant its context allows and drops/replaces
// the other (cookies with the same name+path replace each other), so exactly
// one `potcha_session` cookie is ever sent — no reader changes required.
function serializeSessionCookie(token: string, expiresUTC: string, sameSite: 'Lax' | 'None'): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    `Expires=${expiresUTC}`,
    'HttpOnly',
    `SameSite=${sameSite}`,
  ];
  // SameSite=None is invalid without Secure (RFC 6265bis / browser policy).
  if (sameSite === 'None') parts.push('Secure');
  return parts.join('; ');
}

export function setSessionCookie(res: NextResponse, token: string, expiresAt: Date) {
  const expiresUTC = expiresAt.toUTCString();
  // append (not set) so both variants reach the browser as separate headers.
  res.headers.append('set-cookie', serializeSessionCookie(token, expiresUTC, 'Lax'));
  res.headers.append('set-cookie', serializeSessionCookie(token, expiresUTC, 'None'));
}

export function clearSessionCookie(res: NextResponse) {
  const expired = 'Thu, 01 Jan 1970 00:00:00 GMT';
  res.headers.append('set-cookie', serializeSessionCookie('', expired, 'Lax') + '; Max-Age=0');
  res.headers.append('set-cookie', serializeSessionCookie('', expired, 'None') + '; Max-Age=0');
}
