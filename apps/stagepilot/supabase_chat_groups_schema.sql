-- =============================================
-- StagePilot Chat Groups Schema
-- Run this in Supabase SQL Editor after supabase_chat_schema.sql
-- and supabase_chat_team_scope_migration.sql (this file depends on
-- is_chat_eligible()/is_chat_partner_of() already existing).
--
-- Lets team_leaders and super_admin create named groups and hand-pick
-- members from the same pool they can already 1:1 chat with
-- (is_chat_eligible). Membership is editable after creation by the
-- creator or any super_admin.
-- =============================================

create table public.chat_groups (
  id           uuid primary key default uuid_generate_v4(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  created_by   uuid not null references public.profiles(id) on delete cascade,
  name         text not null check (char_length(trim(name)) > 0),
  created_at   timestamptz not null default now()
);

create table public.chat_group_members (
  group_id     uuid not null references public.chat_groups(id) on delete cascade,
  member_id    uuid not null references public.profiles(id) on delete cascade,
  added_by     uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (group_id, member_id)
);

create table public.chat_group_messages (
  id           uuid primary key default uuid_generate_v4(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  group_id     uuid not null references public.chat_groups(id) on delete cascade,
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  body         text not null check (char_length(trim(body)) > 0),
  created_at   timestamptz not null default now()
);

-- Per-member "last seen" watermark for unread badges — simpler than
-- per-message read rows, since a group message has N recipients rather
-- than the single recipient a 1:1 chat_messages row has.
create table public.chat_group_read_state (
  group_id      uuid not null references public.chat_groups(id) on delete cascade,
  member_id     uuid not null references public.profiles(id) on delete cascade,
  last_read_at  timestamptz not null default now(),
  primary key (group_id, member_id)
);

alter table public.chat_groups enable row level security;
alter table public.chat_group_members enable row level security;
alter table public.chat_group_messages enable row level security;
alter table public.chat_group_read_state enable row level security;

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Can the caller manage (add/remove members of) this group? Its creator
-- always can; super_admin can manage any group in their company as an
-- oversight override.
create or replace function public.is_group_creator(target_group_id uuid)
returns boolean language sql stable security definer as $$
  select public.my_role() = 'super_admin'
    or exists (
      select 1 from public.chat_groups
      where id = target_group_id and created_by = auth.uid()
    )
$$;

-- Is the caller currently a member of this group?
create or replace function public.is_group_member(target_group_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.chat_group_members
    where group_id = target_group_id and member_id = auth.uid()
  )
$$;

-- =============================================
-- RLS POLICIES: chat_groups
-- =============================================

create policy "chat groups: team_leader/super_admin create"
  on public.chat_groups for insert
  with check (
    created_by = auth.uid()
    and company_id = public.my_company_id()
    and public.my_role() in ('team_leader', 'super_admin')
  );

create policy "chat groups: creator, admin, or member can view"
  on public.chat_groups for select
  using (
    company_id = public.my_company_id()
    and (
      created_by = auth.uid()
      or public.my_role() = 'super_admin'
      or public.is_group_member(id)
    )
  );

-- =============================================
-- RLS POLICIES: chat_group_members
-- =============================================

-- Reuses is_chat_eligible() verbatim from supabase_chat_schema.sql, so
-- "who can be added to my group" always matches "who I can 1:1 chat with".
create policy "chat group members: creator/admin adds eligible member"
  on public.chat_group_members for insert
  with check (
    added_by = auth.uid()
    and public.is_group_creator(group_id)
    and public.is_chat_eligible(member_id)
  );

create policy "chat group members: creator/admin removes"
  on public.chat_group_members for delete
  using (public.is_group_creator(group_id));

create policy "chat group members: creator, admin, or fellow member views roster"
  on public.chat_group_members for select
  using (
    public.is_group_creator(group_id)
    or public.is_group_member(group_id)
  );

-- =============================================
-- RLS POLICIES: chat_group_messages
-- =============================================

-- Note: unlike 1:1 chat_messages (where history stays readable forever
-- once sent), a removed group member loses access to this group's
-- history entirely, since select is gated on current membership.
create policy "chat group messages: members post"
  on public.chat_group_messages for insert
  with check (
    sender_id = auth.uid()
    and company_id = public.my_company_id()
    and public.is_group_member(group_id)
  );

create policy "chat group messages: members read"
  on public.chat_group_messages for select
  using (public.is_group_member(group_id));

-- =============================================
-- RLS POLICIES: chat_group_read_state
-- =============================================

create policy "chat group read state: member reads own watermark"
  on public.chat_group_read_state for select
  using (member_id = auth.uid());

create policy "chat group read state: member sets own watermark"
  on public.chat_group_read_state for insert
  with check (member_id = auth.uid() and public.is_group_member(group_id));

create policy "chat group read state: member updates own watermark"
  on public.chat_group_read_state for update
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

-- =============================================
-- INDEXES
-- =============================================

create index chat_group_members_member_idx on public.chat_group_members (member_id);
create index chat_group_messages_group_created_idx on public.chat_group_messages (group_id, created_at);

-- =============================================
-- REALTIME
-- =============================================

alter publication supabase_realtime add table public.chat_group_messages;
alter publication supabase_realtime add table public.chat_group_members;
