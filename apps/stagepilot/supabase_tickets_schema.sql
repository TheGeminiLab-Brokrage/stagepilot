-- =============================================
-- StagePilot Ticket Schema (replaces supabase_tasklist_schema.sql)
-- Run this in Supabase SQL Editor
--
-- Jira-like ticketing feature layered onto the same profiles/role/team
-- model as chat and the old task-list checklist feature.
--
-- A super_admin or team_leader creates a ticket (title + description +
-- priority + optional due date) and assigns it to one or more agents.
-- Each assignee tracks their own status independently (open/done) and
-- can toggle it either way — unlike the old task-list feature, which was
-- fully insert-only/immutable, ticket_assignees now has an UPDATE policy
-- so an assignee can reopen a ticket they marked done by mistake.
--
-- Assignability (same rule as the old is_task_assignable()):
--   - super_admin may assign to any agent or team_leader company-wide
--   - team_leader may assign only to agents on their own team
--     (team_name match — a team leader's team_name equals their own
--     full_name, per the existing convention)
--
-- Photos: admins/managers can attach photos to a ticket at creation time
-- (stored in a private Storage bucket "ticket-attachments", metadata rows
-- in ticket_attachments below). Assignees can view but not add photos.
-- =============================================

-- =============================================
-- DROP OLD TASK-LIST FEATURE
-- =============================================

do $$
begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_list_recipients') then
    alter publication supabase_realtime drop table public.task_list_recipients;
  end if;
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_list_item_completions') then
    alter publication supabase_realtime drop table public.task_list_item_completions;
  end if;
end $$;

drop table if exists public.task_list_item_completions cascade;
drop table if exists public.task_list_recipients cascade;
drop table if exists public.task_list_items cascade;
drop table if exists public.task_lists cascade;

drop function if exists public.owns_task_item(uuid);
drop function if exists public.can_complete_task_item(uuid);
drop function if exists public.is_task_list_recipient(uuid, uuid);
drop function if exists public.owns_task_list(uuid);
drop function if exists public.is_task_assignable(uuid);

-- =============================================
-- MAKE THIS SCRIPT SAFELY RE-RUNNABLE
--
-- If a previous attempt got partway through (e.g. failed on a later
-- statement), the tables below may already exist. Drop them (cascade
-- removes their own policies/indexes/trigger automatically, and drops
-- them from the realtime publication too) so this script can always be
-- run fresh from the top regardless of how far the last run got.
-- =============================================

drop table if exists public.ticket_attachments cascade;
drop table if exists public.ticket_assignees cascade;
drop table if exists public.tickets cascade;

drop policy if exists "ticket photos: creator uploads" on storage.objects;
drop policy if exists "ticket photos: creator or assignee reads" on storage.objects;

-- =============================================
-- TABLES
-- =============================================

