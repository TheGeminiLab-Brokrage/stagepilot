# StagePilot Elevation Plan

**Purpose of this document:** a step-by-step build guide for improving the portal, written so that any developer or AI coding model can pick up one initiative at a time and implement it without extra context. Each initiative says **why** it matters (plain language), **what exists today** (real file paths), **exact build steps**, and a **"done when"** checklist to verify.

**Ground rules for whoever implements this** (human or AI):
- Read `CLAUDE.md` and `AGENTS.md` at the repo root first. This is Next.js 16 — check `node_modules/next/dist/docs/` before writing framework code.
- Work on a branch, run `npm run build` before every commit, and never push to `main` without Muhanad's go-ahead (pushing to `main` deploys to production).
- Every API route must check the caller's role **server-side** (copy the pattern in `lib/assessment/server-auth.ts`). Never trust the browser.
- Any query on `whatsapp_contacts`, `whatsapp_assignments`, or `call_records` that can return more than 1,000 rows must use `fetchAllRows` from `lib/supabase/fetch-all-rows.ts` or an exact `count` query — Supabase silently truncates at 1,000 otherwise.
- DB changes = write a new `supabase_*_migration.sql` file in `apps/stagepilot/` AND tell Muhanad exactly what to run in the Supabase SQL editor. Never assume a migration was applied.
- Match the existing visual style (dark background, lime `#D7FF00` accent, Montserrat/Space Grotesk fonts).

**Suggested order:** Phase 1 → 2 → 3 → 4 → 5. Within a phase, steps are ordered. Each phase is shippable on its own.

---

## Phase 1 — WhatsApp: safer campaigns, fewer bans, smoother prospecting

### 1A. Understand the ban problem honestly (context, no code)

Today agents send through a **self-hosted unofficial WhatsApp connection** (`whatsapp-service/`, using the Baileys library) or by copy-pasting into WhatsApp manually. WhatsApp's systems ban numbers for two main reasons: (1) using an unofficial client at all, and (2) behavior that looks like bulk messaging — many identical messages to strangers in a short burst, high block/report rates.

There is **no code change that makes the unofficial route ban-proof**. What we can do:
- **Short term (this phase):** make the current sending behavior look as human as possible and spread load across agents' numbers — fewer bans, not zero.
- **Long term (decision for Muhanad, not code):** move campaign blasts to the **official WhatsApp Business Platform (Cloud API)** via a provider such as Twilio, 360dialog, or Meta directly. Official API = approved message templates, no number bans for the sending behavior itself, delivery/read webhooks, but per-message cost and template pre-approval. The right split: **first-touch campaign blasts on the official API; the human 1-to-1 follow-up conversation stays on the agent's own WhatsApp.** When Muhanad approves this, a new initiative doc will be needed; do not build it speculatively.

### 1B. Humanize automated sending (code, small)

**Today:** `whatsapp-service/index.mjs` line ~147 sends immediately: `await session.socket.sendMessage(jid, { text: message })`. The portal's auto-send loop (`app/dashboard/whatsapp/WhatsAppClient.tsx`, `autoSendTimerRef`) fires on a fixed interval. Fixed intervals are a bot signature.

**Build steps:**
1. In `whatsapp-service/index.mjs`, before `sendMessage`, add: mark presence as "composing" (`socket.sendPresenceUpdate('composing', jid)`), wait a random 2–6 seconds proportional to message length, then send, then `sendPresenceUpdate('paused', jid)`.
2. In `WhatsAppClient.tsx`, replace the fixed auto-send interval with a randomized one: actual delay = chosen interval × random(0.6 – 1.6). Keep the user-facing dropdown labels the same ("~1 min" etc.).
3. Add a hard hourly ceiling in the send route (`app/api/whatsapp/send/route.ts`): count this agent's `whatsapp_assignments` with `sent_at` in the last 60 minutes; if ≥ 45, return a friendly error `"Hourly sending limit reached — resume in a while"` and surface it in the client.
4. Message variation: in the message composer area of `WhatsAppClient.tsx`, support a "spintax" syntax `{Hi|Hello|Hey}` — the send path picks one option at random per message so not every message is byte-identical. Add a small hint under the message box explaining it.

**Done when:** two consecutive auto-sends never have identical delays; an agent cannot exceed 45 sends/hour via the portal; a message written with `{a|b}` alternates between variants across sends.

