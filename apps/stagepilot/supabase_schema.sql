-- =============================================
-- StagePilot Database Schema
-- Run this in Supabase SQL Editor (one-time setup)
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================
-- TABLES
-- =============================================

-- Companies (one row per paying customer)
create table public.companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz default now()
);

-- User profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('super_admin', 'team_leader', 'agent')),
  team_name text,  -- team_leader and agents belong to a team; super_admin can be null
  created_at timestamptz default now()
);

-- Call records (one row per processed call)
create table public.call_records (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  agent_id uuid not null references public.profiles(id) on delete cascade,
  team_name text,
  file_name text not null,
  client_name text,
  client_phone text,
  campaign text,
  stage text,                    -- AI-assigned stage
  stage_corrected text,          -- Team leader override
  reasoning text,
  transcript_summary text,
  status text not null default 'processing' check (status in ('processing', 'done', 'error')),
  error_message text,
  pain_points text,
  triple_c jsonb,
  agent_feedback text,
  uploaded_at timestamptz default now(),
  processed_at timestamptz
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.call_records enable row level security;

-- Helper function: get current user's company_id
create or replace function public.my_company_id()
returns uuid language sql stable security definer as $$
  select company_id from public.profiles where id = auth.uid()
$$;

-- Helper function: get current user's role
create or replace function public.my_role()
returns text language sql stable security definer as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Helper function: get current user's team_name
create or replace function public.my_team()
returns text language sql stable security definer as $$
  select team_name from public.profiles where id = auth.uid()
$$;

-- =============================================
-- RLS POLICIES: companies
-- =============================================

-- Users can only see their own company
create policy "users see own company"
  on public.companies for select
  using (id = public.my_company_id());

-- =============================================
-- RLS POLICIES: profiles
-- =============================================

-- Users can always see their own profile
create policy "users see own profile"
  on public.profiles for select
  using (id = auth.uid());

-- Team leaders see all profiles in their team (same company + same team)
create policy "team leaders see their team"
  on public.profiles for select
  using (
    company_id = public.my_company_id()
    and public.my_role() in ('team_leader', 'super_admin')
    and (team_name = public.my_team() or public.my_role() = 'super_admin')
  );

-- Only super_admin can insert/update profiles (invite flow goes through service role)
create policy "super_admin manages profiles"
  on public.profiles for all
  using (public.my_role() = 'super_admin');

-- =============================================
-- RLS POLICIES: call_records
-- =============================================

-- Agents see only their own calls
create policy "agents see own calls"
  on public.call_records for select
  using (
    agent_id = auth.uid()
    and company_id = public.my_company_id()
  );

-- Team leaders see all calls in their team
create policy "team leaders see team calls"
  on public.call_records for select
  using (
    company_id = public.my_company_id()
    and public.my_role() in ('team_leader', 'super_admin')
    and (team_name = public.my_team() or public.my_role() = 'super_admin')
  );

-- Agents can insert their own calls (status starts as 'processing')
create policy "agents insert own calls"
  on public.call_records for insert
  with check (
    agent_id = auth.uid()
    and company_id = public.my_company_id()
  );

-- Team leaders can update stage_corrected on their team's calls
create policy "team leaders correct stage"
  on public.call_records for update
  using (
    company_id = public.my_company_id()
    and public.my_role() in ('team_leader', 'super_admin')
    and (team_name = public.my_team() or public.my_role() = 'super_admin')
  );

-- Service role (used by API routes) can do everything — bypasses RLS by default

-- =============================================
-- INDEXES
-- =============================================

create index on public.call_records (company_id, agent_id);
create index on public.call_records (company_id, team_name);
create index on public.call_records (status);
create index on public.profiles (company_id, role);

-- =============================================
-- BAY REPORTS (agent daily self-submitted reports)
-- =============================================

create table public.bay_reports (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  company_id      uuid not null references public.companies(id) on delete cascade,
  full_name       text not null,
  report_date     date not null,
  -- Numeric metrics (matching Google Form fields 1–10)
  sheets          int not null default 0,
  posts           int not null default 0,
  requests        int not null default 0,
  followups       int not null default 0,
  total_leads     int not null default 0,
  reached         int not null default 0,
  not_reached     int not null default 0,
  crm_actions     int not null default 0,
  uploaded        int not null default 0,
  not_uploaded    int not null default 0,
  -- CRM confirm checkbox (field 11)
  crm_confirm     boolean not null default false,
  -- Missed uploads (fields 12–13); missed_calls = [{name,phone,reason},...]
  has_missed_uploads boolean not null default false,
  missed_calls    jsonb not null default '[]',
  -- Daily summary (field 14)
  summary         text not null default '',
  created_at      timestamptz default now(),
  unique (user_id, report_date)
);

alter table public.bay_reports enable row level security;

-- Agents: full access to their own rows only
create policy "agents own bay reports"
  on public.bay_reports for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid() and company_id = public.my_company_id());

-- Super admin: read all bay reports within their company
create policy "admin sees company bay reports"
  on public.bay_reports for select
  using (company_id = public.my_company_id() and public.my_role() = 'super_admin');

create index on public.bay_reports (user_id, report_date);
