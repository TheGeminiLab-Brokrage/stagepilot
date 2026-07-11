-- =============================================
-- StagePilot Tickets: admin visibility migration
-- Run this in Supabase SQL Editor against a database where
-- supabase_tickets_schema.sql has already been applied.
--
-- Lets super_admin see every ticket (and its assignees/attachments/
-- photo blobs) within their own company, not just tickets they
-- personally created. team_leader/agent visibility is unchanged —
-- these policies are purely additive (Postgres OR's multiple
-- permissive SELECT policies together), no existing policy is
-- dropped or narrowed.
-- =============================================

-- Resolve a ticket's company_id. Must be security definer — like
-- owns_ticket/is_ticket_assignee in supabase_tickets_schema.sql, this
-- is called from inside other tables' RLS policies below, so it can't
-- itself be subject to tickets' own RLS as the querying user (that
-- would create a circularity where the lookup silently returns no
-- row, defeating the policy without any error).
create or replace function public.ticket_company_id(target_ticket_id uuid)
returns uuid language sql stable security definer as $$
  select company_id from public.tickets where id = target_ticket_id
$$;

create policy "tickets: super_admin reads company tickets"
  on public.tickets for select
  using (
    public.my_role() = 'super_admin'
    and company_id = public.my_company_id()
  );

create policy "ticket assignees: super_admin reads company assignees"
  on public.ticket_assignees for select
  using (
    public.my_role() = 'super_admin'
    and public.ticket_company_id(ticket_id) = public.my_company_id()
  );

create policy "ticket attachments: super_admin reads company photos"
  on public.ticket_attachments for select
  using (
    public.my_role() = 'super_admin'
    and public.ticket_company_id(ticket_id) = public.my_company_id()
  );

-- Storage path convention is {company_id}/{ticket_id}/{filename}, so
-- this can check the company_id folder segment directly with no
-- extra join.
create policy "ticket photos: super_admin reads company photos"
  on storage.objects for select
  using (
    bucket_id = 'ticket-attachments'
    and public.my_role() = 'super_admin'
    and ((storage.foldername(name))[1])::uuid = public.my_company_id()
  );