### 1C. Opt-out hygiene (code, small)

Blocks and spam reports are the #1 ban accelerator. Respecting "stop" reduces reports.

**Build steps:**
1. Migration: `ALTER TABLE whatsapp_contacts ADD COLUMN opted_out boolean NOT NULL DEFAULT false;` (new file `apps/stagepilot/supabase_whatsapp_optout_migration.sql`).
2. In the agent UI (`WhatsAppClient.tsx`), add a small "🚫 Asked to stop" button per contact; it PATCHes a new field via `app/api/whatsapp/assignments/[id]/route.ts` which sets `opted_out = true` on the contact.
3. Exclude `opted_out` contacts everywhere contacts are selected for distribution or refill: `app/api/whatsapp/admin/sheets/[id]/randomize/route.ts`, `app/api/whatsapp/assignments/refill/route.ts`. Also exclude them from the combined-report export (`app/api/whatsapp/admin/sheets/combined-report/route.ts`) unless status filter explicitly includes them.
4. The upload duplicate-check (`app/api/whatsapp/admin/sheets/check-duplicates/route.ts`) must flag opted-out numbers with status `"opted_out"` and the upload panel must always exclude them (no "upload anyway" for opted-out).

**Done when:** marking a contact opted-out removes them from every future distribution, refill, export, and re-upload path.

### 1D. Campaign health dashboard (code, medium)

Give Muhanad early warning before a number gets banned and visibility into what prospecting actually produces.

**Build steps:**
1. New section at the top of `app/dashboard/admin/whatsapp/WhatsAppAdminClient.tsx` (super_admin only): per agent — sends today, sends this week, answer rate (answered ÷ sent), and connection status from `/api/whatsapp/session`.
2. Data comes from one new route `app/api/whatsapp/admin/stats/route.ts` (copy the `requireAdminOrTeamLeader` pattern from the sheets route; team leaders see only their team). Use exact `count` queries grouped per agent — do not fetch raw rows.
3. Highlight in red any agent whose answer rate over their last 100 sends is under 5% — that pattern attracts bans and means the sheet quality or message is bad.

**Done when:** the WhatsApp admin tab shows a per-agent table of sends/answer-rate/connection, filterable by team for team leaders, with sub-5% answer rates highlighted.

---

## Phase 2 — Find a Property: faster, friendlier, always fresh

### 2A. Stop shipping 13.5 MB to every visitor (code, medium — biggest UX win)

**Today:** `app/dashboard/find-property/PropertyDashboardClient.tsx` line ~406 fetches `/property-data.json` (13.5 MB, 16,827 units) on every page load and filters in browser memory. On mobile data this is a 10–30 second wall.

**Build steps (pick approach 1; it avoids a DB migration):**
1. Split the dataset at build time: add a small Node script `scripts/split-property-data.mjs` that reads `public/property-data.json` and writes per-zone files `public/property-data/R.json`, `R7.json`, `R8.json`, each stripped to only the fields the list view renders (id, project, developer, zone, type, beds, area, price, ppsqm, discount, delivery). Full detail per unit goes to `public/property-data/details/{zone}.json` keyed by id.
2. The client loads only the active zone's list file (~2–4 MB), and lazy-fetches the details file the first time a unit card is opened.
3. Cache in the browser: after first load, store the zone file in IndexedDB with a version stamp; on later visits, load from IndexedDB instantly and re-fetch in the background.
4. Keep the existing filter/sort/facet logic untouched — it already works well; only the data source changes.

**Done when:** first paint of the unit list happens in under 3 seconds on a mid-range phone over 4G (test with browser dev-tools throttling); switching zones fetches only that zone's file; reopening the tab the same day loads instantly.

### 2B. Saved searches (code, small — high daily value for agents)

Agents re-run the same client profiles daily ("3-bed under 8M in R7, delivery ≤ 2027").

