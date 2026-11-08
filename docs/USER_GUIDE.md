# Potcha Ops — User Guide

Welcome to Potcha Ops, the control center for your wedding-planning company. This guide walks each role through their workspace.

## Getting started

1. Open the app. On the sign-in screen you can:
   - Sign in with your company account, or
   - **Start your own workspace** — creates a new isolated company with you as CEO.
2. First time in a new company: create an event (CEO), invite your team (CEO), and start engaging vendors.

Your role determines what you see. The app adapts automatically — there is nothing to configure.

---

## CEO (Owner) — Level 3, full oversight

### Your dashboard
Your scorecard shows: active events, upcoming weddings, contracted revenue, collected payments, outstanding client balances, planned & actual expenses, estimated profit, events at risk, overdue tasks, outstanding vendor confirmations and overdue payments. Below it:

- **Notices from your team** — financial-risk flags raised by Finance (e.g. "sound vendor deposit overdue while unconfirmed"). Mark them read once handled.
- **Events at a glance** — every event with its readiness ring and status; "At risk" is highlighted (readiness < 70% within 30 days, or an open critical issue).
- **Event profitability** — revenue, collected, outstanding, estimated profit and margin per event.
- **Needs attention** — critical issues, overdue tasks/payments and upcoming payment deadlines.
- **Recent activity** — the audit feed.

### Managing events
- **New event** — name, client contacts, date/time, venue, guest count, type, contract value, planner and assigned team. Assigning Operations members to the event is what gives them visibility.
- Each event has 8 tabs: Overview, Vendors, Budget, Tasks, Run sheet, Issues, Documents, Activity.
- Status flows Lead → Proposal sent → Confirmed → In preparation → Ready → Completed → Archived.
- **Archive** keeps records but removes the event from active lists. **Delete** is permanent, requires typing the exact event name, and cascades to all related records — the deletion is audited.

### Team & permissions (Team view)
- **Invite member** — creates an account in INVITED status and generates a **one-time temporary password** to share securely (shown once, never stored in plain text). Activate the account once they sign in and change their password.
- Change roles with the guard that the company always keeps at least one active CEO. Role or status changes **revoke the member's live sessions immediately**.
- **Grant permission** — extend a Finance or Operations user beyond their role defaults (e.g. let Finance manage tasks). You can never grant a permission you don't hold.

### Finance oversight
You see everything Finance sees. Use the Budget tab per event, or the company-wide **Finance** ledger. Exports are in **Reports**.

### Company settings
Settings → Company: rename the company, change currency (EGP default; USD/EUR/SAR/AED supported) and date format.

---

## Finance Manager — Level 2, financial access

### Your dashboard
Total event revenue, collected revenue, outstanding client balances, vendor commitments, paid and unpaid vendor amounts, upcoming payment deadlines (14 days), overdue payments, expenses-vs-budget percentage and estimated profit — plus the per-event profit table and overdue payment queue.

### Recording transactions
**Finance → Record transaction** (or an event's Budget tab):
- Pick the event, type (client payment in / vendor payment out / expense out), amount, method, reference and note.
- **Completed — money moved** records it immediately in the immutable ledger.
- **Planned — due later** creates a pending entry with a due date (these drive your deadlines and overdue flags).
- For vendor payments you can **link the engaged vendor** — their paid-to-date amount stays in sync automatically.

### Corrections — never delete history
Completed transactions **cannot be edited or deleted**. To correct one, use the **↩ reverse** action and give an audited reason: the system records a negative reversal entry, marks the original REVERSED, and both stay visible. Pending plan entries (money that hasn't moved) can simply be cancelled.

### Flagging risks to the CEO
Your dashboard has **"Notify the CEO of a financial risk"** — raise an Info/Warning/Critical notice, optionally tied to an event. It appears instantly on the CEO's dashboard.

### What you cannot do
You cannot manage the team, change company settings, or alter CEO accounts — those require the CEO. You can view operational tasks and run sheets but not modify them unless the CEO grants you the permission.

---

## Operations Manager / Team — Level 1, event execution

### Your dashboard
Your assigned events, upcoming weddings, pending vendor confirmations, tasks due today, overdue tasks, critical unresolved issues, run-sheet completion and average event readiness.

### Your events
You only see events you are assigned to (or are planner of). Each has your execution tabs:
- **Vendors** — manage contacts, WhatsApp numbers, arrival/setup times, confirmation status and the responsible member. Financial figures are restricted and never reach your screen.
- **Tasks** — create, assign and complete tasks; filter by status/priority; discuss in comments.
- **Run sheet** — build the wedding-day timeline. Add items (time, activity, owner, vendor, location, notes), reorder with arrows, set Running/Done/Delayed, and **Print run sheet** for the day-of binder. Delayed items are highlighted in red.
- **Issues** — log anything that goes wrong with priority and assignee; resolve with notes. Critical open issues lower the event's readiness score.
- **Documents** — upload and download contracts, floor plans and reference files (private storage, 5MB max).

### Readiness score
Each event shows a transparent 0–100 score: vendors confirmed 25 · critical tasks 20 · run sheet 15 · venue 15 · documents 10 · critical issues 15. Open the Overview tab to see the exact breakdown, what's missing and recommended next actions.

### What you cannot see
Company revenue, event profitability, budgets, client payment histories and financial reports are hidden from you at the **server level** — not just hidden in the interface. Team management and company settings are CEO-only.

---

## Everyone

- **Search & filters** — events, tasks, vendors, payments and audit logs all have search boxes and status filters.
- **Theme** — light/dark toggle in the top bar.
- **Change password** — Settings → Your profile (minimum 8 chars, letters + numbers).
- **Mobile** — the full app works on phones; open the navigation from the ☰ menu.
- **Audit trail** — every meaningful action is recorded. Check the Audit log (scope depends on your role).
