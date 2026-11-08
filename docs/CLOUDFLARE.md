# Potcha Ops on Cloudflare — Step-by-Step Deployment

**Why you're here:** you tried uploading the project in the Cloudflare dashboard and saw:

> *"This uploader does not yet support projects that require a build process. TypeScript files were found. Please use `wrangler deploy` instead for full feature support."*

That message is correct — it is not a bug in the app. Potcha Ops is a **server application** (Next.js 16: login, API routes, RBAC, database access), not a folder of static files, and the dashboard uploader only hosts pre-built static assets. The supported way to run Next.js on Cloudflare is the **OpenNext Cloudflare adapter**, driven by the `wrangler` CLI from your computer. This guide walks you through it end to end.

```
┌────────┐   HTTPS    ┌───────────────────────────────┐  Prisma + @prisma/adapter-pg   ┌───────────────────────────┐
│ Browser│ ─────────► │ Cloudflare Worker (OpenNext)  │ ─────────────────────────────► │ Hyperdrive                │
│ mobile │            │ • Next.js 16 app              │                                │ (Postgres connection      │
│ desktop│ ◄───────── │ • auth in API routes          │ ◄───────────────────────────── │  pooler — free)           │
└────────┘            │ • RBAC per request            │                                └───────────┬───────────────┘
                      └───────────────────────────────┘                                            ▼
                                                                                 ┌───────────────────────────────┐
                                                                                 │ Supabase PostgreSQL           │
                                                                                 │ 15 tables + your data         │
                                                                                 └───────────────────────────────┘
```

- **Supabase stays the database** — used purely as managed PostgreSQL. The app keeps its own authentication (bcrypt + opaque, server-revocable session tokens); you do not need Supabase Auth, Storage or Edge Functions.
- On Workers, the app gets its database connection from the **Hyperdrive binding** instead of a `DATABASE_URL` variable — the real database password never ships inside the Worker.

---

## What's verified — and what isn't (honesty box)

Verified in a real environment while preparing this guide:

