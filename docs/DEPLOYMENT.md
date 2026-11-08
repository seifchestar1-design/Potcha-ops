# Potcha Ops — Deployment Guide

Potcha Ops is a Next.js 16 application with a Prisma-backed database. It can run anywhere Node.js/Bun runs. The app is served from a **single route (`/`)** with hash-based in-app navigation, which makes it especially easy to host behind any proxy or CDN.

## Option A — Vercel (easiest)

1. Push the repository to GitHub/GitLab.
2. Import the project in Vercel.
3. Set environment variables (Project → Settings → Environment Variables):
   - `DATABASE_URL` — a hosted PostgreSQL connection string (recommended: Supabase, Neon, or RDS). SQLite on Vercel is not persistent. This is the **only** variable the app requires (`SESSION_SECRET` is reserved/unused — sessions are opaque random tokens).
4. Override the **Build Command** with `bun run vercel-build` — this generates the Prisma Client from `prisma/schema.postgres.prisma` and then builds. Without it, the SQLite-flavored client is bundled and every database call fails at runtime.
5. Create the schema and (optionally) seed demo data from your machine.
6. Deploy. Create your company via the onboarding screen ("Start your own workspace").

**Recommended:** follow **`docs/SUPABASE_SETUP.md`** — the full step-by-step walkthrough for Supabase + Vercel, covering connection-pooler settings, schema creation (CLI or SQL Editor), demo-data seeding, REST-API lockdown and a go-live checklist. The Postgres schema variant (`prisma/schema.postgres.prisma`), SQL scripts (`supabase/`) and helper scripts are already in the repository — no manual schema editing needed.

**Note on Supabase:** the app's application-layer tenant isolation already scopes every query by company; as defense-in-depth you can additionally run `supabase/rls-lockdown.sql` (Supabase SQL Editor) to close the auto-generated REST API — see the Supabase guide, Part 5.

## Option B — VPS / dedicated server (full control)

```bash
# 1. Server setup (Ubuntu example)
sudo apt update && sudo apt install -y nodejs npm nginx
npm install -g bun

# 2. Application
git clone <your-repo> /opt/potcha-ops && cd /opt/potcha-ops
bun install
cp .env.example .env && nano .env   # set SESSION_SECRET and DATABASE_URL
bun run db:push
bun run db:seed                     # optional: demo environment

# 3. Build & run with process manager
bun run build
pm2 start "bun .next/standalone/server.js" --name potcha-ops

# 4. Reverse proxy with TLS (nginx + certbot)
#    server { server_name potcha.yourdomain.com;
#      location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; }
#    }
sudo certbot --nginx -d potcha.yourdomain.com
```

## Option C — Docker

```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", ".next/standalone/server.js"]
```

Run with a mounted volume for SQLite (`-v potcha-data:/app/db`) or point `DATABASE_URL` at PostgreSQL.

## Option D — Cloudflare Workers

Runs on Cloudflare's edge via the OpenNext Cloudflare adapter, with Supabase as the database and Hyperdrive for connection pooling. The dashboard's direct upload cannot build Next.js apps — deployment is CLI-based (`wrangler`). Full walkthrough: **`docs/CLOUDFLARE.md`** — everything you need (`wrangler.jsonc`, `open-next.config.ts`, `cloudflare/db.workers.ts`, `deploy.sh`) already lives at the project root.

Note: the Workers **Free** plan caps CPU at 10 ms/request; a bcrypt login verification (~140 ms) exceeds it — plan on Workers Paid ($5/month).

---

## Post-deployment checklist

- [ ] `DATABASE_URL` points at your production database (the only required variable; `SESSION_SECRET` is reserved/unused).
- [ ] HTTPS is active (session cookies are `secure`-flagged in production).
- [ ] Database backups are scheduled (SQLite file copy or `pg_dump`).
- [ ] The demo company is removed if not wanted: the seed only creates companies flagged `isDemo=true`; delete them from the login screen's "Reset demo data" or directly in the DB.
- [ ] Create your real company via onboarding and invite your team.
- [ ] Run `bun run security-audit` against the production URL (`APP_URL=https://your-domain bun run security-audit`) and keep the result.
- [ ] Consider rate-limiting at the proxy layer in addition to the app's login limiter.

## Scaling notes

- The app is stateless apart from the database — scale horizontally behind a load balancer.
- The in-memory login rate limiter should move to Redis when running multiple instances.
- File documents are stored as database blobs (5MB cap). For high volume, move to S3-compatible object storage with pre-signed, authorized downloads.
- WebSocket-based live collaboration (multiple users editing one run sheet) is designed as a future mini-service; see `docs/LIMITATIONS.md`.
