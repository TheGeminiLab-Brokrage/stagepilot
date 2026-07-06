-- =============================================
-- StagePilot Chat: voice notes migration
-- Run after supabase_chat_schema.sql, supabase_chat_team_scope_migration.sql,
-- and supabase_chat_groups_schema.sql.
--
-- Manual pre-req: create a private Storage bucket named
-- "chat-attachments" via the Supabase dashboard before running this file
-- (this repo has no bucket-creation SQL for any bucket — same as
-- ticket-attachments and call-recordings).
--
-- Before dropping the body check constraints below, confirm their real
-- names (they may differ from the guessed defaults used here):
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid in ('public.chat_messages'::regclass, 'public.chat_group_messages'::regclass)
--     and contype = 'c';
--
-- Path convention (parsed via storage.foldername(name)):
--   DM:    {company_id}/dm/{sender_id}/{recipient_id}/{uuid}.webm
--   Group: {company_id}/group/{group_id}/{uuid}.webm
-- =============================================

-- =============================================
-- chat_messages: attachment columns
-- =============================================

alter table public.chat_messages
  add column attachment_path text,
  add column attachment_kind text check (attachment_kind in ('voice')),
  add column attachment_duration_seconds int check (attachment_duration_seconds is null or attachment_duration_seconds > 0);

alter table public.chat_messages
  drop constraint chat_messages_body_check;

alter table public.chat_messages
  add constraint chat_messages_body_or_attachment check (
    char_length(trim(body)) > 0 or attachment_path is not null
  ),
  add constraint chat_messages_attachment_pair check (
    (attachment_path is null) = (attachment_kind is null)
  );

-- chat_messages_lock_immutable_fields must also protect the new columns
-- (only read_at may change on UPDATE, same rule as before).
create or replace function public.chat_messages_lock_immutable_fields()
returns trigger language plpgsql as $$
begin
  if new.sender_id <> old.sender_id
     or new.recipient_id <> old.recipient_id
     or new.body <> old.body
     or new.company_id <> old.company_id
     or new.created_at <> old.created_at
     or new.attachment_path is distinct from old.attachment_path
     or new.attachment_kind is distinct from old.attachment_kind
     or new.attachment_duration_seconds is distinct from old.attachment_duration_seconds then
    raise exception 'chat_messages: only read_at may be updated';
  end if;
  return new;
end;
$$;

-- =============================================
-- chat_group_messages: attachment columns
-- =============================================

alter table public.chat_group_messages
  add column attachment_path text,
  add column attachment_kind text check (attachment_kind in ('voice')),
  add column attachment_duration_seconds int check (attachment_duration_seconds is null or attachment_duration_seconds > 0);

alter table public.chat_group_messages
  drop constraint chat_group_messages_body_check;

alter table public.chat_group_messages
  add constraint chat_group_messages_body_or_attachment check (
    char_length(trim(body)) > 0 or attachment_path is not null
  ),
  add constraint chat_group_messages_attachment_pair check (
    (attachment_path is null) = (attachment_kind is null)
  );

-- No update policy exists on chat_group_messages, so no immutability
-- trigger is needed there (nothing can be updated after insert).

-- =============================================
-- STORAGE: chat-attachments bucket RLS
-- =============================================

-- DM voice notes: uploader must be the sender segment of the path, and
-- the recipient segment must be someone the sender is chat-eligible to
-- reach (mirrors "chat: eligible users send messages" on chat_messages).
create policy "chat dm attachments: sender uploads"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[2] = 'dm'
    and (storage.foldername(name))[1] = public.my_company_id()::text
    and auth.uid()::text = (storage.foldername(name))[3]
    and public.is_chat_eligible(((storage.foldername(name))[4])::uuid)
  );

-- DM voice notes: either party in the path may read (mirrors "chat:
-- participants read their messages" — identity check only, so history
-- stays reachable even if team assignment later changes).
create policy "chat dm attachments: sender or recipient reads"
  on storage.objects for select
  using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[2] = 'dm'
    and auth.uid()::text in ((storage.foldername(name))[3], (storage.foldername(name))[4])
  );

-- Group voice notes: any current group member may upload.
create policy "chat group attachments: member uploads"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[2] = 'group'
    and (storage.foldername(name))[1] = public.my_company_id()::text
    and public.is_group_member(((storage.foldername(name))[3])::uuid)
  );

-- Group voice notes: any current group member may read (a removed
-- member loses access, matching "chat group messages: members read").
create policy "chat group attachments: member reads"
  on storage.objects for select
  using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[2] = 'group'
    and public.is_group_member(((storage.foldername(name))[3])::uuid)
  );

-- No changes needed to the supabase_realtime publication — chat_messages
-- and chat_group_messages are already added, so the new attachment
-- columns ride along automatically in existing INSERT payloads.
