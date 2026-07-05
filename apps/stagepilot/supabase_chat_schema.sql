-- =============================================
-- StagePilot Chat Schema
-- Run this in Supabase SQL Editor after supabase_schema.sql
--
-- IMPORTANT: before running, verify the live `profiles.role` check
-- constraint with:
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint where conrelid = 'public.profiles'::regclass;
-- The checked-in supabase_schema.sql only lists
-- ('super_admin','team_leader','agent'), but production has been
-- widened to also allow 'trainee','exam','property_viewer'. This
-- schema assumes those three extra roles exist and must be excluded
-- from chat.
-- =============================================

create table public.chat_messages (
  id           uuid primary key default uuid_generate_v4(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body         text not null check (char_length(trim(body)) > 0),
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  constraint chat_messages_no_self_message check (sender_id <> recipient_id)
);

alter table public.chat_messages enable row level security;

-- =============================================
-- HELPER FUNCTIONS
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
-- and a valid chat partner per is_chat_partner_of? security definer (mirrors
-- my_role()/my_team() style) so it can read a counterpart's profile row even
-- when the caller's own profiles RLS policies wouldn't otherwise expose it
-- to them directly.
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

-- =============================================
-- RLS POLICIES: chat_messages
-- =============================================

create policy "chat: eligible users send messages"
  on public.chat_messages for insert
  with check (
    sender_id = auth.uid()
    and company_id = public.my_company_id()
    and public.my_role() in ('agent', 'team_leader', 'super_admin')
    and public.is_chat_eligible(recipient_id)
  );

create policy "chat: participants read their messages"
  on public.chat_messages for select
  using (auth.uid() in (sender_id, recipient_id));

create policy "chat: recipient marks read"
  on public.chat_messages for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- RLS `with check` alone can't diff old vs. new non-target columns, so a
-- trigger stops a recipient from using their UPDATE grant to rewrite
-- body/sender/etc. instead of just setting read_at.
create or replace function public.chat_messages_lock_immutable_fields()
returns trigger language plpgsql as $$
begin
  if new.sender_id <> old.sender_id
     or new.recipient_id <> old.recipient_id
     or new.body <> old.body
     or new.company_id <> old.company_id
     or new.created_at <> old.created_at then
    raise exception 'chat_messages: only read_at may be updated';
  end if;
  return new;
end;
$$;

create trigger chat_messages_lock_immutable_fields
  before update on public.chat_messages
  for each row execute function public.chat_messages_lock_immutable_fields();

-- =============================================
-- INDEXES
-- =============================================

-- Thread view: all messages between two specific people, chronological.
-- least/greatest canonicalizes pair order so one index serves both directions.
create index chat_messages_thread_idx
  on public.chat_messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at);

-- Unread-count / inbox queries
create index chat_messages_recipient_unread_idx
  on public.chat_messages (recipient_id, read_at) where read_at is null;

-- Per-contact last-message / contact-list ordering
create index chat_messages_sender_created_idx on public.chat_messages (sender_id, created_at desc);
create index chat_messages_recipient_created_idx on public.chat_messages (recipient_id, created_at desc);

-- =============================================
-- RLS POLICY: profiles (additive roster visibility for chat)
-- =============================================

-- The existing "team leaders see their team" policy only lets
-- team_leader/super_admin see beyond their own row — a plain agent
-- currently can't see peer profiles at all. This widens visibility
-- (Postgres OR's policies together for the same command) without
-- touching the existing policy, and never exposes
-- trainee/exam/property_viewer rows to anyone new, nor lets those
-- excluded roles see anyone new (their my_role() won't match).
-- is_chat_partner_of() further scopes the roster to team-mates, one's own
-- team_leader, other team_leaders, and super_admin (see is_chat_eligible
-- above for the full rationale).
create policy "chat: eligible roles see company roster"
  on public.profiles for select
  using (
    company_id = public.my_company_id()
    and public.my_role() in ('agent', 'team_leader', 'super_admin')
    and role in ('agent', 'team_leader', 'super_admin')
    and public.is_chat_partner_of(role, team_name)
  );

-- =============================================
-- REALTIME
-- =============================================

-- Verify first: select * from pg_publication;
-- If supabase_realtime publication doesn't exist yet, create it instead:
--   create publication supabase_realtime for table public.chat_messages;
alter publication supabase_realtime add table public.chat_messages;
