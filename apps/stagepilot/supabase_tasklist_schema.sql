-- =============================================
-- StagePilot Task List Schema
-- Run this in Supabase SQL Editor after supabase_chat_schema.sql
--
-- Admin/manager checklist feature layered onto the 1:1 chat system.
-- A super_admin or team_leader creates a named list of free-text items
-- and assigns it to one or more recipients. Each recipient has a fully
-- independent completion state — recipients never see each other's
-- progress, and there is no reply/conversation concept here.
--
-- Assignability:
--   - super_admin may assign to any agent or team_leader company-wide
--   - team_leader may assign only to agents on their own team
--     (team_name match — a team leader's team_name equals their own
--     full_name, per the existing convention)
-- =============================================

create table public.task_lists (
  id           uuid primary key default uuid_generate_v4(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  created_by   uuid not null references public.profiles(id) on delete cascade,
  title        text not null check (char_length(trim(title)) > 0),
  created_at   timestamptz not null default now()
);

create table public.task_list_items (
  id           uuid primary key default uuid_generate_v4(),
  task_list_id uuid not null references public.task_lists(id) on delete cascade,
  body         text not null check (char_length(trim(body)) > 0),
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);

create table public.task_list_recipients (
  id           uuid primary key default uuid_generate_v4(),
  task_list_id uuid not null references public.task_lists(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  constraint task_list_recipients_unique unique (task_list_id, recipient_id)
);

-- Completion is tracked per (item, recipient) — never a shared flag on
-- the item — because the same item must be independently "open" for
-- one recipient and "done" for another (private-per-recipient).
create table public.task_list_item_completions (
  task_list_item_id uuid not null references public.task_list_items(id) on delete cascade,
  recipient_id      uuid not null references public.profiles(id) on delete cascade,
  completed_at      timestamptz not null default now(),
  primary key (task_list_item_id, recipient_id)
);

alter table public.task_lists enable row level security;
alter table public.task_list_items enable row level security;
alter table public.task_list_recipients enable row level security;
alter table public.task_list_item_completions enable row level security;

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Assignability depends on the *caller's* role: a super_admin may target
-- any agent or team_leader company-wide; a team_leader may only target
-- agents on their own team — not other team leaders, not agents
-- outside their team.
create or replace function public.is_task_assignable(target_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles target
    where target.id = target_id
      and target.company_id = public.my_company_id()
      and (
        (public.my_role() = 'super_admin' and target.role in ('agent', 'team_leader'))
        or
        (public.my_role() = 'team_leader' and target.role = 'agent' and target.team_name = public.my_team())
      )
  )
$$;

create or replace function public.owns_task_list(target_list_id uuid)
returns boolean language sql stable security definer as $$
  select exists (select 1 from public.task_lists where id = target_list_id and created_by = auth.uid())
$$;

create or replace function public.is_task_list_recipient(target_list_id uuid, target_recipient_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.task_list_recipients
    where task_list_id = target_list_id and recipient_id = target_recipient_id
  )
$$;

create or replace function public.can_complete_task_item(target_item_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.task_list_items ti
    where ti.id = target_item_id and public.is_task_list_recipient(ti.task_list_id, auth.uid())
  )
$$;

create or replace function public.owns_task_item(target_item_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.task_list_items ti
    where ti.id = target_item_id and public.owns_task_list(ti.task_list_id)
  )
$$;

-- =============================================
-- RLS POLICIES: task_lists
-- =============================================

create policy "task lists: admin or manager creates"
  on public.task_lists for insert
  with check (
    created_by = auth.uid()
    and company_id = public.my_company_id()
    and public.my_role() in ('super_admin', 'team_leader')
  );

create policy "task lists: creator reads own"
  on public.task_lists for select using (created_by = auth.uid());

create policy "task lists: recipient reads assigned"
  on public.task_lists for select using (public.is_task_list_recipient(id, auth.uid()));

-- =============================================
-- RLS POLICIES: task_list_items
-- =============================================

create policy "task list items: admin creates"
  on public.task_list_items for insert with check (public.owns_task_list(task_list_id));

create policy "task list items: creator reads own"
  on public.task_list_items for select using (public.owns_task_list(task_list_id));

create policy "task list items: recipient reads assigned"
  on public.task_list_items for select using (public.is_task_list_recipient(task_list_id, auth.uid()));

-- =============================================
-- RLS POLICIES: task_list_recipients
-- =============================================

create policy "task list recipients: admin assigns"
  on public.task_list_recipients for insert
  with check (public.owns_task_list(task_list_id) and public.is_task_assignable(recipient_id));

create policy "task list recipients: creator reads own list's recipients"
  on public.task_list_recipients for select using (public.owns_task_list(task_list_id));

create policy "task list recipients: recipient reads own membership"
  on public.task_list_recipients for select using (recipient_id = auth.uid());

-- =============================================
-- RLS POLICIES: task_list_item_completions
-- =============================================

create policy "task list completions: recipient marks own items done"
  on public.task_list_item_completions for insert
  with check (recipient_id = auth.uid() and public.can_complete_task_item(task_list_item_id));

create policy "task list completions: recipient reads own"
  on public.task_list_item_completions for select using (recipient_id = auth.uid());

create policy "task list completions: creator tracks progress"
  on public.task_list_item_completions for select using (public.owns_task_item(task_list_item_id));

-- No update/delete policies anywhere in v1 — lists, items, recipients,
-- and completions are all immutable once written.

-- =============================================
-- INDEXES
-- =============================================

create index task_list_items_list_idx on public.task_list_items (task_list_id, position);
create index task_list_recipients_list_idx on public.task_list_recipients (task_list_id);
create index task_list_recipients_recipient_idx on public.task_list_recipients (recipient_id);
create index task_list_item_completions_recipient_idx on public.task_list_item_completions (recipient_id);
create index task_lists_created_by_idx on public.task_lists (created_by, created_at desc);

-- =============================================
-- REALTIME
-- =============================================

-- Only these two need live cross-session notification — lists/items are
-- immutable and fetched on open, same as the chat thread's fetch-on-open
-- pattern.
alter publication supabase_realtime add table public.task_list_recipients;
alter publication supabase_realtime add table public.task_list_item_completions;
