-- =============================================
-- StagePilot Tickets: due date time-of-day migration
-- Run this in Supabase SQL Editor against a database where
-- supabase_tickets_schema.sql has already been applied.
--
-- Widens tickets.due_date from `date` to `timestamptz` so managers
-- can set a due time (hours), not just a due day. Existing values are
-- cast as-is (midnight UTC on the stored day) — no data is lost.
-- =============================================

alter table public.tickets
  alter column due_date type timestamptz using due_date::timestamptz;
