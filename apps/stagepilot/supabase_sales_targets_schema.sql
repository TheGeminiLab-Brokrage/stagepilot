-- =============================================
-- StagePilot Sales Targets Schema
-- Run this in Supabase SQL Editor
--
-- Lets a super_admin set a monthly revenue target per agent and manually
-- log the deals (client + value + date) that count toward it. Deals are
-- independent of the CRM export sync ("done deal" stage on the Performance
-- Dashboard's Status Changes tab) — this is a separate, admin-maintained
-- ledger, not derived from it.
--
-- team_name is snapshotted onto each row at write time (same convention
-- as call_records.team_name) rather than live-joined from profiles, so a
-- team leader's view of past deals/targets doesn't shift if an agent
-- later changes teams.
-- =============================================

-- =============================================
-- MAKE THIS SCRIPT SAFELY RE-RUNNABLE
-- =============================================

drop table if exists public.sales_target_exclusions cascade;
drop table if exists public.sales_deals cascade;
drop table if exists public.sales_targets cascade;

-- =============================================
-- TABLES
-- =============================================

create table public.sales_targets (
  id             uuid primary key default uuid_generate_v4(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  agent_id       uuid not null references public.profiles(id) on delete cascade,
  team_name      text,
  period         date not null,
  target_amount  numeric(12,2) not null check (target_amount >= 0),
  created_by     uuid not null references public.profiles(id) on delete cascade,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint sales_targets_agent_period_unique unique (agent_id, period)
);

create table public.sales_deals (
  id            uuid primary key default uuid_generate_v4(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  agent_id      uuid not null references public.profiles(id) on delete cascade,
  team_name     text,
  client_name   text not null check (char_length(trim(client_name)) > 0),
  deal_value    numeric(12,2) not null check (deal_value > 0),
  deal_date     date not null,
  created_by    uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Agents an admin has removed from the Sales Targets roster. This doesn't
-- touch the agent's actual account (see app/api/admin/delete-user for
-- that) — it just hides them from this tab's agent list. Reversible: an
-- admin can remove the exclusion row to add the agent back. Past
-- sales_targets/sales_deals rows for that agent are untouched either way.
create table public.sales_target_exclusions (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  agent_id    uuid not null references public.profiles(id) on delete cascade,
  created_by  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint sales_target_exclusions_unique unique (company_id, agent_id)
);

alter table public.sales_targets enable row level security;
alter table public.sales_deals enable row level security;
alter table public.sales_target_exclusions enable row level security;

-- =============================================
-- RLS POLICIES: sales_targets
-- =============================================

create policy "agents see own sales targets"
  on public.sales_targets for select
  using (agent_id = auth.uid() and company_id = public.my_company_id());

create policy "team leaders see team sales targets"
  on public.sales_targets for select
  using (
    company_id = public.my_company_id()
    and public.my_role() = 'team_leader'
    and team_name = public.my_team()
  );

create policy "super_admin manages sales targets"
  on public.sales_targets for all
  using (company_id = public.my_company_id() and public.my_role() = 'super_admin');

-- =============================================
-- RLS POLICIES: sales_deals
-- =============================================

create policy "agents see own sales deals"
  on public.sales_deals for select
  using (agent_id = auth.uid() and company_id = public.my_company_id());

create policy "team leaders see team sales deals"
  on public.sales_deals for select
  using (
    company_id = public.my_company_id()
    and public.my_role() = 'team_leader'
    and team_name = public.my_team()
  );

create policy "super_admin manages sales deals"
  on public.sales_deals for all
  using (company_id = public.my_company_id() and public.my_role() = 'super_admin');

-- =============================================
-- RLS POLICIES: sales_target_exclusions
-- =============================================

create policy "super_admin manages sales target exclusions"
  on public.sales_target_exclusions for all
  using (company_id = public.my_company_id() and public.my_role() = 'super_admin');

-- Service role (used by API routes) bypasses RLS by default

-- =============================================
-- INDEXES
-- =============================================

create index sales_targets_company_period_idx on public.sales_targets (company_id, period);
create index sales_targets_agent_period_idx on public.sales_targets (agent_id, period);
create index sales_deals_company_agent_date_idx on public.sales_deals (company_id, agent_id, deal_date);
create index sales_deals_company_date_idx on public.sales_deals (company_id, deal_date);
create index sales_target_exclusions_company_idx on public.sales_target_exclusions (company_id);
