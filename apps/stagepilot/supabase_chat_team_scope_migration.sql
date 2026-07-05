-- =============================================
-- StagePilot Chat: team-scope migration
-- Run this in Supabase SQL Editor against a database where
-- supabase_chat_schema.sql has already been applied.
--
-- Restricts chat visibility/eligibility so that:
--   - super_admin can chat with everyone (unchanged)
--   - everyone can chat with super_admin (unchanged)
--   - team_leaders can chat with each other across teams
--   - agents can only chat within their own team (their team_leader
--     and team-mates), plus super_admin
-- Previously any chat-eligible user could message any other
-- chat-eligible user regardless of team.
-- =============================================

-- Is target a valid chat partner for the caller? super_admin talks to
-- everyone; everyone talks to super_admin; team_leaders talk to each other
-- cross-team; otherwise partner must share the caller's team_name (this is
-- also how an agent reaches their own team_leader, since a team_leader's
-- team_name is set to their own full_name — see create-user route).
create or replace function public.is_chat_partner_of(target_role text, target_team text)
returns boolean language sql stable security definer as $$
  select public.my_role() = 'super_admin'
      or target_role = 'super_admin'
      or (public.my_role() = 'team_leader' and target_role = 'team_leader')
      or target_team = public.my_team()
$$;

-- Is target_id one of the 3 chat-eligible roles, in the caller's company,
-- and a valid chat partner per is_chat_partner_of?
create or replace function public.is_chat_eligible(target_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles target
    where target.id = target_id
      and target.role in ('agent', 'team_leader', 'super_admin')
      and target.company_id = public.my_company_id()
      and public.is_chat_partner_of(target.role, target.team_name)
  )
$$;

-- Roster visibility: scope the existing "see company roster" policy down
-- to valid chat partners (Postgres has no `create or replace policy`, so
-- drop and recreate).
drop policy "chat: eligible roles see company roster" on public.profiles;

create policy "chat: eligible roles see company roster"
  on public.profiles for select
  using (
    company_id = public.my_company_id()
    and public.my_role() in ('agent', 'team_leader', 'super_admin')
    and role in ('agent', 'team_leader', 'super_admin')
    and public.is_chat_partner_of(role, team_name)
  );
