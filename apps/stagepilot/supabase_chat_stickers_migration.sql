-- =============================================
-- StagePilot Chat: sticker attachments migration
-- Run after supabase_chat_reactions_migration.sql.
--
-- Adds 'sticker' as a valid attachment_kind. Unlike 'voice'/'image',
-- attachment_path for a sticker is NOT a Storage object path — it's a
-- static catalog slug (e.g. "sold-sign") resolved client-side to
-- /stickers/{slug}.png, a bundled public asset shipped with the app. No
-- Storage bucket or RLS changes are needed since nothing is uploaded.
--
-- Before dropping the attachment_kind check constraints below, confirm
-- their real (auto-generated) names:
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid in ('public.chat_messages'::regclass, 'public.chat_group_messages'::regclass)
--     and contype = 'c'
--     and pg_get_constraintdef(oid) like '%attachment_kind%';
-- =============================================

alter table public.chat_messages
  drop constraint chat_messages_attachment_kind_check;

alter table public.chat_messages
  add constraint chat_messages_attachment_kind_check
  check (attachment_kind in ('voice', 'image', 'sticker'));

alter table public.chat_group_messages
  drop constraint chat_group_messages_attachment_kind_check;

alter table public.chat_group_messages
  add constraint chat_group_messages_attachment_kind_check
  check (attachment_kind in ('voice', 'image', 'sticker'));
