# StagePilot — Product & Engineering Audit

**Date:** 2026-07-20 · **Scope:** full repo at `main` (commit `a3883d5`) · **Mode:** audit-only, no code changed.
**Method:** read every route/page directory, role gates in all `page.tsx` files, auth checks in all 60+ API routes, middleware, schema reference (`db/live_schema_reference_2026-07-15.sql`), and the largest client components.

---

## 1. INVENTORY

### Pages / tabs (role access as actually enforced in code)

| Tab / Page | Path | What it does | Who can access (server-enforced) |
|---|---|---|---|
| Team/My Calls (home) | `app/dashboard/page.tsx` | Uploaded-call list + AI stage grading, stats, filter bar | All roles except trainee (redirects); leaders see team, agents see own. **Fetch capped at 200 rows** (`.limit(200)`, line 34) |
| Upload Call | `app/dashboard/upload/page.tsx` | Upload call recording → n8n grading pipeline | **`agent` only** — super_admin/team_leader are redirected away (line 16). Verify this is intended |
| Daily Report | `app/dashboard/daily-report/page.tsx` | Agent "bay report" submission | agent, team_leader, super_admin |
| Find a Property | `app/dashboard/find-property/page.tsx` | Filterable 16.8k-unit Egypt/Dubai dataset | All logged-in roles; `property_viewer` gets a separate viewer client |
| Performance | `app/dashboard/performance/page.tsx` | Productivity dashboards + sales targets (CRM cross-match) | All except trainee/exam |
| Reports | `app/dashboard/admin/reports/page.tsx` | Daily/weekly/monthly generated reports | super_admin, team_leader |
| Tasks | `app/dashboard/tasks/page.tsx` | Ticket assignment (create, assign, attachments) | Roles in `TASKS_ELIGIBLE_ROLES` |
| Assessment | `app/dashboard/assessment/*` | Product-knowledge quizzes, map/pin games, manager views | All; manager pages gated to team_leader/super_admin via `lib/assessment/require-access.ts` |
| AI Practice | `app/dashboard/practice/page.tsx` | Gemini live-voice AI-client practice | agent, trainee (+ others by role prop) |
| Exam | `app/dashboard/exam/page.tsx` | 3-phase exam + AI grading | **`exam` and `agent`** roles only |
| WhatsApp (agent) | `app/dashboard/whatsapp/page.tsx` | Agent's assigned contacts, Baileys QR/send | **`agent` only** |
| WhatsApp (admin) | `app/dashboard/admin/whatsapp/page.tsx` | Sheet upload/distribute/track, combine/export | super_admin, team_leader (team-scoped) |
| Admin (users) | `app/dashboard/admin/page.tsx` | User CRUD, teams, exam/practice results tables | super_admin only |
| Knowledge Base | `app/dashboard/admin/knowledge-base/page.tsx` | Knowledge entries + Google Sheet connections | super_admin only |
| Login / Register | `app/auth/*` | Auth | Public |

Six roles exist in the live DB (`super_admin`, `team_leader`, `agent`, `trainee`, `exam`, `property_viewer`). Trainee/exam/property_viewer are locked to their single page by `app/dashboard/layout.tsx` (lines 32–40) using the middleware-set `x-pathname` header — this is server-side and sound.

### Access-control verdict

Overall **good**: every page gates server-side, and nearly all API routes re-check role from the `profiles` table before acting. Exceptions and weak points:

- **`app/api/cron/daily-report/route.ts` — NO auth at all.** Its two siblings (`sync-sheets`, `weekly-report`) check `CRON_SECRET`; this one doesn't. Anyone who finds the URL can trigger service-role DB writes and report generation. → §6 Critical
- **`app/api/register/route.ts` — open self-serve signup** that creates a new company **plus a `super_admin` account** with no invite code, email verification, or approval. Fine for a SaaS launch funnel; risky for an internal tool at a live URL. → §6 High
- **`app/api/gemini-scenarios/route.ts`** — unauthenticated, but only returns static scenario metadata (comment says prompts never leave the server — verified). Acceptable; still worth gating for consistency.
- Hardcoded backdoor: `app/api/gemini-token/route.ts` line 37 exempts `trainee@test.com` from daily voice limits — a test account exemption living in production code.
- Frontend-only enforcement: none found that matters — role checks that exist client-side (e.g. `WhatsAppAdminClient` cap input) are mirrored server-side. This is the right pattern; keep it.

