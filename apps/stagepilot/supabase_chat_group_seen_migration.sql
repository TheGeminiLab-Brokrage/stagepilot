-- =============================================
-- StagePilot Chat: group "seen by" migration
-- Run after supabase_chat_groups_schema.sql.
--
-- Relaxes chat_group_read_state's SELECT policy so any group member can
-- see every member's read watermark for groups they belong to (needed to
-- compute "seen by: Alice, Bob" on a sender's own messages), matching the
-- same is_group_member() pattern already used for chat_group_messages'
-- SELECT policy. Previously each member could only see their own row.
--
-- Before dropping the policy below, confirm its real (auto-generated)
-- name if it doesn't match the guessed default used here:
--   select policyname
--   from pg_policies
--   where schemaname = 'public' and tablename = 'chat_group_read_state';
-- =============================================

drop policy "chat group read state: member reads own watermark"
  on public.chat_group_read_state;

create policy "chat group read state: members read all watermarks"
  on public.chat_group_read_state for select
  using (public.is_group_member(group_id));
