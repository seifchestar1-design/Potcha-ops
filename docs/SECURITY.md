# Potcha Ops — Security Architecture & Verified Test Results

## Threat model & security architecture

### Authentication
- Passwords are hashed with **bcrypt (cost 11)** — never stored, logged or transmitted in plain text.
- Sessions are **opaque 384-bit random tokens** delivered two ways: (1) `httpOnly` cookies — two `Set-Cookie` headers under the same name (`SameSite=Lax` for first-party/plain HTTP, `SameSite=None; Secure` for cross-site HTTPS iframe contexts); (2) an `Authorization: Bearer` header fallback where the client keeps the same token in `localStorage`, for browsers that block third-party cookies entirely (iOS Safari ITP inside cross-site iframes). The server accepts either; the token is identical, only its SHA-256 hash is stored, and it is revoked on logout/role-change/deactivation. Trade-off: the localStorage copy is readable by XSS (unlike the httpOnly cookie); accepted because the app renders no unescaped HTML, uses relative same-origin API URLs only, and the token is opaque, short-lived and server-revocable.
- Only the **SHA-256 hash** of each session token is stored in the database — a stolen database cannot be used to hijack live sessions.
- Sessions are **server-side revocable** (logout, deactivation, role change all revoke them) with 7-day sliding expiry.
- Login attempts are **rate limited** (10 per email+IP per 10 minutes) with uniform error messages that never reveal whether an email exists.

### Authorization (the permission matrix)
- Three roles with security levels: **CEO (L3)**, **Finance (L2)**, **Operations (L1)**, defined in `src/lib/permissions.ts` (26 named permissions).
- Effective permissions = role defaults + CEO-granted extras per user (stored in DB, validated against the catalogue; you cannot grant permissions you don't hold).
- **Enforced server-side on every request** via `requireSession` → `requirePerm` → `requireEventAccess` (`src/lib/api.ts`). The frontend only hides UI — it is never the security boundary.

### Tenant isolation (RLS-equivalent)
- This build uses Prisma + SQLite, where row-level security policies are not available as they are in Supabase/PostgreSQL. The equivalent is implemented **in the authorization layer**: every query is scoped to `auth.companyId`, and every ID received from a client is re-verified against the caller's company before use.
- Cross-company records resolve to **404 (not 403)** so the existence of another tenant's data is never leaked through IDs, URLs or request parameters.
- Operations users are additionally restricted to events they are **assigned to** (or planner of) — checked per request, per record.

### Financial data protection
- Financial fields (`contractValue`, vendor `contractAmount/depositAmount/paidAmount`, payments) are **stripped from API responses** for users without `finance.view` in `src/lib/serialize.ts` — restricted numbers never reach the browser.
- The ledger is **immutable**: completed transactions cannot be edited or deleted. Corrections are **reversal entries** (negative amounts linked to the original) so history is preserved and auditable. Only *pending plan entries* (money that hasn't moved) can be cancelled.
- All financial mutations write **audit log entries** flagged `financial: true`.

### Other protections
- **Input validation** with zod on every write endpoint (types, enums, lengths); unknown fields rejected where immutability matters.
- **File uploads**: 5MB cap, MIME allow-list, filename sanitization, stored as private DB blobs served only through an authorization-checked endpoint (`Cache-Control: private, no-store`).
- **No secrets in client code** — only `DATABASE_URL`/`SESSION_SECRET` in server-side `.env`.
- **Audit trail** on every meaningful action (who/what/when/event), role-scoped on read: CEO → all, Finance → financial + own, Operations → own.
- **Last-CEO guard**: the system prevents demoting or disabling the final active CEO.
- **Session revocation on role/status change** ensures privilege changes take effect immediately.

---

## Verified test results (repeatable)

Run the suite any time with `bun run security-audit` against a running dev server. Last run: **38 passed, 0 failed.**

```
1) Operations cannot read financial data
  ✅ GET /api/payments → 403
  ✅ GET event finance tab → 403
  ✅ event serializer strips contractValue
  ✅ event serializer strips financials
  ✅ vendor serializer strips contractAmount
  ✅ POST /api/payments as Operations → 403

2) Finance cannot modify CEO permissions / administration
  ✅ GET /api/team as Finance → 403
  ✅ PATCH team member as Finance → 403
  ✅ PATCH company settings as Finance → 403
  ✅ grant permissions as Finance → 403

3) CEO can access authorized company-wide information
  ✅ CEO dashboard → 200 with full KPIs
  ✅ CEO team management → 200
  ✅ CEO event finance → 200 with ledger
  ✅ CEO audit log → 200, company scope

4) Users cannot access another company's data
  ✅ second company registered
  ✅ second company CEO authenticated
  ✅ cross-company event access → 404 (existence not leaked)
  ✅ cross-company finance access → 404
  ✅ cross-company event edit → 404
  ✅ cross-company payment injection → 404
  ✅ rival sees only own (empty) event list
  ✅ Operations user blocked from unassigned event → 404

5) Unauthenticated callers cannot bypass permissions
  ✅ GET /api/dashboard without session → 401
  ✅ GET /api/payments without session → 401
  ✅ forged session cookie → 401
  ✅ wrong password rejected (401)
  ✅ enum injection rejected (400)

6) Financial transactions cannot be silently deleted or rewritten
  ✅ completed transaction recorded
  ✅ attempt to rewrite amount → schema-rejected
  ✅ DELETE completed transaction → 409
  ✅ DELETE by Operations → 403
  ✅ reversal recorded (201)
  ✅ original preserved and marked REVERSED
  ✅ corrective negative entry exists
  ✅ double reversal blocked → 409
  ✅ DELETE reversed original still blocked → 409
```

### Browser-level verification (performed additionally)
- Logging in as each role renders the correct role-specific dashboard; the sidebar shows/hides Finance, Team and Audit per permissions.
- As Operations, manually setting the URL hash to an unassigned event renders "Event not found" (no data leak), and in-browser `fetch()` calls to `/api/payments`, `/api/events/:id/finance` and `/api/team` return 403.
- The event API response for Operations physically omits `contractValue`/`financials` — verified at the network level.
- Payment recording, reversal, event creation, typed-confirmation deletion, and team invitations with one-time passwords were all exercised end-to-end in the browser.

---

## Recommended hardening before real production

1. Move from SQLite to **PostgreSQL** and add literal Row-Level Security policies as defense-in-depth (the app-layer scoping already implements the same rules).
2. Add HTTPS termination (already assumed via `secure` cookies) and consider CSRF defenses for cross-site form posts (JSON + sameSite=lax cookies already block the common cases).
3. Move the in-memory login rate limiter to a shared store (Redis) when horizontally scaling.
4. Add automated backups: SQLite file backup or `pg_dump` on a schedule, plus an off-site copy.
5. Introduce content-security-policy headers and a dependency audit pipeline.
6. Penetration test with a third party before charging real users.