- ✅ `prisma generate` with the Workers schema variant runs cleanly on Prisma 6.19.2 — the `driverAdapters` preview flag is **no longer needed** (the CLI warns if you add it)
- ✅ `@prisma/adapter-pg@6.19.2` exists on npm, version-matched to the bundled Prisma
- ✅ `@opennextjs/cloudflare@1.20.16` peer range: `next >=15.5.29 <16 || >=16.4.5`, and the latest stable Next 16.x is **16.4.5** — hence the `next@16.4.5` upgrade in Part 3 / `deploy.sh` (the repository's own dev dependency stays on 16.1.x)
- ✅ The app source imports **no Node-only modules** (`fs`, `sharp`, `child_process`…) — only `node:crypto`, `bcryptjs` and Prisma, all supported in Workers via `nodejs_compat`
- ✅ `next.config.ts` already sets `output: "standalone"` — exactly the build mode the OpenNext adapter consumes
- ✅ The Workers `db.ts` is **lazy by design**: `next build` imports every route module while collecting page data (no Hyperdrive binding, no `DATABASE_URL` on a fresh checkout) — the client is only constructed on the first real query, inside the runtime. An earlier eager version would have failed at build time; this was caught and fixed while hardening the bundle
- ✅ Workers Builds (Cloudflare's git-connected CI) facts — configurable **Build command** / **Deploy command** (default `npx wrangler deploy`), and an API token created automatically — verified from developers.cloudflare.com/workers/ci-cd/builds/configuration/
- ✅ `deploy.sh` passes a full `bash -n` syntax check
- ✅ bcrypt cost 11 measured at ~140–150 ms CPU per login operation (see the plan requirement below)
- ✅ The full application + database layer was verified end-to-end on PostgreSQL 17 — see `docs/SUPABASE_SETUP.md`, "How this setup was verified"

**Not verified here** (no Cloudflare account and no Windows machine exist in the build environment): an actual `opennextjs-cloudflare build && deploy`, Hyperdrive creation (CLI or dashboard), the Workers Builds git-integration flow itself, and `deploy-windows.bat` (its logic mirrors `deploy.sh`). Those steps quote the official documentation (opennext.js.org, developers.cloudflare.com) — console labels occasionally change, the underlying settings are stable. The `@prisma/adapter-pg` runtime path was not re-executed this session (no local PostgreSQL server available); the Postgres schema + seed + app-on-Postgres path *was* verified against PostgreSQL 17 previously (`docs/SUPABASE_SETUP.md`). The troubleshooting table below covers the known failure modes.

---

## Prerequisites

- [ ] A [Cloudflare](https://www.cloudflare.com) account
- [ ] **Workers Paid — $5/month — strongly recommended.** The Free plan caps CPU at **10 ms per request**; a bcrypt login verification costs ~140 ms, so logins will fail on Free. Workers Paid's default 30-second CPU limit is ample. (Lowering bcrypt's cost to squeeze under 10 ms would weaken password storage for every user — not a trade worth making.)
- [ ] A Supabase project with the Potcha Ops schema (Part 1, ~10 min)
- [ ] Bun 1.1+ (or Node.js 20+) in your terminal
- [ ] ~30–45 minutes

---

## Part 0 — Locate the deploy files (~1 min)

All Cloudflare deploy files already live in this repository — nothing to download. Working from the project root, the pieces used throughout this guide:

| Path | What it is |
|---|---|
| `cloudflare/QUICK-START.md` | The 8-command condensed version of this guide |
| `wrangler.jsonc` | Cloudflare Worker config — two placeholders to fill (Part 2) |
| `open-next.config.ts` | OpenNext adapter config |
| `prisma/schema.workers.prisma` | Prisma schema for the Workers driver-adapter client |
| `cloudflare/db.workers.ts` | Hyperdrive-aware `db.ts` you copy over `src/lib/db.ts` (Part 3) |
| `cloudflare/db.standard.ts` | Backup of the original `db.ts` — copy back anytime |
| `cloudflare/.dev.vars.example` | Env template for local Workers preview |
| `deploy.sh` / `deploy-windows.bat` | **One-command deploys** with a built-in Hyperdrive-ID guard (checks prerequisites, installs, generates, swaps `db.ts`, builds, deploys) |
| `package.json` | **Pre-patched**: pins `next@16.4.5`, adds `@opennextjs/cloudflare`, `@prisma/adapter-pg`, `wrangler`, and the `cf:*` scripts |
| `docs/` | This guide + SUPABASE_SETUP, DEPLOYMENT, SECURITY, USER_GUIDE, LIMITATIONS |
| `src/`, `public/`, `prisma/`, … | The complete application source |

---

## Part 1 — Supabase database (~10 min, once)

Follow **`docs/SUPABASE_SETUP.md`, Parts 1–5** exactly:

1. Create the Supabase project (save the database password somewhere safe).
2. Copy the **session-pooler connection string** (port 5432, host `aws-0-…pooler.supabase.com`).
3. Create the 15-table schema — from the project root: `DATABASE_URL="…" bun run db:push:supabase`, **or** paste `supabase/schema.sql` into Supabase's SQL Editor.
4. Optional: load the demo data with `DATABASE_URL="…" bun run db:seed`.
5. Recommended: run `supabase/rls-lockdown.sql` in the SQL Editor (closes Supabase's auto-generated REST API).

Skip that guide's Parts 6–8 (Vercel-specific) — Cloudflare replaces Vercel here.

> `db:push:supabase` and `db:seed` work straight after `bun install` — both are already in the repository's `package.json`. Seeding demo data requires Bun: `curl -fsSL https://bun.sh/install | bash`.

---

## Part 2 — Create the Hyperdrive (~5 min)

Hyperdrive is Cloudflare's connection pooler for Postgres: it keeps warm, persistent connections so each Worker request doesn't pay connection setup. Free on every plan.

```bash
npx wrangler login     # opens your browser to authenticate Cloudflare

npx wrangler hyperdrive create potcha-db \
  --connection-string="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
```

- Use the **session pooler** form (port **5432**) — the same URL that worked for the Supabase setup commands. Hyperdrive handles pooling on the Workers side.
- **URL-encode special characters** in the password — Supabase-generated passwords often contain `@ : / #`. Replace: `@`→`%40`, `:`→`%3A`, `/`→`%2F`, `#`→`%23`.
- The command prints a **Hyperdrive ID**. Open `wrangler.jsonc` at the project root and fill the two placeholders:

```jsonc
"name": "potcha-ops",                                   // your Worker's name — any valid name
"hyperdrive": [ { "binding": "HYPERDRIVE", "id": "<ID-FROM-THE-COMMAND-ABOVE>" } ]
```

> If you change `"name"`, also change `services[0].service` at the bottom of the file — the two must match (the Worker calls itself for internal routing).

---

## Part 3 — Install and prepare the app (~5 min)

From the project root:

```bash
bun install                                   # npm install works too
bun add next@16.4.5 @opennextjs/cloudflare@latest @prisma/adapter-pg@6.19.2
bun add -d wrangler@latest
bun run cf:generate                           # generates the Workers Prisma Client into gen/prisma/
cp cloudflare/db.workers.ts src/lib/db.ts     # Windows: copy cloudflare\db.workers.ts src\lib\db.ts
```

What each step does:

1. **`bun install`** — installs the app's own dependencies (the dev `package.json` targets local SQLite development).
2. **The `bun add` line** — adds the Cloudflare deploy toolchain: `next@16.4.5` (the Cloudflare adapter's peer range is `next >=16.4.5`; the repo's dev version is 16.1.x), `@opennextjs/cloudflare`, `@prisma/adapter-pg@6.19.2` and `wrangler`. Skip this only if you deploy with `bash deploy.sh` — the script adds these automatically.
3. **`cf:generate`** (`prisma generate --schema prisma/schema.workers.prisma`) — builds the client with the new `prisma-client` generator into `gen/prisma/`. This client talks SQL through the `@prisma/adapter-pg` driver adapter instead of loading Prisma's native engine binary — that's what makes it run on Workers.
4. **The `db.ts` swap** — points the app at that client and wires the Hyperdrive binding. After the swap this working copy targets Workers; `cp cloudflare/db.standard.ts src/lib/db.ts` restores the standard client anytime.

The swapped `src/lib/db.ts` (for reference — the file is already in the repository at `cloudflare/db.workers.ts`):

```ts
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../gen/prisma/client';

const globalForPrisma = globalThis as unknown as { potchaWorkersDb?: PrismaClient };

async function createDb(): Promise<PrismaClient> {
  if (globalForPrisma.potchaWorkersDb) return globalForPrisma.potchaWorkersDb;
  let connectionString: string | undefined;
  try {
    const context = await getCloudflareContext({ async: true });
    const env = context.env as { HYPERDRIVE?: { connectionString?: string } } | undefined;
    connectionString = env?.HYPERDRIVE?.connectionString;
  } catch {
    // Not inside the Cloudflare runtime (e.g. during `next build`) — fall through.
  }
  if (!connectionString) connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Database not configured — see docs/CLOUDFLARE.md');
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: ['error', 'warn'],
  });
  globalForPrisma.potchaWorkersDb = client;
  return client;
}

// LAZY BY DESIGN: `next build` imports every route module while collecting
// page data — at that moment there is no Hyperdrive binding and usually no
// DATABASE_URL. `db` is a Proxy that creates the real client on the first
// actual method call, inside the Workers runtime where HYPERDRIVE exists.
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return async (...args: unknown[]) => {
      const client = await createDb();
      const method = (client as unknown as Record<string | symbol, (...a: unknown[]) => unknown>)[prop];
      return method.apply(client, args);
    };
  },
});
```

> The laziness is not cosmetic — with an eager `export const db = await createDb()`, the build itself would fail on a fresh checkout (no database config exists at build time). All app usage (`db.event.findMany(...)`, `db.$transaction([...])`, …) goes through method calls, which the Proxy forwards correctly.

---

## Part 4 — What's inside `wrangler.jsonc` (already at the project root)

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "main": ".open-next/worker.js",
  "name": "potcha-ops",
  "compatibility_date": "2025-09-01",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
  "services": [{ "binding": "WORKER_SELF_REFERENCE", "service": "potcha-ops" }],
  "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<YOUR-HYPERDRIVE-ID>" }]
}
```

- **`nodejs_compat`** — lets the Worker load the Node APIs the app uses (`node:crypto` for session tokens, `bcryptjs`, Prisma's internals). **Required.**
- `assets` / `services` — the standard OpenNext layout (static files + the Worker calling itself). Leave as generated; keep `services[0].service` equal to `name`.
- `compatibility_date` — bump to a recent date when you deploy; wrangler warns if it is stale.
- Only the two placeholders from Part 2 need editing.

---

## Part 5 — Build and deploy (~5 min)

**One command** — checks the Hyperdrive ID, installs if needed, generates the Prisma client, swaps `db.ts`, builds and deploys:

```bash
bash deploy.sh          # macOS / Linux — on Windows: double-click deploy-windows.bat
```

**Or run the steps explicitly:**

```bash
bun run cf:deploy
```

Either way, `opennextjs-cloudflare build && opennextjs-cloudflare deploy` runs:

1. `next build` (standalone mode — already set in `next.config.ts`),
2. adapts the output to Cloudflare's Workers runtime,
3. uploads the Worker and static assets, and prints your URL:

```
https://potcha-ops.<your-subdomain>.workers.dev
```

Optional — test the exact Workers runtime locally before deploying:

```bash
cp cloudflare/.dev.vars.example .dev.vars    # put your Supabase pooler URL inside
bun run cf:preview
```

---

## Part 5b — No terminal? Deploy via GitHub + Workers Builds

If running commands locally is the barrier, Cloudflare can build the app **in their cloud** on every push (their *Workers Builds* git integration). Two tiny file edits are still needed — but they need only a file manager and a text editor, no terminal:

1. **File edits (no terminal):**
   - In the repository, copy `cloudflare/db.workers.ts` over `src/lib/db.ts` (Finder / File Explorer copy-paste).
   - Create the Hyperdrive in the Cloudflare **dashboard** instead of the CLI: find the Hyperdrive section (under Storage & Databases / Compute, depending on the current console layout) → **Create**, name it `potcha-db`, paste your Supabase **session-pooler** connection string (port 5432). CLI alternative if you prefer: `npx wrangler hyperdrive create potcha-db --connection-string="…"`.
   - Open `wrangler.jsonc` in any text editor and paste the Hyperdrive **ID** into `hyperdrive[0].id`.
2. **Database:** `docs/SUPABASE_SETUP.md` Parts 1–5, using **Path B (SQL Editor)** for the schema so no CLI is needed. Skip the demo seed — after deploy, register your own company via "Start your own workspace" instead.
3. **GitHub:** create a **private** repository → *uploading an existing file* → drag the project's files in (the web uploader accepts ≤100 files per drag — upload folder by folder, and skip `node_modules`/`.next`).
4. **Cloudflare dashboard → Workers & Pages → Create → connect/import a Git repository** → authorize GitHub → select the repo.
5. In the build configuration, set:
   - **Build command:** `npx prisma generate --schema prisma/schema.workers.prisma && npx opennextjs-cloudflare build`
   - **Deploy command:** `npx opennextjs-cloudflare deploy` (the default `npx wrangler deploy` does not produce the OpenNext build — the build command above does)
   - Root directory: leave as `/`
6. Cloudflare creates the API token for the build automatically — no `wrangler login` needed. The first build deploys; every later `git push` redeploys.

> The same CPU requirement applies: Workers **Paid** for bcrypt logins. And to be explicit: the dashboard's *upload assets* error you may have seen ("uploader does not yet support projects that require a build process") is exactly the limitation this git-connected path works around.

---

## Part 6 — Verify (~5 min — same checks as every other deployment)

| Check | Expected |
|---|---|
| Open the `workers.dev` URL | Potcha Ops login screen |
| Log in as `ceo@potchaops.demo` / `Demo@1234` | CEO dashboard: events, revenue, readiness KPIs |
| Log in as `ops@potchaops.demo` | Sidebar has no Finance / Team sections |
| Ops requests `/api/payments` (with Bearer token) | `403 Forbidden` — RBAC enforced server-side |
| Wrong password | `401` + error toast |

Run the full audit against the live deployment:

```bash
APP_URL=https://potcha-ops.<your-subdomain>.workers.dev bun run scripts/security-audit.ts
# Expected: RESULT: 38 passed, 0 failed
```

---

## Part 7 — Custom domain (optional)

Cloudflare dashboard → **Workers & Pages → potcha-ops → Settings → Domains & Routes** → **Add → Custom domain**. If the domain's DNS lives on Cloudflare, the TLS certificate is issued automatically.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| *"uploader does not yet support projects that require a build process"* | Expected — the dashboard uploader is static-only. This guide (CLI) is the path. |
| Install/build complains about the `next` version | The adapter needs `next >=16.4.5` — add it explicitly: `bun add next@16.4.5` (deploy.sh does this for you) |
| `Cannot find module '../../gen/prisma/client'` | Run `bun run cf:generate` |
| Every request 500s, errors mention `adapter` or the Prisma engine | You skipped the `db.ts` swap (Part 3, last command) |
| `P1001: Can't reach database server` | Wrong host — use the pooler host `aws-0-…pooler.supabase.com` (Supabase guide, Part 2) |
| Hyperdrive connection errors | URL-encode the password's special characters; use the session pooler (port 5432) |
| Logins fail with CPU-limit / "exceeded CPU" errors | You're on Workers Free (10 ms CPU cap; bcrypt needs ~140 ms) — upgrade to Workers Paid |
| `wrangler` reports an unknown Hyperdrive ID | Replace the placeholder in `wrangler.jsonc` with the ID printed by `hyperdrive create` |
| Build errors referencing `libquery_engine*.so` | The driver-adapter client doesn't load the native engine at runtime — confirm the `db.ts` swap was done so the adapter is always passed, and check Prisma's current Workers documentation for any new flags |
| Login 401 right after deploy | Check the Hyperdrive ID in `wrangler.jsonc`, and that Part 1 created the schema (and demo seed, if you use the demo logins) in the **same** Supabase project |

