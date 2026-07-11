-- =============================================
-- StagePilot Assessment Schema
-- Run this in Supabase SQL Editor
--
-- Map-based drag-and-drop assessment game (formerly a separate app,
-- "visual-assessment") testing agents' geographic knowledge of two
-- regions: North Coast ('north_coast') and New Capital, which has two
-- sub-variants ('capital_r8' = standard, 'capital_r7').
--
-- Reuses the existing profiles/role/team model (same as tickets/chat):
--   - agent takes assessments (own sessions/answers only)
--   - team_leader acts as "manager": reviews their own team's sessions
--     (team_name match) and submits per-zone price/detail data for the
--     New Capital assessment
--   - super_admin acts as "admin": reviews all sessions company-wide,
--     and approves one team_leader's zone-answer submission per zone as
--     the canonical one (multiple team_leaders can submit competing
--     answers for the same zone)
--
-- No va_profiles table — everything foreign-keys straight to
-- public.profiles(id), unlike the original standalone app which had its
-- own is_manager/is_admin profile table and its own login.
-- =============================================

-- =============================================
-- MAKE THIS SCRIPT SAFELY RE-RUNNABLE
-- =============================================

drop table if exists public.assessment_zone_answers cascade;
drop table if exists public.assessment_answers cascade;
drop table if exists public.assessment_sessions cascade;

drop function if exists public.is_on_my_team(uuid);

-- =============================================
-- TABLES
-- =============================================

create table public.assessment_sessions (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  region       text not null check (region in ('north_coast', 'capital_r8', 'capital_r7')),
  started_at   timestamptz not null default now(),
  completed_at timestamptz
);

create table public.assessment_answers (
  id           uuid primary key default uuid_generate_v4(),
  session_id   uuid not null references public.assessment_sessions(id) on delete cascade,
  phase        text not null,
  question_id  text not null,
  answer_given text,
  correct      boolean,
  created_at   timestamptz not null default now()
);

create table public.assessment_zone_answers (
  id              uuid primary key default uuid_generate_v4(),
  zone_id         text not null,
  capital_type    text not null check (capital_type in ('standard', 'r7')),
  price_per_meter numeric,
  part2_data      jsonb,
  submitted_by    uuid not null references public.profiles(id) on delete cascade,
  is_approved     boolean not null default false,
  created_at      timestamptz not null default now(),
  constraint assessment_zone_answers_per_submitter unique (zone_id, capital_type, submitted_by)
);

alter table public.assessment_sessions enable row level security;
alter table public.assessment_answers enable row level security;
alter table public.assessment_zone_answers enable row level security;

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

create or replace function public.is_on_my_team(target_user_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles target
    where target.id = target_user_id
      and target.company_id = public.my_company_id()
      and target.team_name = public.my_team()
  )
$$;

-- =============================================
-- RLS POLICIES: assessment_sessions
--
-- Narrow "own row" policies as defense-in-depth for the anon/browser
-- key. Team/company-wide reads for manager and admin views are done
-- server-side through app/api/assessment/* route handlers using the
-- service-role admin client after an explicit role check (same pattern
-- as app/dashboard/practice/page.tsx), not via RLS — so there is
-- deliberately no team_leader/super_admin SELECT policy here.
-- =============================================

create policy "assessment sessions: agent manages own"
  on public.assessment_sessions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =============================================
-- RLS POLICIES: assessment_answers
-- =============================================

create policy "assessment answers: agent manages own session's answers"
  on public.assessment_answers for all
  using (
    exists (
      select 1 from public.assessment_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.assessment_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

-- =============================================
-- RLS POLICIES: assessment_zone_answers
-- =============================================

create policy "assessment zone answers: team_leader submits own"
  on public.assessment_zone_answers for insert
  with check (submitted_by = auth.uid() and public.my_role() = 'team_leader');

create policy "assessment zone answers: submitter reads own"
  on public.assessment_zone_answers for select
  using (submitted_by = auth.uid());

create policy "assessment zone answers: submitter updates own price/detail data"
  on public.assessment_zone_answers for update
  using (submitted_by = auth.uid())
  with check (submitted_by = auth.uid());

-- Column-level lock-down: a team_leader can update their own submission's
-- price_per_meter/part2_data, but must not be able to self-approve by
-- writing is_approved directly. Only the service-role admin client (used
-- in app/api/assessment/admin/zone-answers after a super_admin check)
-- can flip is_approved.
revoke update on public.assessment_zone_answers from authenticated;
grant update (price_per_meter, part2_data) on public.assessment_zone_answers to authenticated;

-- =============================================
-- INDEXES
-- =============================================

create index assessment_sessions_user_idx on public.assessment_sessions (user_id, started_at desc);
create index assessment_answers_session_idx on public.assessment_answers (session_id);
create index assessment_zone_answers_zone_idx on public.assessment_zone_answers (zone_id, capital_type);