---

## 2. UX / INFORMATION ARCHITECTURE

### Navigation
`app/dashboard/Navbar.tsx` gives super_admin **9 flat top-level tabs** (Find a Property, Performance, Reports, Team Calls, Assessment, Tasks, Admin, Knowledge Base, WhatsApp) and agents 9 of their own. Problems:

- No grouping: four admin-ish destinations (Admin, Knowledge Base, Reports, WhatsApp-admin) sit as flat siblings. They belong under one "Admin" section with sub-nav.
- Naming inconsistency: the home route `/dashboard` is labeled "Team Calls"/"My Calls" but is really the *call-grading* module; "Admin" is really *user management*. Labels don't describe contents.
- The two WhatsApp tabs (`/dashboard/whatsapp` for agents, `/dashboard/admin/whatsapp` for leaders/admins) share a name but are different tools — confusing when screen-sharing across roles.
- i18n is inconsistent: some labels go through `t()` (`navReports`, `navTasks`), others are hardcoded English ("Find a Property", "Performance", "WhatsApp", "Daily Report") in an app whose **default language is Arabic** (`layout.tsx` line 27). Entire newer features (WhatsApp admin, Performance) are English-only.

### Filter/search coverage per tab

| Tab | Has list/table? | Filters present? | Verdict |
|---|---|---|---|
| Team Calls | Yes (calls) | Yes — `FilterBar.tsx` (client-side) | OK, but only filters the 200 fetched rows — data under the filter is silently incomplete |
| Find a Property | Yes (16.8k units) | Yes — rich faceted filters, 6 sort options, grid/list, pagination, facet counts | Best-in-app; see below |
| WhatsApp admin | Yes | Yes — cycle/agent/status + combine-mode status checkboxes | OK (recently added) |
| Tasks | Yes | Yes — `TaskFilterBar.tsx` | OK |
| Reports | Yes (report list) | Tabs only (daily/weekly/monthly). **No date-range picker, no search, no agent filter** | Gap |
| Admin users | Yes (32 users, growing) | **None — no search, no role/team filter, no pagination** (`UserTable.tsx`) | Gap |
| Performance | Yes | Partial — agent/team dropdowns; relies on CRM upload state | OK-ish |
| Daily Report (leader view) | Yes | **No filter by agent/date beyond what's shown** | Gap |
| Assessment manager | Yes (per-agent results) | Minimal | Gap for large teams |

Filter UI is also **visually inconsistent**: `FilterBar.tsx`, `TaskFilterBar.tsx`, the WhatsApp selects, and Find-a-Property's `MultiCombobox` are four separately-styled implementations of the same concept (see §5 duplication).

### Find a Property deep-dive (`PropertyDashboardClient.tsx`, 1,407 lines)

- **Filters/sort: genuinely good.** Faceted multi-selects with live counts, price/area ranges, zone toggle (R/R7/R8), 6 sorts, pagination, grid/list, per-unit payment-plan message generator.
- **Performance: the whole dataset is a 13.5 MB static JSON** (`public/property-data.json`) fetched client-side on every visit (line 406) and filtered in memory. On office Wi-Fi this is seconds of load; on mobile data it's painful. No code-splitting of the dataset, no server-side filtering, no compression strategy beyond gzip.
- **Freshness:** data updates only when someone rebuilds/redeploys the repo — no admin upload path for the property dataset (contrast: WhatsApp sheets have one). The planned MasterV enrichment will make this worse without a data-refresh story.
- **Error state: missing.** The fetch chain (lines 406–408) has no `.catch` — a failed download leaves the page on the loading spinner forever.
- **Empty state:** present. **Loading state:** present.
- **Saved searches:** not present (only minor localStorage usage). For a sales team re-running the same client profiles daily, saved filters would be high-value.
- **Mobile:** inline `style` objects with fixed pixel widths throughout; not responsive. Agents in the field will struggle.
- `public/R8_D_P.xlsx` — a raw source spreadsheet sitting in `public/`, downloadable by any logged-in user; likely leftover.