**Build steps:**
1. Add a "★ Save this search" button next to the filters in `PropertyDashboardClient.tsx`. Saving stores `{name, filters, zone, sort}` in `localStorage` under `sp_saved_searches` (max 20).
2. A "Saved" dropdown lists them; clicking one applies filters+zone+sort in one shot; an ✕ deletes one.
3. No backend needed for v1. (If cross-device sync is wanted later, that's a tiny `saved_searches` table — separate initiative.)

**Done when:** an agent can save the current filter set with a name, re-apply it in one click after a full page reload, and delete it.

### 2C. Admin-updatable property data (code, medium — kills the "redeploy to update" problem)

**Today:** the dataset only changes when a developer rebuilds the repo. Sales teams work from stale inventory between releases.

**Build steps:**
1. New page section in the Knowledge Base admin area (`app/dashboard/admin/knowledge-base/`) or a new `app/dashboard/admin/properties/page.tsx` (super_admin only): upload an Excel/JSON export of the dataset.
2. New route `app/api/admin/property-data/route.ts` (super_admin only): validates the upload (required columns present, row count sanity — reject if less than half the current count, to catch truncated files), then writes it to **Supabase Storage** bucket `property-data` as `latest.json` plus a timestamped backup copy.
3. Change the client fetch from `/property-data.json` to a tiny route `app/api/property-data/route.ts` that streams the storage file with `Cache-Control: public, max-age=3600` (any logged-in user).
4. Show "Data updated: {date}" in the Find-a-Property header so agents know freshness. Keep `public/property-data.json` as the fallback if storage has no file yet.

**Done when:** Muhanad can upload a new sheet from the admin UI and agents see the new data within an hour without any deploy; a bad file is rejected with a clear message; the update date is visible to agents.

### 2D. Mobile usability pass (code, medium)

**Today:** fixed-pixel inline styles; the sidebar-plus-grid layout breaks on phones. Agents show units to clients in person — mobile matters.

**Build steps:**
1. In `PropertyDashboardClient.tsx`, at ≤ 768px: filters collapse into a bottom-sheet opened by a sticky "Filters (N active)" button; unit cards go single-column; the payment-plan modal becomes full-screen.
2. Use CSS (media queries in the existing `<style>` block or Tailwind classes) — do not fork the component.
3. Test the copy-message flow on mobile (it's the #1 agent action): tap unit → pick plan → copy → paste into WhatsApp.

**Done when:** on a 390px-wide viewport, an agent can filter, browse, open a unit, and copy its payment message without horizontal scrolling or overlapping UI.

---

## Phase 3 — Tasks: from a list into a productivity system

**Today** (`app/dashboard/tasks/`): tickets have title, description, priority, due date (+ due time via `supabase_tickets_due_date_time_migration.sql`), assignees with open/done status, attachments, an overdue stat tile, and filtering (`TaskFilterBar.tsx`). What's missing is the *management loop*: leaders can't see per-agent workload at a glance, nothing reminds anyone, and completion says nothing about being on time.

### 3A. Team leader productivity board (code, medium)

1. New view toggle in `TasksClient.tsx` for team_leader/super_admin: **"Board by agent"** — one column per team member showing their open tickets sorted by due date, with counts: open / due today / overdue / done this week.
2. Data already loads in `TasksClient.tsx`; this is a regrouping of existing state, not new APIs. Scope: team leaders see only their team (same rule as everywhere: agents whose `team_name` equals the leader's `full_name`).
3. Add "completed late" tracking: when an assignee marks done after the due datetime, that's visible (small red "late" tag using existing `completed_at` vs due fields — both already in the DB).

**Done when:** a team leader opens Tasks and, without clicking anything else, sees who is overloaded, who has overdue work, and who finishes late vs on time.

### 3B. Reminders (code, medium)

1. New cron route `app/api/cron/task-reminders/route.ts` (gate with `CRON_SECRET`, copy the fail-closed check from `app/api/cron/sync-sheets/route.ts`), scheduled in `vercel.json` daily at 08:00 Cairo (06:00 UTC).
2. It finds assignments due within 24h (not done) and overdue ones, and posts a chat message to each assignee via the existing chat tables (`chat_messages` — sender can be the ticket creator), so reminders arrive inside the portal's existing chat widget.
3. Batch per user: one summary message ("You have 2 tasks due today: …"), not one message per task.

**Done when:** an agent with a task due tomorrow receives one chat message at 08:00; overdue tasks repeat daily until done; no duplicate spam.

---

## Phase 4 — Knowledge & training loop (Practice / Exam / Assessment)

The pieces exist and are strong individually. What's missing is the loop that tells a leader **who is weak at what, and whether training is fixing it**.

### 4A. One "Agent Development" view for leaders (code, medium)

1. New page `app/dashboard/assessment/manager/overview/page.tsx` (team_leader/super_admin, reuse `lib/assessment/require-access.ts`): one row per agent, columns = latest assessment score, exam phase scores (`exam_results`), practice sessions this month (`practice_sessions` count), call grade trend (avg AI stage-accuracy from `call_records`, last 30 days vs previous 30).
2. All queries per company + team scope, exact counts, no raw row dumps.
3. Each row links to the existing per-agent page `manager/agent/[agentId]`.

**Done when:** a leader answers "who on my team needs training, on what" from one screen.

### 4B. Close the loop from calls to practice (code, small)

1. In `call_records`, the AI grading already produces stage feedback (`reasoning`, `agent_feedback`). In the call detail modal (`app/dashboard/CallDetailModal.tsx`), add a button "Practice this weakness" that deep-links to `/dashboard/practice` pre-selecting the scenario whose `category` matches the weak stage (scenario metadata comes from `/api/gemini-scenarios`).
2. Mapping table (stage → scenario category) lives in one small file `lib/stage-to-scenario.ts` so it's editable in one place.

**Done when:** from a graded call, one click lands the agent in a relevant AI practice scenario.

---

## Phase 5 — The unified portal (home experience + structure)

### 5A. Agent home page (code, medium — do after Phases 1–3 so it has data to show)

Replace the current home (raw calls table) with a **daily cockpit** for agents; the calls table moves one click away.

1. New `app/dashboard/home/` (or rework `app/dashboard/page.tsx`): cards for — WhatsApp queue (X contacts waiting → button to WhatsApp tab), tasks due today (from tickets), daily report submitted? (from `bay_reports`, big warning after 6 PM if not), practice streak, and yesterday's team leaderboard position.
2. Each card is one small component with one focused query; no card may block another (load independently, show skeletons).
3. Navbar (`app/dashboard/Navbar.tsx`): group the four admin destinations (Admin, Knowledge Base, Reports, WhatsApp-admin) under one "Admin ▾" dropdown for super_admin; rename the home tab to "Home".

**Done when:** an agent logging in at 9 AM sees, without clicking: what to send, what's due, what's missing; super_admin nav has ≤ 6 top-level items.

### 5B. Complete the Arabic translation (code, small but wide)

The app's default language is Arabic (`app/dashboard/layout.tsx` line 27) yet WhatsApp admin, Performance, and Find-a-Property are hardcoded English.

1. Add the missing keys to `lib/translations.ts` and replace hardcoded strings in `WhatsAppAdminClient.tsx`, `PerformanceDashboard.tsx`, `PropertyDashboardClient.tsx`, `UploadSheetPanel.tsx` with `t('key')` calls, following the exact pattern used in `TasksClient.tsx`.
2. Do it one file per commit; run the app in Arabic and click every button in that file before moving on.

**Done when:** switching to Arabic leaves no English UI text in those four screens (data values like project names stay as-is).

### 5C. Remaining structural debt (from AUDIT_FINDINGS.md — do opportunistically)

In priority order, each is a small standalone task with details in `AUDIT_FINDINGS.md`:
1. Role-change + deactivate user in Admin (instead of delete/recreate) + user search box.
2. Move the cron report config (company id, sheet id, agent list) into a `report_settings` table editable from Admin — unblocks roster changes without deploys.
3. One shared `lib/server-auth.ts` (move from `lib/assessment/server-auth.ts`), delete the per-route duplicate copies.
4. A `teams` table replacing the "team = leader's name string" convention.
5. Rotate the Supabase service-role key (Muhanad + guide, post-Expo) — from the audit, still pending.

---

## What NOT to do (guardrails for the implementing model)

- Do **not** touch the WhatsApp "golden rule": a contact assigned to an agent is never reassigned to another agent. Every distribution change must preserve this (see comments in `app/api/whatsapp/admin/sheets/[id]/randomize/route.ts`).
- Do **not** raise or remove the per-agent send caps without an explicit instruction from Muhanad.
- Do **not** add a second UI framework, CSS library, or state-management library. Use what's there.
- Do **not** run migrations yourself or assume they ran — always hand the SQL to Muhanad with instructions.
- Do **not** deploy (push to `main`) without Muhanad's explicit go-ahead in the conversation.
- If a step conflicts with what you find in the code, stop and say so rather than improvising around it.