create table public.tickets (
  id           uuid primary key default uuid_generate_v4(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  created_by   uuid not null references public.profiles(id) on delete cascade,
  title        text not null check (char_length(trim(title)) > 0),
  description  text not null default '',
  priority     text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  due_date     date,
  created_at   timestamptz not null default now()
);

create table public.ticket_assignees (
  id            uuid primary key default uuid_generate_v4(),
  ticket_id     uuid not null references public.tickets(id) on delete cascade,
  assignee_id   uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'open' check (status in ('open','done')),
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  constraint ticket_assignees_unique unique (ticket_id, assignee_id)
);

create table public.ticket_attachments (
  id            uuid primary key default uuid_generate_v4(),
  ticket_id     uuid not null references public.tickets(id) on delete cascade,
  storage_path  text not null,
  kind          text not null default 'photo' check (kind in ('photo','voice')),
  uploaded_by   uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now()
);

alter table public.tickets enable row level security;
alter table public.ticket_assignees enable row level security;
alter table public.ticket_attachments enable row level security;

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

create or replace function public.is_ticket_assignable(target_id uuid)
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

create or replace function public.owns_ticket(target_ticket_id uuid)
returns boolean language sql stable security definer as $$
  select exists (select 1 from public.tickets where id = target_ticket_id and created_by = auth.uid())
$$;

create or replace function public.is_ticket_assignee(target_ticket_id uuid, target_assignee_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.ticket_assignees
    where ticket_id = target_ticket_id and assignee_id = target_assignee_id
  )
$$;

-- =============================================
-- RLS POLICIES: tickets
-- =============================================

create policy "tickets: admin or manager creates"
  on public.tickets for insert
  with check (
    created_by = auth.uid()
    and company_id = public.my_company_id()
    and public.my_role() in ('super_admin', 'team_leader')
  );

create policy "tickets: creator reads own"
  on public.tickets for select using (created_by = auth.uid());

create policy "tickets: assignee reads assigned"
  on public.tickets for select using (public.is_ticket_assignee(id, auth.uid()));

-- No update/delete policy on tickets itself in v1 — title/description/
-- priority/due_date are immutable once created, same philosophy as the
-- old task-list feature.

-- =============================================
-- RLS POLICIES: ticket_assignees
-- =============================================

create policy "ticket assignees: admin assigns"
  on public.ticket_assignees for insert
  with check (public.owns_ticket(ticket_id) and public.is_ticket_assignable(assignee_id));

create policy "ticket assignees: creator reads own ticket's assignees"
  on public.ticket_assignees for select using (public.owns_ticket(ticket_id));

create policy "ticket assignees: assignee reads own row"
  on public.ticket_assignees for select using (assignee_id = auth.uid());

-- Deliberate change vs. the old fully-immutable task-list model: an
-- assignee must be able to flip their own row open<->done.
create policy "ticket assignees: assignee updates own status"
  on public.ticket_assignees for update
  using (assignee_id = auth.uid())
  with check (assignee_id = auth.uid());

-- Column-level lock-down so the update policy can't be abused to
-- repoint ticket_id/assignee_id (RLS USING/WITH CHECK alone can't
-- compare old vs. new column values) — only allow touching status
-- and completed_at.
revoke update on public.ticket_assignees from authenticated;
grant update (status, completed_at) on public.ticket_assignees to authenticated;

-- =============================================
-- RLS POLICIES: ticket_attachments
-- =============================================

-- Insert-only by the ticket's creator — photos are attached at creation
-- time; assignees can view but not add their own in v1.
create policy "ticket attachments: creator adds photos"
  on public.ticket_attachments for insert
  with check (public.owns_ticket(ticket_id) and uploaded_by = auth.uid());

create policy "ticket attachments: creator reads own ticket's photos"
  on public.ticket_attachments for select using (public.owns_ticket(ticket_id));

create policy "ticket attachments: assignee reads assigned ticket's photos"
  on public.ticket_attachments for select using (public.is_ticket_assignee(ticket_id, auth.uid()));

-- =============================================
-- STORAGE: ticket-attachments bucket
--
-- Create a private bucket named "ticket-attachments" via the Supabase
-- dashboard Storage UI before running the policies below (this repo has
-- no prior bucket-creation SQL — the existing "call-recordings" bucket
-- was likewise created out-of-band via the dashboard).
--
-- Uploaded object paths must follow: {company_id}/{ticket_id}/{filename}
-- so storage-level RLS can scope access per ticket via the folder path.
-- =============================================

create policy "ticket photos: creator uploads"
  on storage.objects for insert
  with check (
    bucket_id = 'ticket-attachments'
    and public.owns_ticket(((storage.foldername(name))[2])::uuid)
  );

create policy "ticket photos: creator or assignee reads"
  on storage.objects for select
  using (
    bucket_id = 'ticket-attachments'
    and (
      public.owns_ticket(((storage.foldername(name))[2])::uuid)
      or public.is_ticket_assignee(((storage.foldername(name))[2])::uuid, auth.uid())
    )
  );

-- =============================================
-- TRIGGER: keep completed_at consistent on status toggle
-- =============================================

create or replace function public.set_ticket_assignee_completed_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'done' and old.status <> 'done' then
    new.completed_at := now();
  elsif new.status = 'open' and old.status <> 'open' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger ticket_assignees_set_completed_at
  before update on public.ticket_assignees
  for each row execute function public.set_ticket_assignee_completed_at();

-- =============================================
-- INDEXES
-- =============================================

create index ticket_assignees_ticket_idx on public.ticket_assignees (ticket_id);
create index ticket_assignees_assignee_idx on public.ticket_assignees (assignee_id, status);
create index tickets_created_by_idx on public.tickets (created_by, created_at desc);
create index ticket_attachments_ticket_idx on public.ticket_attachments (ticket_id);

-- =============================================
-- REALTIME
-- =============================================

-- Only ticket_assignees needs live cross-session notification — ticket
-- content and attachments are fetched on open. Both INSERT (new
-- assignment) and UPDATE (status toggle) events matter here.
alter publication supabase_realtime add table public.ticket_assignees;
