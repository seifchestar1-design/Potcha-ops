// Potcha Ops — API guard layer
// ------------------------------------------------------------------
// Every route handler funnels through requireSession / requirePerm /
// requireEventAccess. This is the enforcement point of the permission
// matrix and tenant isolation (the RLS-equivalent for this stack):
//   1. Every DB query is scoped to auth.companyId.
//   2. Operations users can only touch events they are assigned to.
//   3. Records from other companies / unassigned events resolve to 404
//      so existence is never leaked through IDs or URLs.

import { NextRequest, NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { db } from '@/lib/db';
import { getAuth, type AuthUser } from '@/lib/auth';
import type { PermissionKey } from '@/lib/permissions';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data as object, init);
}

export async function requireSession(req: Request): Promise<AuthUser> {
  const auth = await getAuth(req);
  if (!auth) throw new ApiError(401, 'Authentication required');
  return auth;
}

export function requirePerm(auth: AuthUser, key: PermissionKey): void {
  if (!auth.perms.has(key)) {
    throw new ApiError(403, `Forbidden: missing permission "${key}"`);
  }
}

export async function requirePermAndSession(
  req: Request,
  key: PermissionKey
): Promise<AuthUser> {
  const auth = await requireSession(req);
  requirePerm(auth, key);
  return auth;
}

/**
 * Guard for platform-administration routes (/api/admin/*). The ADMIN role is
 * not a company role: it holds zero company-level permissions and its only
 * surface is subscriber management (create companies, set event/team quotas,
 * suspend or restore workspaces).
 */
export async function requireAdmin(req: Request): Promise<AuthUser> {
  const auth = await requireSession(req);
  if (auth.role !== 'ADMIN') {
    throw new ApiError(403, 'Forbidden: platform administrator access required');
  }
  return auth;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'local';
}

/**
 * Loads an event scoped to the caller's company and verifies
 * role-appropriate access:
 *  - CEO / FINANCE (events.view.all): any event of the company.
 *  - OPERATIONS: only events where the user is assigned or is the planner.
 * Throws 404 when the event does not exist in this company (never 403 —
 * to avoid confirming that a foreign ID exists).
 *
 * Pass `includeRefs: true` to hydrate the `planner` (id+name) and
 * `assignments` ({userId, roleNote}[]) relations on the returned event.
 * Required by GET /api/events/:id so serializeEvent can populate
 * `plannerName` and `assignedUserIds` — without it, the event detail
 * endpoint returns plannerName=null and assignedUserIds=[], which would
 * (a) render "Planner: —" on the overview tab and (b) cause the edit
 * form to round-trip an empty assignee list into PATCH, wiping team
 * assignments on save.
 */
export async function requireEventAccess(
  auth: AuthUser,
  eventId: string,
  opts: { perm?: PermissionKey; includeRefs?: boolean } = {}
) {
  if (opts.perm) requirePerm(auth, opts.perm);

  const event = await db.event.findFirst({
    where: { id: eventId, companyId: auth.companyId },
    include: opts.includeRefs
      ? {
          planner: { select: { id: true, name: true } },
          assignments: { select: { userId: true, roleNote: true } },
        }
      : undefined,
  });
  if (!event) throw new ApiError(404, 'Event not found');

  if (auth.role === 'OPERATIONS' && !auth.perms.has('events.view.all')) {
    const assigned =
      event.plannerId === auth.id ||
      (await db.eventAssignment.findFirst({
        where: { eventId: event.id, userId: auth.id },
      }));
    if (!assigned) throw new ApiError(404, 'Event not found');
  }
  return event;
}

/** Parse + validate a JSON body with zod, throwing a 400 on failure. */
export async function parseBody<T>(req: NextRequest | Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, 'Invalid JSON body');
  }
  try {
    return schema.parse(raw);
  } catch (e) {
    if (e instanceof ZodError) {
      const msg = e.issues
        .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
        .join('; ');
      throw new ApiError(400, `Validation failed — ${msg}`);
    }
    throw e;
  }
}

/** Wraps a handler with uniform error mapping. */
export function route<P extends Record<string, string> = Record<string, string>>(
  handler: (req: NextRequest, ctx: { params: Promise<P> }) => Promise<NextResponse>
) {
  return async (req: NextRequest, ctx: { params: Promise<P> }) => {
    try {
      return await handler(req, ctx ?? { params: Promise.resolve({} as P) });
    } catch (e) {
      if (e instanceof ApiError) {
        return NextResponse.json(
          { error: e.message, code: e.code ?? null },
          { status: e.status }
        );
      }
      if (e instanceof ZodError) {
        return NextResponse.json({ error: 'Validation failed', issues: e.issues }, { status: 400 });
      }
      console.error('[api]', e);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}

// ---------------------------------------------------------------- audit trail

export async function audit(
  auth: AuthUser | null,
  entry: {
    action: string;
    entityType: string;
    entityId?: string;
    eventId?: string | null;
    summary: string;
    metadata?: Record<string, unknown>;
    financial?: boolean;
  }
) {
  try {
    await db.auditLog.create({
      data: {
        companyId: auth?.companyId ?? 'system',
        userId: auth?.id ?? null,
        eventId: entry.eventId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        summary: entry.summary,
        metadata: JSON.stringify({
          ...(entry.metadata ?? {}),
          financial: entry.financial ?? false,
        }),
      },
    });
  } catch (e) {
    console.error('[audit] failed to record', entry.action, e);
  }
}

/** Simple pagination helper. */
export function paging(searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(searchParams.get('pageSize') ?? 50) || 50));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