### Unfinished / duplicated / dead

- **`apps/stagepilot/frontend/`** — stale 16-file copy of an old `app/`; nothing imports it. Delete (keep the sibling `.sql` files — those are the canonical schemas).
- **Assessment R7 near-clones:** `capital-game` vs `capital-game-r7` (614 vs 613 lines) and `capital-quiz` vs `capital-quiz-r7` are copy-paste variants that should be one component with a `mapType` prop (a pattern `manager/capital-data/[mapType]` already proves works).
- **`lib/scenario-prompts/temp/`** — a "temp" folder of prompts (692-line file) shipped to prod.
- Root litter: `Daily Sales Report.json`, `Weekly Sales Report.json`, `masterv-data.json`, `remap-map.js` — one-off artifacts, none imported by `app/`.
- Untracked `scripts/masterv-*.mjs` (10 files) — work-in-progress scraper scripts sitting in the repo working tree.

---

## 3. ROLE-BASED CAPABILITY GAPS

### Super Admin — has today
User create/delete (`/api/admin/create-user`, `delete-user`), team reassignment (`update-user`), password reset (`set-password`), knowledge base CRUD + Google-Sheet sync connections, WhatsApp campaign management, exam/practice results tables, reports viewing, chat groups admin, sales targets/exclusions.

### Super Admin — conspicuously missing
- **Role changes**: `AdminUsersClient.tsx` exposes create / remove / set-team / set-password only. To turn an agent into a team_leader you have to delete and re-create them (or edit the DB by hand). The `update-user` API itself only handles team+name.
- **Audit log**: no record of who deleted a user, deleted a WhatsApp sheet, changed a stage, or reset a password. For a multi-admin future this is the #1 governance gap.
- **Data export**: no user list export, no call-records export, no bay-reports export. (Only WhatsApp has Excel export.)
- **Impersonation / "view as agent"**: doesn't exist; every support question requires screenshots.
- **Company settings**: nothing is configurable (default distribution cap, working hours, report recipients, language default) — all hardcoded.
- **Deactivate (vs delete) a user**: only hard delete exists; departing-employee data ownership was this company's founding wound — soft-disable matters here.

### Team Leader — has today
Team calls view + stage correction (`update-stage` allows any non-agent), team reports, performance dashboard, tasks, assessment manager view, WhatsApp admin (team-scoped, added 2026-07-20), daily-report submission.

### Team Leader — missing
- **No team roster management**: can't see/edit which agents are on their team; team membership is a string match on `profiles.team_name` == leader's `full_name` — renaming a leader silently orphans their team (see §5).
- **No per-agent performance drill-down** with date ranges; no exportable team report.
- **No visibility into agents' daily-report compliance** (who submitted today, who didn't) beyond raw report lists.
- **Cannot upload calls on behalf of an agent** (upload is agent-only) — unclear if intended.

---

## 4. REPORTING & ANALYTICS

### What exists
- **`/dashboard/admin/reports`** (`ReportsClient.tsx`): daily/weekly/monthly tabs rendering rows from the `reports` table, generated by cron routes; downloadable as **HTML** only.
- **`/dashboard/performance`** (`PerformanceDashboard.tsx` + `SalesTargets.tsx`): call-stage funnel-ish stats, CRM upload cross-match, sales targets vs deals.
- Assessment manager pages: per-agent quiz scores.

