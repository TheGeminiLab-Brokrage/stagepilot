-- =============================================
-- WhatsApp Campaign Rotation Schema
-- Run this in Supabase SQL Editor (one-time setup)
-- =============================================

create table public.whatsapp_sheets (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  name            text not null,
  uploaded_by     uuid not null references public.profiles(id),
  current_cycle   int not null default 0,
  created_at      timestamptz default now()
);

create table public.whatsapp_contacts (
  id                      uuid primary key default uuid_generate_v4(),
  sheet_id                uuid not null references public.whatsapp_sheets(id) on delete cascade,
  company_id              uuid not null references public.companies(id) on delete cascade,
  client_name             text,
  phone                   text not null,
  first_response_agent_id uuid references public.profiles(id),
  first_response_at       timestamptz,
  created_at              timestamptz default now(),
  unique (sheet_id, phone)
);

-- one row per (contact, agent) pair, ever — enforces "never the same client twice"
create table public.whatsapp_assignments (
  id              uuid primary key default uuid_generate_v4(),
  sheet_id        uuid not null references public.whatsapp_sheets(id) on delete cascade,
  contact_id      uuid not null references public.whatsapp_contacts(id) on delete cascade,
  agent_id        uuid not null references public.profiles(id) on delete cascade,
  company_id      uuid not null references public.companies(id) on delete cascade,
  cycle           int not null,
  message_text    text,
  sent_at         timestamptz,
  response_status text not null default 'pending' check (response_status in ('pending','answered','not_answered')),
  responded_at    timestamptz,
  created_at      timestamptz default now(),
  unique (sheet_id, contact_id, agent_id)
);

create index on public.whatsapp_contacts (sheet_id);
create index on public.whatsapp_assignments (sheet_id, agent_id, cycle);
create index on public.whatsapp_assignments (sheet_id, contact_id);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

alter table public.whatsapp_sheets enable row level security;
alter table public.whatsapp_contacts enable row level security;
alter table public.whatsapp_assignments enable row level security;

-- whatsapp_sheets: anyone in the company can see sheet names/cycle counters
create policy "company sees sheets"
  on public.whatsapp_sheets for select
  using (company_id = public.my_company_id());

-- whatsapp_contacts: super_admin sees all company contacts; agents see only
-- contacts they've actually been assigned at least once
create policy "admin sees company contacts"
  on public.whatsapp_contacts for select
  using (company_id = public.my_company_id() and public.my_role() = 'super_admin');

create policy "agents see own assigned contacts"
  on public.whatsapp_contacts for select
  using (
    exists (
      select 1 from public.whatsapp_assignments a
      where a.contact_id = whatsapp_contacts.id
        and a.agent_id = auth.uid()
    )
  );

-- whatsapp_assignments: agents see/update their own rows; super_admin sees all
create policy "agents see own assignments"
  on public.whatsapp_assignments for select
  using (agent_id = auth.uid());

create policy "agents update own assignments"
  on public.whatsapp_assignments for update
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

create policy "admin sees company assignments"
  on public.whatsapp_assignments for select
  using (company_id = public.my_company_id() and public.my_role() = 'super_admin');

-- Service role (used by API routes) bypasses RLS by default — used for
-- sheet/contact creation and the randomize (insert) action.
