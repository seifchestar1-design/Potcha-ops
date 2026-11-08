@echo off
REM Potcha Ops - one-command Cloudflare Workers deploy (Windows).
REM Prerequisites (see cloudflare/QUICK-START.md):
REM   1. Supabase database created - docs/SUPABASE_SETUP.md Parts 1-5
REM   2. "npx wrangler login" completed
REM   3. Hyperdrive created and its ID pasted into wrangler.jsonc
REM
REM Run: double-click this file (or run it from CMD).
setlocal enabledelayedexpansion
cd /d "%~dp0"

findstr /C:"REPLACE_WITH_YOUR_HYPERDRIVE_ID" wrangler.jsonc >nul
if %errorlevel%==0 (
  echo [ERROR] wrangler.jsonc still contains the placeholder Hyperdrive ID.
  echo   1. Run:  npx wrangler login
  echo   2. Run:  npx wrangler hyperdrive create potcha-db --connection-string="postgresql://postgres.PROJECT-REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
  echo   3. Paste the printed ID into wrangler.jsonc ^(hyperdrive[0].id^)
  echo Full instructions: cloudflare/QUICK-START.md
  pause
  exit /b 1
)
echo [OK] wrangler.jsonc: Hyperdrive ID present

set PM=npm
where bun >nul 2>nul
if %errorlevel%==0 set PM=bun
echo Using %PM%

if not exist node_modules (
  echo Installing dependencies - first run, this can take a few minutes...
  if "%PM%"=="bun" ( bun install ) else ( npm install )
)

REM Cloudflare adapter packages (not part of the dev package.json).
set NEXT_OK=false
for /f "delims=" %%v in ('node -p "const v=require('./node_modules/next/package.json').version;const p=s=^>s.split('.').map(Number);const a=p(v),b=p('16.4.5');(a[0]^>b[0])||(a[0]===b[0]&&a[1]^>b[1])||(a[0]===b[0]&&a[1]===b[1]&&a[2]^>=b[2])" 2^>nul') do set NEXT_OK=%%v
if not exist "node_modules\@opennextjs\cloudflare" set NEXT_OK=false
if not exist "node_modules\@prisma\adapter-pg" set NEXT_OK=false
if not "%NEXT_OK%"=="true" (
  echo Adding Cloudflare deploy packages - adapter needs next ^>=16.4.5...
  if "%PM%"=="bun" (
    bun add next@16.4.5 @opennextjs/cloudflare@latest @prisma/adapter-pg@6.19.2
    bun add -d wrangler@latest
  ) else (
    npm install next@16.4.5 @opennextjs/cloudflare@latest @prisma/adapter-pg@6.19.2
    npm install -D wrangler@latest
  )
)

if not exist gen\prisma\client.ts (
  echo Generating the Workers Prisma client...
  npx prisma generate --schema prisma/schema.workers.prisma
)

findstr /C:"getCloudflareContext" src\lib\db.ts >nul
if not %errorlevel%==0 (
  copy /Y cloudflare\db.workers.ts src\lib\db.ts >nul
  echo [OK] db.ts switched to the Workers client ^(original: cloudflare\db.standard.ts^)
) else (
  echo [OK] db.ts already uses the Workers client
)

echo Building and deploying to Cloudflare Workers...
npx opennextjs-cloudflare build
if errorlevel 1 goto :fail
npx opennextjs-cloudflare deploy
if errorlevel 1 goto :fail

echo.
echo Done. Your app: https://potcha-ops.^<your-subdomain^>.workers.dev
echo Verify: APP_URL=https://...workers.dev bun run scripts/security-audit.ts  ^(expected: 38 passed^)
pause
exit /b 0

:fail
echo.
echo [ERROR] Deploy failed - see the message above. Troubleshooting: docs/CLOUDFLARE.md
pause
exit /b 1