### Accuracy / robustness problems in what exists
- **The entire daily/weekly report pipeline is hardcoded to one tenant**: `app/api/cron/daily-report/route.ts` and `weekly-report` embed `COMPANY_ID = '99128fef-…'`, a Google `SHEET_ID`, and a **literal list of nine agent first names** (lines 4–11). Any team change requires a code deploy; any second company gets no reports. This is the single most fragile piece of business logic in the repo.
- CRM matching in `PerformanceDashboard.tsx` joins on lowercase full-name string equality and hardcodes an exclusion for names starting with `'omnia'` (line 255) — name-based joins will silently drop stats on any spelling difference.
- Reports are point-in-time snapshots in the `reports` table; there's no way to regenerate or backfill from the UI if a cron run failed.

### Missing reporting that a real-estate sales op would want
1. **Conversion funnel** across call stages (data exists in `call_records.stage`) with date-range + team/agent filters.
2. **WhatsApp campaign analytics**: response rate per sheet/agent/cycle over time (data exists; only per-sheet snapshots shown).
3. **Time-to-close / deal velocity** from `sales_deals` (deal_date exists; no analysis).
4. **Team leaderboard** (calls graded, response rates, targets attainment) — motivational and cheap to build from existing tables.
5. **Inventory analytics** on the property dataset (aging, price distribution by developer/zone) — currently a pure lookup tool.
6. **Excel/CSV export** on every report (HTML download only today).
7. **Daily-report compliance dashboard** (submitted vs missing, streaks).

---

## 5. CODE-LEVEL FINDINGS

### Architecture & consistency
- **Monolith client components with inline styles**: 10 files over 1,000 lines (`PracticeClient` 1,761; `PropertyViewerClient` 1,545; `PropertyDashboardClient` 1,407; `KnowledgeBaseManager` 1,144; `WhatsAppClient` 1,092; `WhatsAppAdminClient` 1,042; `DailyReportClient` 998 …). Every one redefines the same design tokens (`const NEON = '#D7FF00'`, `CARD`, `BORDER`, `MUTED`, font objects) — **~20 copies** of the palette. Tailwind v4 is installed but most feature UI bypasses it for inline `style` objects. One `ui/` kit (Button, Card, Select, Modal, StatCard, Table) would delete thousands of lines.
- **Auth helper duplication**: a canonical `requireCaller`/`requireManagerOrAdmin`/`requireSuperAdmin` exists in `lib/assessment/server-auth.ts` (odd location for a global concern) — yet at least 8 WhatsApp/admin routes each define their own private copy (`requireSuperAdmin`/`requireAdminOrTeamLeader`). One drift bug away from an authz hole. Move to `lib/server-auth.ts`, import everywhere.
- **Pagination helper duplication**: `lib/supabase/fetch-all-rows.ts` (new, correct) vs a private `fetchAllIds` in `app/api/whatsapp/assignments/refill/route.ts` — same logic, two implementations. Also duplicated `shuffle()` in two routes and duplicated phone-preview logic before `lib/phone.ts` was introduced.
- **Team membership by name string**: `profiles.team_name` stores the *leader's full name*; `create-user` sets `resolvedTeamName = fullName` for leaders. Renaming a leader (or two leaders sharing a name) breaks team scoping everywhere (tasks RLS, WhatsApp scoping, reports). Should be a `teams` table with FK.
- **i18n half-adopted**: `lib/translations.ts` (824 lines) covers older features; WhatsApp admin, Performance, Find-a-Property are hardcoded English in an Arabic-default app.

### Performance
- **Known Supabase 1,000-row silent cap still live in two places** (the class of bug just fixed elsewhere):
  - `app/dashboard/admin/whatsapp/page.tsx` lines 27–35: fetches **all** `whatsapp_contacts` rows for the company (7,961 in prod) with no `.range()` to compute per-sheet counts → the sheet-list "N contacts" numbers are wrong today (sum capped at 1,000). Also wasteful: should be a grouped count query.
  - `app/dashboard/page.tsx` line 34: `.limit(200)` on `call_records` — leaders' dashboards silently show only the latest 200 calls with no indication or "load more".