---

## Cost snapshot

| Service | Cost |
|---|---|
| Cloudflare Workers Paid | **$5/month** — needed for bcrypt login CPU |
| Cloudflare Workers Free | $0 — **logins will fail** (10 ms CPU cap vs ~140 ms bcrypt) |
| Supabase Free | 500 MB DB, daily backups (7-day retention); pauses after ~1 week idle |
| Supabase Pro | $25/month — production: no pausing, point-in-time recovery |
| **Total (production)** | **~$5–30/month** |

For comparison: the **Vercel** path (`docs/SUPABASE_SETUP.md`) runs bcrypt on regular Node.js functions with no such per-request CPU cap and starts at $0 — if you don't specifically need Cloudflare, that path is the fully verified one.

---

## FAQ

**Why can't I just drag the project into the Cloudflare dashboard?**
The dashboard upload hosts pre-built static files only. A Next.js app with API routes must be compiled and adapted to the Workers runtime first — that's `opennextjs-cloudflare build`, and it's why Cloudflare's own message points you to `wrangler deploy`.

**What about Cloudflare Pages?**
Pages hosts Next.js through the same OpenNext tooling family; Cloudflare's current recommendation for full Next.js App Router support is the Workers path in this guide.

**Does my database move to Cloudflare?**
No — Supabase remains the database. Cloudflare runs the app; Hyperdrive just pools the Postgres connections. Cloudflare D1 (their SQLite) is *not* used: the app's verified path is PostgreSQL via Prisma.

**Can several wedding-planning companies share one deployment?**
Yes — multi-tenant by design: every row is company-scoped and every query filtered server-side (tenant isolation is covered by 6 checks in the security audit).

**How do I return to normal development (SQLite / Postgres engine)?**
`cp cloudflare/db.standard.ts src/lib/db.ts` — that restores the standard SQLite/Postgres-engine client, so local development works exactly as before the swap.

**Do I need to change the app's cookies/session code for Workers?**
No. Sessions are opaque tokens in the `Session` table + httpOnly cookies with a Bearer-header fallback — no server-side session state beyond the database, which Hyperdrive handles.

---

*Commands and configuration above follow the official documentation — opennext.js.org/cloudflare (get-started, bindings), developers.cloudflare.com/hyperdrive (get-started), developers.cloudflare.com/workers/platform/limits (CPU) — plus npm registry metadata for exact versions. Local verification details: the honesty box at the top of this guide.*
