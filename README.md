# Potcha Ops

**Every Wedding. Every Detail. Under Control.**

A centralized operations control center for wedding-planning companies in Egypt — events, vendors, payments, team responsibilities, wedding-day run sheets and event readiness, in one secure workspace instead of scattered WhatsApp threads and spreadsheets.

> This is a real, functional application with working authentication, database-backed role-based access control, financial tracking with an immutable ledger, operational workflows, audit logging, and a full demo environment with fictional Egyptian wedding-industry data.

---

## Demo accounts

The demo company **Lotus & Nile Weddings Co.** contains 5 events, 13 vendors, a complete payment ledger, 17+ tasks, run sheets, issues and audit history — all fictional.

| Role | Email | Password | Security level |
|---|---|---|---|
| CEO (owner) | `ceo@potchaops.demo` | `Demo@1234` | L3 — full company oversight |
| Finance Manager | `finance@potchaops.demo` | `Demo@1234` | L2 — financial access |
| Operations | `ops@potchaops.demo` | `Demo@1234` | L1 — assigned events & execution |
| Operations | `ops2@potchaops.demo` | `Demo@1234` | L1 |

Reset the demo environment at any time from the **login screen → "Reset demo data"** or **Settings → Environment → Reset** (CEO). Real companies are never touched — only data flagged `isDemo`.

---

## What's inside

| Module | Highlights |
|---|---|
| **Company dashboard** | Role-specific KPI scorecards: 12 metrics for the CEO, 10 for Finance, 8 for Operations — events at risk, overdue tasks, outstanding payments, vendor confirmations, notices, recent activity |
| **Event management** | Full event lifecycle (Lead → Proposal → Confirmed → In preparation → Ready → Completed → Archived) with an 8-tab workspace: Overview, Vendors, Budget, Tasks, Run sheet, Issues, Documents, Activity |
| **Vendor management** | Company-wide directory (13 categories) + per-event engagements. Operational data (contacts, arrival/setup, confirmation) is separated from restricted financial data (contract, deposit, paid) |
| **Finance & budget** | Automatic revenue/expense/profit/margin calculations, EGP-first currency, payment deadlines & overdue flags, **immutable ledger** — corrections are recorded as reversal entries, never silent edits |
| **Tasks** | Priorities (Low → Critical), statuses (To do → Blocked), assignees, due dates, comments, filters by event/owner/priority/status/date |
| **Wedding-day run sheet** | Minute-by-minute timeline with owners, vendors, locations, delayed-item highlighting, reordering, status tracking and **print-ready output** |
| **Issues & incidents** | Priority-tracked issue log with resolution notes; critical issues lower the readiness score and surface on dashboards |
| **Readiness score** | Transparent weighted model (vendors 25 · critical tasks 20 · run sheet 15 · venue 15 · documents 10 · issues 15) with per-criterion breakdown, missing requirements and recommended actions |
| **Team & permissions** | Invitations with one-time temporary passwords, role assignment, per-user permission grants, session revocation on role change |
| **Audit log** | Every meaningful action recorded — who, what, when, on which event. Role-scoped: CEO sees all, Finance sees financial activity, Operations sees their own |
| **Reports & exports** | Auditable CSV exports (events, financial ledger, tasks, vendors) + company performance tables |
| **Documents** | Private storage (max 5MB/file, type allow-list), served only through an authorization-checked endpoint |

---

## Architecture

- **Framework:** Next.js 16 (App Router) + TypeScript 5, single-page app at `/` with hash-based in-app routing
- **Styling:** Tailwind CSS 4 + shadcn/ui (New York) — warm bronze/stone palette, light & dark themes, mobile-first responsive
- **Database:** Prisma ORM — SQLite for local development, with a ready PostgreSQL variant (`prisma/schema.postgres.prisma`) for Supabase/production — see `docs/SUPABASE_SETUP.md`
- **Authentication:** bcrypt password hashing (cost 11), opaque 384-bit session tokens (SHA-256 hashed at rest, httpOnly cookies, server-side revocation), login rate limiting
- **Authorization:** database-backed role model (CEO / FINANCE / OPERATIONS) with a 26-permission matrix, enforced server-side on **every** API request
- **Tenant isolation:** every query is company-scoped in the API layer (the RLS-equivalent for this stack); cross-company IDs resolve to 404 so existence is never leaked

```
src/
├── app/page.tsx                 # the entire app (single route)
├── app/api/…                    # ~30 REST endpoints, all permission-guarded
├── lib/
│   ├── auth.ts                  # sessions, bcrypt, rate limiting
│   ├── permissions.ts           # role → permission matrix
│   ├── api.ts                   # guards: requireSession / requirePerm / requireEventAccess
│   ├── finance.ts               # revenue/expense/profit calculations
│   ├── readiness.ts             # transparent readiness scoring model
│   ├── serialize.ts             # strips financial fields for restricted roles
│   └── seed.ts                  # demo data generator
├── components/app/              # shell, dashboards, event workspace, views
├── prisma/schema.prisma         # 14 models, multi-tenant
└── scripts/security-audit.ts    # repeatable 38-check security test suite
```

---

## Setup guide

**Prerequisites:** Node.js 20+ or Bun 1.1+.

```bash
# 1. Install dependencies
bun install          # or npm install

# 2. Configure environment
cp .env.example .env
#    → DATABASE_URL defaults to local SQLite; SESSION_SECRET is reserved (currently unused)

# 3. Create the database
bun run db:push      # creates SQLite schema

# 4. Seed the demo environment
bun run db:seed

# 5. Start the dev server
bun run dev          # http://localhost:3000
```

Sign in with the demo accounts above. To create your **own company**, use "Start your own workspace" on the login screen — you become its CEO with a fully isolated tenant.

### Security verification

```bash
bun run security-audit
```

Runs the repeatable 38-check suite against the running app (see `docs/SECURITY.md` for the full results).

---

## Documentation

- `docs/SUPABASE_SETUP.md` — **step-by-step Supabase + Vercel production setup** (start here for deployment)
- `docs/USER_GUIDE.md` — role-by-role handbook (CEO, Finance, Operations)
- `docs/SECURITY.md` — security architecture + verified test results
- `docs/DEPLOYMENT.md` — deployment overview (Vercel/VPS/Docker)
- `docs/LIMITATIONS.md` — known limitations, incomplete features, commercial launch checklist

## Key scripts

| Command | Purpose |
|---|---|
| `bun run dev` | Development server (port 3000) |
| `bun run lint` | ESLint (clean) |
| `bun run db:push` | Apply schema to SQLite |
| `bun run db:seed` | Reset & regenerate demo data |
| `bun run db:push:supabase` | Apply schema to Supabase/Postgres (`prisma/schema.postgres.prisma`) |
| `bun run db:generate:supabase` | Regenerate Prisma Client for Postgres |
| `bun run vercel-build` | Vercel build command (Postgres client + `next build`) |
| `bun run security-audit` | 38-check security test suite |

---

*Potcha Ops v1.0 — built as a complete commercial-grade product demo. All sample data is fictional.*
