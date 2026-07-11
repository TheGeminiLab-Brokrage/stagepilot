-- =============================================
-- StagePilot Chat: image attachments migration
-- Run after supabase_chat_voice_notes_migration.sql.
--
-- Adds 'image' as a valid attachment_kind alongside the existing 'voice'
-- kind on chat_messages and chat_group_messages. No storage bucket or RLS
-- policy changes are needed: the "chat-attachments" bucket policies only
-- check bucket_id / folder path segments / membership, not content type
-- or extension, so image uploads that follow the existing voice-note path
-- convention are already covered.
--
-- Before dropping the attachment_kind check constraints below, confirm
-- their real (auto-generated) names:
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid in ('public.chat_messages'::regclass, 'public.chat_group_messages'::regclass)
--     and contype = 'c'
--     and pg_get_constraintdef(oid) like '%attachment_kind%';
--
-- Path convention (unchanged, extension varies by file type instead of
-- always .webm):
--   DM:    {company_id}/dm/{sender_id}/{recipient_id}/{uuid}.{ext}
--   Group: {company_id}/group/{group_id}/{uuid}.{ext}
-- =============================================

alter table public.chat_messages
  drop constraint chat_messages_attachment_kind_check;

alter table public.chat_messages
  add constraint chat_messages_attachment_kind_check
  check (attachment_kind in ('voice', 'image'));

alter table public.chat_group_messages
  drop constraint chat_group_messages_attachment_kind_check;

alter table public.chat_group_messages
  add constraint chat_group_messages_attachment_kind_check
  check (attachment_kind in ('voice', 'image'));