- **13.5 MB `property-data.json`** shipped to every Find-a-Property visitor (see §2).
- `app/api/admin/tickets`, bay-reports, and assessment queries are unpaginated — fine at today's volumes (121 bay_reports), will degrade silently.
- Schema reference shows **no indexes beyond PKs** were captured; hot paths (`whatsapp_assignments.sheet_id`, `whatsapp_contacts.sheet_id`, `call_records.company_id+uploaded_at`, `ticket_assignees.assignee_id+status`) need verifying in the live DB.
- `ChatWidget` subscribes to realtime channels on every dashboard page for three roles; unread/ticket-count queries run per navigation.

### Error handling / robustness
- `PropertyDashboardClient` fetch has no `.catch` → infinite spinner on failure (§2).
- Many `fetch(...).then(res => res.json())` chains across clients assume JSON and 200s; several API routes return HTML error pages under platform failures which then throw parse errors far from the cause.
- `app/api/cron/daily-report` hand-rolls a CSV parser (lines 16–49) — fragile against quoted newlines; a battle-tested parser (`xlsx` is already a dependency) would be safer.

### Security (beyond RBAC)
- **CRITICAL — live production service-role key committed to the repo** in four seed scripts: `scripts/seed-bay-reports.mjs`, `seed-casablanca-agents.mjs`, `seed-reports.mjs`, `seed-weekly-reports.mjs` (e.g. `seed-bay-reports.mjs` line 6). This is the master key to the production DB (`mvgmhasgwzybwvwyruac`), visible to anyone with repo read access — including the departed developer via git history. **Rotate the service-role key in Supabase, then purge/replace these scripts to read from env.** Rotation was already on the backlog; this makes it urgent.
- **CRITICAL — unauthenticated cron endpoint** `app/api/cron/daily-report/route.ts` (no `CRON_SECRET` check, unlike its two siblings).
- **HIGH — open registration** creating super_admin accounts (§1).
- `trainee@test.com` limit bypass in `gemini-token` (test backdoor in prod).
- `public/` serves the full proprietary property dataset and a source `.xlsx` to any authenticated user of any role — acceptable internally, but note middleware is the only thing between them and the open internet; the matcher (`proxy.ts` line 45) currently does cover them (redirects anonymous users), keep it that way if the matcher is ever "optimized".
- Webhooks (`n8n-result`, `call-grade-result`, `reports`) all verify shared secrets — good. Cron `sync-sheets`/`weekly-report` verify `CRON_SECRET` — good.
- Baileys WhatsApp session credentials stored as plaintext JSONB in `whatsapp_baileys_sessions` — standard practice for Baileys, but it means DB access = WhatsApp account takeover; another reason key rotation matters.

---

## 6. PRIORITIZED FINDINGS

### Critical
| Tag | Finding | Why it matters |
|---|---|---|
| [SECURITY] | Production service-role key hardcoded in `scripts/seed-*.mjs` (4 files, committed) | Full DB read/write for anyone with repo history access, incl. departed dev — rotate key now |
| [SECURITY] | `/api/cron/daily-report` has no `CRON_SECRET` check | Unauthenticated endpoint performing service-role writes |

### High
| Tag | Finding | Why it matters |
|---|---|---|
| [SECURITY] | `/api/register` = open company+super_admin signup, publicly linked | Anyone can create an admin foothold on the internal portal |
| [CODE] | 1,000-row cap live in `admin/whatsapp/page.tsx` contact counts | Sheet list shows wrong contact totals today (7,961 contacts in prod) |
| [CODE] | `COMPANY_ID`, sheet ID, and 9 agent names hardcoded in both cron report routes | Reports silently break on any roster change; blocks multi-tenant |
| [UX] | Find-a-Property ships 13.5 MB JSON to the client, no error state, English-only, not mobile-responsive | The flagship sales tool is slow, fragile, and unusable in the field |
| [CODE] | Main dashboard caps call list at 200 with no indication | Leaders make decisions on silently truncated data |
| [ADMIN-GAP] | No role-change or user-deactivate — only delete/recreate | Admin can't manage lifecycle of real staff safely |
| [CODE] | Team = string match on leader's full name | Renaming a leader orphans their team across tasks/WhatsApp/reports |

