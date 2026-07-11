-- =============================================
-- StagePilot Chat: message reactions migration
-- Run after supabase_chat_image_attachments_migration.sql.
--
-- Adds quick-react emoji reactions to both 1:1 and group messages, each
-- in its own table (chat_messages disallows updating anything but
-- read_at via a trigger; chat_group_messages has no update policy at
-- all) — reactions can't be columns on the message row, and are a
-- many-per-message concept anyway, so a join table is required regardless.
--
-- One reaction per (message, user): the client deletes the row to clear
-- a reaction, or upserts (onConflict: 'message_id,user_id') to set/replace
-- it, so a user can only ever have one emoji active per message.
-- =============================================

create table public.chat_message_reactions (
  id          uuid primary key default uuid_generate_v4(),
  message_id  uuid not null references public.chat_messages(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  emoji       text not null check (emoji in ('👍','❤️','😂','😮','😢','🙏')),
  created_at  timestamptz not null default now(),
  unique (message_id, user_id)
);

create table public.chat_group_message_reactions (
  id          uuid primary key default uuid_generate_v4(),
  message_id  uuid not null references public.chat_group_messages(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  emoji       text not null check (emoji in ('👍','❤️','😂','😮','😢','🙏')),
  created_at  timestamptz not null default now(),
  unique (message_id, user_id)
);

alter table public.chat_message_reactions enable row level security;
alter table public.chat_group_message_reactions enable row level security;

-- =============================================
-- RLS POLICIES: chat_message_reactions
-- Visibility/write eligibility mirrors "can I see the parent message?",
-- i.e. auth.uid() in (sender_id, recipient_id) on chat_messages.
-- =============================================

create policy "chat reactions: participant reads"
  on public.chat_message_reactions for select
  using (
    exists (
      select 1 from public.chat_messages m
      where m.id = message_id
        and auth.uid() in (m.sender_id, m.recipient_id)
    )
  );

create policy "chat reactions: participant reacts as self"
  on public.chat_message_reactions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.chat_messages m
      where m.id = message_id
        and auth.uid() in (m.sender_id, m.recipient_id)
    )
  );

-- Needed for upsert(..., { onConflict: 'message_id,user_id' }), which lets
-- a user change their emoji without a separate delete-then-insert round trip.
create policy "chat reactions: user updates own reaction"
  on public.chat_message_reactions for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.chat_messages m
      where m.id = message_id
        and auth.uid() in (m.sender_id, m.recipient_id)
    )
  );

create policy "chat reactions: user removes own reaction"
  on public.chat_message_reactions for delete
  using (user_id = auth.uid());

-- =============================================
-- RLS POLICIES: chat_group_message_reactions
-- Mirrors is_group_member(group_id) via the parent group message.
-- =============================================

create policy "chat group reactions: member reads"
  on public.chat_group_message_reactions for select
  using (
    exists (
      select 1 from public.chat_group_messages gm
      where gm.id = message_id
        and public.is_group_member(gm.group_id)
    )
  );

create policy "chat group reactions: member reacts as self"
  on public.chat_group_message_reactions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.chat_group_messages gm
      where gm.id = message_id
        and public.is_group_member(gm.group_id)
    )
  );

create policy "chat group reactions: user updates own reaction"
  on public.chat_group_message_reactions for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.chat_group_messages gm
      where gm.id = message_id
        and public.is_group_member(gm.group_id)
    )
  );

create policy "chat group reactions: user removes own reaction"
  on public.chat_group_message_reactions for delete
  using (user_id = auth.uid());

-- =============================================
-- INDEXES
-- =============================================

create index chat_message_reactions_message_idx on public.chat_message_reactions (message_id);
create index chat_group_message_reactions_message_idx on public.chat_group_message_reactions (message_id);

-- =============================================
-- REALTIME
-- =============================================

alter publication supabase_realtime add table public.chat_message_reactions;
alter publication supabase_realtime add table public.chat_group_message_reactions;
