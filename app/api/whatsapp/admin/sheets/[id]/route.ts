import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401, companyId: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') return { error: 'Forbidden', status: 403, companyId: null }
  return { error: null, status: 200, companyId: profile.company_id as string }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, companyId } = await requireSuperAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const { id } = await params
  const adminClient = createAdminClient()

  const { data: sheet, error: sheetErr } = await adminClient
    .from('whatsapp_sheets')
    .select('id, name, current_cycle, created_at')
    .eq('id', id)
    .eq('company_id', companyId!)
    .single()

  if (sheetErr || !sheet) return NextResponse.json({ error: 'Sheet not found' }, { status: 404 })

  const { data: contacts, error: contactsErr } = await adminClient
    .from('whatsapp_contacts')
    .select('id, phone, client_name, first_response_at, first_response_agent:profiles!first_response_agent_id(full_name)')
    .eq('sheet_id', id)
    .order('phone', { ascending: true })

  if (contactsErr) return NextResponse.json({ error: contactsErr.message }, { status: 500 })

  const { data: assignments, error: assignmentsErr } = await adminClient
    .from('whatsapp_assignments')
    .select('id, contact_id, cycle, message_text, sent_at, response_status, responded_at, agent:profiles!agent_id(id, full_name)')
    .eq('sheet_id', id)
    .order('cycle', { ascending: true })

  if (assignmentsErr) return NextResponse.json({ error: assignmentsErr.message }, { status: 500 })

  return NextResponse.json({ sheet, contacts: contacts ?? [], assignments: assignments ?? [] })
}
