# Potcha Ops — Limitations, Incomplete Features & Launch Checklist

## Verified working (tested end-to-end)

Authentication & sessions, company onboarding/registration, the three-role permission model (server-enforced), tenant isolation, event lifecycle & workspace (all 8 tabs), vendor directory & per-event engagements, financial calculations, immutable payment ledger with reversals, tasks with comments, wedding-day run sheets with print, issues tracking, transparent readiness scoring, documents with private storage, team invitations with one-time passwords, role changes with session revocation, permission grants, audit log with role scoping, CSV exports, dashboard KPIs per role, mobile-responsive layout, light/dark themes, demo environment with reset. Security suite: **38/38 checks passing** (`bun run security-audit`).

## Known limitations & incomplete features

1. **Email delivery is not implemented** (no SMTP provider in the sandbox). Team invitations generate a one-time temporary password that the CEO shares manually. Production should send invitation emails and password-reset links.
2. **Arabic RTL interface** — the data layer fully supports Arabic text (names, notes, CSV export with BOM), and currency/date are configurable, but the UI itself is English-only in v1.0. An `ar` locale with RTL layouts is future work.
3. **Run-sheet reordering** uses explicit up/down controls rather than drag-and-drop. Functional, less tactile. Drag-and-drop scaffolding (@dnd-kit) is already in the dependencies.
4. **Documents are stored as database blobs** (5MB, type allow-list). Suitable for contracts/plans; high-volume media should move to object storage with authorized pre-signed URLs.
5. **Reports are CSV exports + in-app tables.** No PDF report generation or scheduled email reports yet.
6. **No real-time collaboration.** Two users editing the same run sheet must refresh to see each other's changes. A WebSocket mini-service is the planned architecture for live updates.
7. **Subscription/billing is architecture-only** (`Company.plan` field: TRIAL/GROWTH/PRO). No payment processing is wired — intentionally, per the build brief: do not charge users until the app is tested and security-reviewed.
8. **SQLite in the demo build.** The schema is portable, but production at scale should use PostgreSQL (optionally with literal RLS policies as defense-in-depth). The in-memory login rate limiter should move to Redis when scaling out.
9. **Password reset flow** requires the CEO to re-invite/deactivate — there is no self-service "forgot password" email flow yet.
10. **Event readiness weights are fixed.** The transparent model is documented and shown in-app, but companies cannot yet customize weights per their own playbooks.
11. **No native mobile apps.** The web app is mobile-first responsive; iOS/Android wrappers (e.g. Capacitor) are future work.
12. **Notifications are in-app only** (dashboard notices). SMS/push reminders for payment deadlines and task due dates are a natural next step for the Egyptian market (WhatsApp Business API being the obvious channel).
13. **Embedded-preview browsers with full third-party cookie blocking.** The app authenticates via httpOnly cookies where the browser allows them, and falls back to an `Authorization: Bearer` header with the session token in `localStorage` where it does not (iOS Safari's Intelligent Tracking Prevention blocks ALL third-party cookies, including `SameSite=None; Secure`, when the app runs inside a cross-site iframe). Verified: with cookies entirely wiped, login, authenticated API calls, session persistence across reloads, and logout all work through the bearer path. Note the localStorage token is XSS-readable (unlike httpOnly cookies) — mitigated by no unescaped HTML rendering, relative same-origin URLs only, and opaque server-revocable tokens.

## Commercial launch checklist

### Product
- [ ] Arabic RTL interface (or Arabic-English toggle) for the Egyptian market
- [ ] WhatsApp-deep-link buttons on every vendor phone number (tap-to-chat) — data is already stored
- [ ] Scheduled reports (weekly company digest to the CEO)
- [ ] Customizable readiness weights
- [ ] Forgot-password / email verification flows
- [ ] Live collaboration on run sheets (WebSocket service)
- [ ] PDF export for client-facing proposals and final run sheets

### Security & compliance
- [ ] Third-party penetration test
- [ ] PostgreSQL with RLS policies as defense-in-depth
- [ ] Rate limiting at the proxy layer; move login limiter to Redis
- [ ] Dependency audit pipeline (Dependabot/Socket)
- [ ] Data protection policy review (Egypt Personal Data Protection Law No. 151/2020)
- [ ] Backup + restore drills (and document RPO/RTO)

### Business
- [ ] Pricing model (per-company SaaS with plan tiers; schema already has `plan`)
- [ ] Payment provider integration for subscriptions (InstaPay/fawry/Paymob)
- [ ] Onboarding funnel analytics
- [ ] Support channel and SLA
- [ ] Terms of service, privacy policy and DPA templates
- [ ] Demo environment on a public URL with one-click reset

---

**Built and tested:** registration, login, company creation, invitations, role assignment, event creation, vendor engagement, payment recording (incl. reversal), task & run-sheet updates, issue tracking, budget calculations, readiness scoring, data isolation, unauthorized-access attempts and mobile usability — all exercised in the browser and/or via the repeatable security suite. No feature listed above as "verified working" is untested.
