-- ============================================================================
-- Potcha Ops — optional Supabase hardening (defense-in-depth)
-- ============================================================================
-- WHAT THIS DOES
--   1. Enables Row Level Security (RLS) on every Potcha Ops table with NO
--      policies. Supabase's PostgREST API (the `anon` / `authenticated` keys
--      used by supabase-js clients) therefore gets ZERO rows from these
--      tables — deny-by-default.
--   2. Revokes direct table privileges from the `anon` and `authenticated`
--      roles.
--
-- WHY THE APP KEEPS WORKING
--   Potcha Ops does NOT use supabase-js / PostgREST. It connects through the
--   pooled Postgres connection (`postgres` role) with Prisma, and enforces
--   authentication + role-based access inside its own API routes. The
--   `postgres` role owns these tables, and table owners are exempt from RLS
--      (unless FORCE ROW LEVEL SECURITY is used — we deliberately do NOT
--      force it, so the app is unaffected).
--
-- NOTES
--   * The `service_role` key bypasses RLS by Supabase design. Treat it like a
--     production database password — never expose it to browsers.
--   * Run this AFTER `supabase/schema.sql` (or after `prisma db push`), and
--     re-run it if you ever reset the database.
--
-- Run it in: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- ============================================================================

ALTER TABLE public."Company"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."User"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Session"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Event"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EventAssignment"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Vendor"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EventVendor"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Payment"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Task"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TaskComment"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RunSheetItem"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Issue"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Document"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditLog"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Notice"           ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Verify: every row below must show rowsecurity = true
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;
