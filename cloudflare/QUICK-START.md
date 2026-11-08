# Potcha Ops → Cloudflare Workers — Quick Start

> **Why the dashboard upload failed:** Cloudflare's uploader only hosts
> pre-built static files. Potcha Ops is a server application (Next.js: login,
> API routes, database), so it must be built and deployed with the `wrangler`
> CLI — exactly what Cloudflare's error message suggests. Full guide with
> details & troubleshooting: **`docs/CLOUDFLARE.md`**.
>
> **No terminal at all?** See `docs/CLOUDFLARE.md` **Part 5b** — deploy via
> GitHub + Cloudflare's git-connected builds (file edits + web dashboards only).

**You need:** a Cloudflare account · a Supabase project · Bun 1.1+ (or Node 20+) · ~30 min.
**Plan note:** Workers **Paid** ($5/mo) is recommended — a bcrypt login costs
~140 ms CPU, above the Free plan's 10 ms/request cap (details in the guide).

## Steps

1. **Database** — create it once (~10 min): follow `docs/SUPABASE_SETUP.md`
   Parts 1–5 (stop before the Vercel parts). Keep the **session-pooler**
   connection string (port 5432).

2. **Authenticate wrangler:**
   ```bash
   npx wrangler login
   ```

3. **Create Hyperdrive** (Cloudflare's Postgres connection pooler, free):
   ```bash
   npx wrangler hyperdrive create potcha-db --connection-string="postgresql://postgres.PROJECT-REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
   ```
   URL-encode special characters in the password (`@`→`%40`, `:`→`%3A`, `/`→`%2F`, `#`→`%23`).
   Put the printed **ID** into `wrangler.jsonc` → `hyperdrive[0].id`.

4. **Deploy — one command** (installs — including the Cloudflare adapter
   packages — generates the Prisma client, swaps `db.ts`, builds, deploys;
   refuses politely if the Hyperdrive ID is missing):
   ```bash
   bash deploy.sh          # macOS / Linux
   ```
   Windows: **double-click `deploy-windows.bat`** (uses Bun if installed, otherwise npm/npx).

   → prints `https://potcha-ops.<your-subdomain>.workers.dev`

5. **Verify** — log in as `ceo@potchaops.demo` / `Demo@1234` (if you seeded the
   demo) or register your own company, then run the audit:
   ```bash
   APP_URL=https://potcha-ops.<your-subdomain>.workers.dev bun run scripts/security-audit.ts
   # Expected: RESULT: 38 passed, 0 failed
   ```

## Prefer to run the commands yourself?

```bash
bun install                                                   # or: npm install
bun add next@16.4.5 @opennextjs/cloudflare@latest @prisma/adapter-pg@6.19.2
bun add -d wrangler@latest
bun run cf:generate                                           # Workers Prisma client → gen/prisma/
cp cloudflare/db.workers.ts src/lib/db.ts                     # Windows: copy cloudflare\db.workers.ts src\lib\db.ts
bun run cf:deploy                                             # build + deploy
```

Undo the `db.ts` switch anytime: `cp cloudflare/db.standard.ts src/lib/db.ts`

Other deployment options (Vercel / VPS / Docker): `docs/DEPLOYMENT.md`.
