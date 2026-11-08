#!/usr/bin/env bash
# Potcha Ops — one-command Cloudflare Workers deploy (macOS / Linux).
#
# Prerequisites (see cloudflare/QUICK-START.md):
#   1. Supabase database created — docs/SUPABASE_SETUP.md Parts 1–5
#   2. `npx wrangler login` completed
#   3. Hyperdrive created and its ID pasted into wrangler.jsonc
#
# Run:  bash deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

CYAN='\033[36m'; GREEN='\033[32m'; RED='\033[31m'; RESET='\033[0m'
say() { printf "${CYAN}▶${RESET} %s\n" "$1"; }
ok()   { printf "${GREEN}✓${RESET} %s\n" "$1"; }
die()  { printf "${RED}✗ %s${RESET}\n" "$1"; exit 1; }

# 1. Guard: the Hyperdrive ID placeholder must be replaced first.
if grep -q "REPLACE_WITH_YOUR_HYPERDRIVE_ID" wrangler.jsonc; then
  die "wrangler.jsonc still contains the placeholder Hyperdrive ID.
    Run:  npx wrangler login
    Then: npx wrangler hyperdrive create potcha-db --connection-string=\"postgresql://postgres.PROJECT-REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres\"
    and paste the printed ID into wrangler.jsonc (hyperdrive[0].id).
    Full instructions: cloudflare/QUICK-START.md"
fi
ok "wrangler.jsonc: Hyperdrive ID present"

# 2. Package manager.
PM="npm"
if command -v bun >/dev/null 2>&1; then PM="bun"; fi
say "Using $PM"

# 3. Dependencies.
if [ ! -d node_modules ]; then
  say "Installing dependencies (first run — a few minutes)…"
  if [ "$PM" = "bun" ]; then bun install; else npm install; fi
fi
ok "Dependencies ready"

# 3b. Cloudflare adapter packages (not part of the dev package.json).
NEXT_OK=$(node -p "const v=require('./node_modules/next/package.json').version;const p=s=>s.split('.').map(Number);const a=p(v),b=p('16.4.5');(a[0]>b[0])||(a[0]===b[0]&&a[1]>b[1])||(a[0]===b[0]&&a[1]===b[1]&&a[2]>=b[2])" 2>/dev/null || echo "false")
if [ ! -d node_modules/@opennextjs/cloudflare ] || [ ! -d node_modules/@prisma/adapter-pg ] || [ "$NEXT_OK" != "true" ]; then
  say "Adding Cloudflare deploy packages (adapter needs next >=16.4.5)…"
  if [ "$PM" = "bun" ]; then
    bun add next@16.4.5 @opennextjs/cloudflare@latest @prisma/adapter-pg@6.19.2
    bun add -d wrangler@latest
  else
    npm install next@16.4.5 @opennextjs/cloudflare@latest @prisma/adapter-pg@6.19.2
    npm install -D wrangler@latest
  fi
fi
ok "Cloudflare adapter packages ready"

# 4. Workers Prisma client.
if [ ! -f gen/prisma/client.ts ]; then
  say "Generating the Workers Prisma client…"
  npx prisma generate --schema prisma/schema.workers.prisma
fi
ok "Prisma client ready (gen/prisma)"

# 5. Swap db.ts to the Hyperdrive-aware client (idempotent).
if ! grep -q "getCloudflareContext" src/lib/db.ts; then
  cp cloudflare/db.workers.ts src/lib/db.ts
  ok "src/lib/db.ts switched to the Workers client (original kept at cloudflare/db.standard.ts)"
else
  ok "src/lib/db.ts already uses the Workers client"
fi

# 6. Build + deploy.
say "Building and deploying to Cloudflare Workers…"
npx opennextjs-cloudflare build
npx opennextjs-cloudflare deploy

printf "\n${GREEN}Done.${RESET}\n"
printf "Your app: https://potcha-ops.<your-subdomain>.workers.dev\n"
printf "Verify:   APP_URL=https://…workers.dev bun run scripts/security-audit.ts   (expected: 38 passed, 0 failed)\n"