### Medium
| Tag | Finding | Why it matters |
|---|---|---|
| [ADMIN-GAP] | No audit log of destructive/admin actions | No accountability trail (deletes, password resets, stage edits) |
| [ADMIN-GAP] | No data export anywhere except WhatsApp | CEO/leaders can't get data out for board/ops use |
| [REPORTING-GAP] | No funnel, leaderboard, WhatsApp-campaign trends, deal velocity | Data already collected but not answering business questions |
| [REPORTING-GAP] | Reports downloadable as HTML only; no regenerate/backfill | Failed cron run = permanently missing report |
| [UX] | 9 flat nav tabs; admin features scattered; naming mismatches | Navigation doesn't scale with the feature count |
| [UX] | Admin users table has no search/filter/pagination | Painful past ~50 users |
| [UX] | Reports tab lacks date-range/agent filtering | Finding a specific report is scroll-and-hunt |
| [CODE] | Duplicated auth helpers in ~8 routes vs `lib/assessment/server-auth.ts` | One drift away from an authorization bug |
| [CODE] | ~20 copies of design tokens; 10 components >1,000 lines; Tailwind bypassed | Every UI change costs multiples; inconsistent look guaranteed |
| [CODE] | i18n half-adopted — new features hardcoded English in Arabic-default app | Half the UI is untranslated for its primary audience |
| [CODE] | Assessment R7 pages are ~600-line copy-paste clones | Double maintenance for every quiz/game fix |
| [SECURITY] | `trainee@test.com` hardcoded quota bypass | Test backdoor in production billing-relevant limits |
| [UX] | Property dataset updates require a redeploy | Sales team works from stale inventory between releases |
| [CODE] | CRM name-string matching + `'omnia'` hardcoded exclusion in Performance | Silent stat loss on spelling differences; magic business rule |

### Low
| Tag | Finding | Why it matters |
|---|---|---|
| [CODE] | Dead copy `apps/stagepilot/frontend/`; root litter (`masterv-data.json`, `remap-map.js`, report JSONs); `lib/scenario-prompts/temp/`; `public/R8_D_P.xlsx` | Confuses every new contributor (incl. AI tooling); minor data exposure |
| [CODE] | Duplicate pagination (`fetchAllIds` vs `fetchAllRows`) and `shuffle()` implementations | Same bug class must be fixed twice |
| [CODE] | Hand-rolled CSV parser in cron route | Quoted-newline CSVs will corrupt reports |
| [UX] | Two different tools both labeled "WhatsApp" for different roles | Cross-role confusion in training/support |
| [CODE] | Unpaginated queries on growing tables (bay_reports, tickets) | Future silent truncation at 1,000 rows |
| [SECURITY] | `gemini-scenarios` endpoint unauthenticated (metadata only) | Consistency; trivial to gate |
| [ADMIN-GAP] | No impersonation/"view-as" | Every support case needs screenshots |

---

### Suggested attack order (post-Expo)
1. Rotate the Supabase service-role key; strip keys from `scripts/` (Critical, ~1 hour).
2. Add `CRON_SECRET` check to `daily-report`; gate or invite-code `/api/register` (Critical/High, ~1 hour).
3. Fix the two remaining 1,000-cap/200-cap data-truncation bugs (High, small).
4. De-hardcode the cron report config into a settings table (High, unblocks roster changes).
5. Role-change + deactivate in Admin users, plus search (High/Medium).
6. Then the structural track: shared auth helper, `teams` table, UI kit extraction, i18n completion, Find-a-Property data pipeline.
