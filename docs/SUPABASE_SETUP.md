# Potcha Ops on Supabase — Step-by-Step Setup

This guide takes Potcha Ops from the local SQLite demo to a production deployment on **Supabase (managed PostgreSQL)** + **Vercel (app hosting)**. No code changes are needed — the Postgres schema variant, SQL scripts and helper commands are already in the repository.

**Time required:** ~30–45 minutes.
**Cost to start:** $0 (both services have free tiers — see [Cost snapshot](#cost-snapshot)).

---

## What you end up with

```
┌────────────┐        HTTPS         ┌──────────────────────┐      pooled TCP       ┌──────────────────────┐
│  Browser   │ ───────────────────► │  Vercel              │ ────────────────────► │  Supabase Postgres   │
│  (mobile / │                      │  Next.js 16 app      │   postgresql://…      │  15 tables + demo    │
│  desktop)  │ ◄─────────────────── │  • auth in API route │ ◄──────────────────── │  data + backups      │
└────────────┘                      │  • RBAC per request  │                       └──────────────────────┘
                                    └──────────────────────┘
```

- **Supabase is used purely as managed PostgreSQL.** The app keeps its own authentication (bcrypt + opaque server-revokable session tokens) — you do **not** need Supabase Auth, Storage or Edge Functions for this setup.
- Local development keeps using SQLite (fast, offline). Switching to Supabase affects only the deployed app and any CLI command where you pass a Postgres `DATABASE_URL`.

---

## What's already in the repository

| File / script | Purpose |
|---|---|
| `prisma/schema.postgres.prisma` | The full 15-model schema with `provider = "postgresql"` (identical models to the SQLite variant) |
| `supabase/schema.sql` | The same schema as plain SQL — paste into Supabase's SQL Editor if you prefer not to use the CLI |
| `supabase/rls-lockdown.sql` | Optional hardening: blocks Supabase's REST API (`anon`/`authenticated` keys) from reading app tables |
| `bun run db:push:supabase` | Creates all tables in your Supabase database |
| `bun run db:generate:supabase` | Regenerates Prisma Client for Postgres |
| `bun run db:seed` | Loads the fictional demo company (works against whichever `DATABASE_URL` you provide) |
| `bun run vercel-build` | Build command for Vercel: generates the Postgres Prisma Client, then builds |

---

## Prerequisites

- [ ] A [Supabase](https://supabase.com) account (sign up with GitHub is fastest)
- [ ] A [Vercel](https://vercel.com) account
- [ ] A [GitHub](https://github.com) account (to host the code between them)
- [ ] On your machine: Git, and Node.js 20+ **or** [Bun](https://bun.sh) 1.1+
- [ ] The Potcha Ops codebase (this repository)

---

## Part 1 — Create the Supabase project (~5 min)

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**. Choose your organization (create one if asked).
3. Fill in:
   - **Name:** `potcha-ops` (anything you like)
   - **Database Password:** click **Generate** — and **save it somewhere safe right now** (a password manager). You can reset it later, but every setup step needs it.
   - **Region:** pick the one closest to your team and clients. For Egypt, **EU Central (Frankfurt)** gives good latency.
   - **Plan:** Free.
4. Click **Create new project** and wait ~1–2 minutes for provisioning.

> **Free tier facts (honest):** the free plan includes a 500 MB database (the Potcha Ops demo data uses only a few MB) and daily backups kept for 7 days. Free projects are **paused after ~1 week of inactivity** — regular use of your app keeps it alive; log into the dashboard to restore a paused project.

---

## Part 2 — Get your connection string (~2 min)

1. In the Supabase dashboard, open your project → **Settings** (gear icon) → **Database**.
2. Find the **Connection string** section and the **URI** format. It looks like:
   ```
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
   ```
   (Dashboard wording changes occasionally — look for "Connection string" / "Connection pooling" with a host like `aws-0-… .pooler.supabase.com` and user `postgres.<project-ref>`.)
3. You will use **two forms** of this URL:

   | Use for | Port | Notes |
   |---|---|---|
   | **Setup CLI** (`db push`, seed) | `5432` — *Session pooler* | Use exactly as shown |
   | **Deployed app on Vercel** | `6543` — *Transaction pooler* | Add `?pgbouncer=true&connection_limit=1` |

   > Why two? Vercel runs the app as many short-lived serverless functions. The **transaction pooler** (PgBouncer-compatible) is built for that, but disables Prisma's prepared statements — the `pgbouncer=true` parameter handles this. Schema migrations don't work well through it, so setup commands use the session pooler instead.
   >
   > Ignore the **direct connection** (`db.<project-ref>.supabase.co:5432`) — it is IPv6-only unless you buy the IPv4 add-on, and you don't need it.
4. Replace `[YOUR-PASSWORD]` with the database password from Part 1.

> **Security note:** the connection string contains your database password. Never commit it to Git, never paste it into chat tools, and paste it only into terminal commands and Vercel's environment-variable screen. The repository's `.gitignore` already excludes `.env`.

---

## Part 3 — Create the database schema (~5 min)

Choose **one** of the two paths — the result is identical.

### Path A — Prisma CLI (recommended)

From the repository root:

```bash
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres" \
  bun run db:push:supabase
```

- npm users: `DATABASE_URL="…" npx prisma db push --schema prisma/schema.postgres.prisma`
- This creates all 15 tables (`Company`, `User`, `Session`, `Event`, … `Notice`) plus their indexes and foreign keys, and regenerates the Prisma Client for Postgres.
- Expected ending: `✔ Your database is now in sync with your Prisma schema.`

### Path B — Supabase SQL Editor (no CLI needed)

1. Dashboard → **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from the repository, copy **all** of it, paste it into the editor.
3. Click **Run**. You should see `Success. No rows returned`.

> `supabase/schema.sql` is generated directly from the Prisma schema with
> `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.postgres.prisma --script`, so it creates exactly what Path A creates.

**Verify either path:** Dashboard → **Table Editor** → you should see the 15 tables (`Company`, `User`, `Event`, …), all empty.

---

## Part 4 — Load the demo data (~3 min)

Run the seed against Supabase (Path A users can continue in the same terminal; Path B users should run the Prisma generate step first — see the note below):

```bash
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres" \
  bun run db:seed
```

This creates the fictional demo company **Lotus & Nile Weddings Co.** — 5 events, vendors, a complete payment ledger, tasks, run sheets, issues, documents and audit history:

| Role | Email | Password |
|---|---|---|
| CEO | `ceo@potchaops.demo` | `Demo@1234` |
| Finance | `finance@potchaops.demo` | `Demo@1234` |
| Operations | `ops@potchaops.demo` | `Demo@1234` |
| Operations | `ops2@potchaops.demo` | `Demo@1234` |

**Verify:** Table Editor → `Company` and `User` tables now have rows.

> **Path B note (CLI-free):** the seed script uses the generated Prisma Client, which on your machine is currently built for SQLite. Run it once for Postgres with:
> `DATABASE_URL="…" npx prisma generate --schema prisma/schema.postgres.prisma` **before** seeding, and afterwards restore the SQLite client for local dev with `bun run db:generate`.

> **After seeding via Supabase, if you also develop locally with SQLite**, run `bun run db:generate` — it re-points the local Prisma Client at SQLite so `bun run dev` keeps working with the local `db/custom.db`.

> **Prefer to start with an empty production database?** Skip Part 4 entirely. After deploying, use **"Start your own workspace"** on the login screen — the first account you create becomes the CEO of a fresh, fully isolated company. You can always load the demo later with `db:seed` (it only ever touches data flagged `isDemo`).

---

## Part 5 — Lock down Supabase's REST API (~2 min, recommended)

The app talks to Supabase only through the pooled Postgres connection — it never uses Supabase's auto-generated REST API. Lock that API down as defense-in-depth:

1. Dashboard → **SQL Editor** → **New query**.
2. Paste the whole of `supabase/rls-lockdown.sql` → **Run**.
3. The result grid should show `rls_enabled = true` for all 15 tables.

What this does:

- Enables **Row Level Security** on every table with **no policies** → Supabase REST calls with the `anon` or `authenticated` keys get **zero rows** (deny-by-default).
- The app is unaffected: it connects as the table owner through the pooler, and owners are exempt from RLS.
- The `service_role` key bypasses RLS by Supabase's design — treat it like a database password and never expose it in a browser.

---

## Part 6 — Put the code on GitHub (~3 min)

```bash
git init                                   # if not already a repo
git add -A
git commit -m "Potcha Ops"
# Confirm no secrets are staged:
git status                                  # .env must NOT appear; .env.example is fine
# Create a PRIVATE repository on github.com, then:
git remote add origin git@github.com:<you>/potcha-ops.git
git push -u origin main
```

Keep the repository **private** — it contains your business logic.

---

## Part 7 — Deploy the app on Vercel (~10 min)

1. Go to [vercel.com](https://vercel.com) → **Add New… → Project**.
2. **Import** your `potcha-ops` repository.
3. Framework preset is auto-detected as **Next.js** — leave defaults.
4. Open **Environment Variables** and add (for **Production** and **Preview**):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1` |

   Port **6543** and the two query parameters — this is the transaction-pooler form from Part 2.

5. Expand **Build and Output Settings** → override **Build Command** with:

   ```
   bun run vercel-build
   ```

   (npm users: `npx prisma generate --schema prisma/schema.postgres.prisma && next build`)

   > **This step is essential.** It regenerates the Prisma Client with the Postgres engine before building. Without it, the build uses the SQLite-flavored client and every database call fails at runtime.

6. Click **Deploy**. First build takes ~2–4 minutes; you'll get a URL like `https://potcha-ops.vercel.app`.

Notes:

- `next.config.ts` sets `output: "standalone"` for VPS/Docker self-hosting — Vercel ignores this setting, no change needed.
- Every later `git push` to the default branch redeploys automatically.

---

## Part 8 — Verify the deployment (~5 min)

1. Open your Vercel URL — you should see the Potcha Ops login screen.
2. Log in as each demo role and check:

   | Check | Expected |
   |---|---|
   | `ceo@potchaops.demo` dashboard | KPI cards with events, revenue, readiness |
   | `ops@potchaops.demo` sidebar | No Finance / Team sections (restricted client-side) |
   | Ops opens `/api/payments` directly | `403 Forbidden` (restricted server-side) |
   | Wrong password | `401` + error toast |

   Quick server-side RBAC check from your terminal:

   ```bash
   curl -s -X POST https://YOUR-APP.vercel.app/api/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"ops@potchaops.demo","password":"Demo@1234"}'
   # → copy the "sessionToken" value, then:
   curl -s https://YOUR-APP.vercel.app/api/payments \
     -H 'Authorization: Bearer <TOKEN>'
   # → {"error":"Forbidden: financial data requires \"finance.view\"",...}
   ```

3. **Run the full 38-check security audit against production:**

   ```bash
   APP_URL=https://YOUR-APP.vercel.app bun run scripts/security-audit.ts
   # Expected: RESULT: 38 passed, 0 failed
   ```

   This exercises tenant isolation, role restrictions, ledger immutability and auth edge cases against your live deployment. Keep the output.

---

## Part 9 — Go-live checklist

- [ ] **Rotate the demo passwords** (CEO → Team → each user) or disable the demo users before storing real client data.
- [ ] Register your **real company** via "Start your own workspace" (fresh tenant, fully isolated).
- [ ] Set a **custom domain**: Vercel → Settings → Domains (adds the domain, gives you DNS records to point).
- [ ] Confirm **backups**: free tier keeps daily backups for 7 days; the Pro plan adds point-in-time recovery.
- [ ] Keep the `service_role` key and database password out of all shared documents.
- [ ] Re-run `APP_URL=https://your-domain bun run security-audit` after any config change.
- [ ] If you're on the Supabase free tier, remember the ~1-week inactivity pause — or upgrade before going live with clients.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Error: P1001: Can't reach database server` | Wrong host/port, or you used the IPv6-only direct host | Use the pooler host `aws-0-…pooler.supabase.com` exactly as shown in the dashboard |
| `db push` hangs or fails with prepared-statement errors | Running migrations through the transaction pooler | Use the **session pooler (port 5432)** for all CLI steps; keep 6543 only for the deployed app |
| App deploys but every request 500s / `PrismaClientInitializationError` | Build command not overridden — SQLite-flavored client in the bundle | Set Build Command to `bun run vercel-build` and redeploy |
| Login returns 401 immediately after deploy | `DATABASE_URL` missing/wrong on Vercel | Project → Settings → Environment Variables → fix → **Redeploy** (env vars apply at build/deploy time) |
| Local `bun run dev` broken after Supabase setup | Local Prisma Client still built for Postgres | `bun run db:generate` |
| Supabase dashboard shows tables but app sees no data | Seeded a different project than the app connects to | Compare the `[PROJECT-REF]` in the URL vs. your `DATABASE_URL` |
| `relation "Company" does not exist` | Schema never created in that database | Re-run Part 3 |
| Free-tier project stopped responding | Project paused after inactivity | Dashboard → your project → **Restore** |

---

## How this setup was verified

Everything that could be tested locally **was** tested locally, against a real PostgreSQL 17 server (the same major version Supabase runs):

- ✅ `prisma db push --schema prisma/schema.postgres.prisma` created all 15 tables
- ✅ `bun run db:seed` loaded the demo company through the Postgres Prisma Client (5 users, 5 events, 50 payments)
- ✅ The Next.js app ran with `DATABASE_URL` pointed at Postgres: login, session, and dashboard APIs all returned 200 with the same KPIs as the SQLite build (3 active events, EGP 3,783,000 contracted revenue)
- ✅ Role enforcement intact: Operations → `/api/payments` = 403; wrong password = 401
- ✅ The **full 38-check security audit passed 38/38** against the Postgres-backed app
- ✅ `supabase/rls-lockdown.sql` applied cleanly: RLS enabled on 15/15 tables, an `anon`-style role saw **0 rows** (deny-by-default) while the app kept working
- ✅ Switching back to SQLite (`bun run db:generate`) restored local development with no data loss

**Not verified here (honesty note):** creating an actual Supabase account/project and a Vercel deployment — this environment has no accounts. Parts 1, 2 and 7 describe the current dashboard flows; Supabase and Vercel redesign their consoles occasionally, so a label may differ slightly — the underlying settings (connection string, SQL Editor, environment variables, build command) are stable concepts.

---

## Cost snapshot

| Service | Free tier | Paid (for a real agency) |
|---|---|---|
| Supabase | 500 MB DB, daily backups (7-day retention), projects pause after inactivity | Pro ~$25/month — no pausing, 8 GB, point-in-time recovery |
| Vercel | Hobby: free for **non-commercial** use | Pro ~$20/month/team — required for commercial use |
| **Total** | **$0 to try** | **~$45/month production** |

The demo dataset is only a few MB — the free 500 MB comfortably holds years of real events for one agency.

---

## FAQ

**Do I need Supabase Auth?**
No. Potcha Ops ships its own battle-tested authentication (bcrypt + opaque, server-revocable session tokens with cookie **and** Bearer-header support). Supabase is used purely as managed Postgres. Migrating to Supabase Auth would be an application code change and is not part of this setup.

**Do I need Supabase Storage?**
No. Documents are stored in the database (5 MB/file cap) and served through an authorization-checked endpoint. Moving to object storage is a future optimization, not a setup requirement.

**Can I self-host on a VPS instead of Vercel?**
Yes — any PostgreSQL 15+ works. Point `DATABASE_URL` at it, run `db:push:supabase` (despite the name, it works with any Postgres), and follow `docs/DEPLOYMENT.md` Option B. The Postgres path itself was verified against vanilla PostgreSQL 17.

**Why does local development still use SQLite?**
Speed and zero setup. The app code is identical — only the Prisma engine differs. You can develop against Supabase anytime by starting the dev server with `DATABASE_URL` set to the Supabase URL (after `bun run db:generate:supabase`).

**Can several wedding-planning companies share one deployment?**
Yes — the app is multi-tenant. Every row is company-scoped and every query is filtered server-side; cross-company IDs return 404 (tenant isolation is covered by 6 checks in the security audit).

**What if I later want Supabase's dashboard features (RLS per user, realtime)?**
Possible, but it means wiring Supabase Auth into the app first. The current `rls-lockdown.sql` keeps the REST surface closed until you deliberately open it.

---

*Potcha Ops — setup guide for the Supabase deployment path. Companion documents: `docs/DEPLOYMENT.md` (Vercel/VPS/Docker overview), `docs/SECURITY.md` (security architecture), `docs/USER_GUIDE.md` (role-by-role handbook).*
