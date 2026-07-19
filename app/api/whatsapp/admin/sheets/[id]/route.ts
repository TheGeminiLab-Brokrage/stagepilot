import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/supabase/fetch-all-rows'

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let contacts: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let assignments: any[]
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contacts = await fetchAllRows<any>((from, to) =>
      adminClient
        .from('whatsapp_contacts')
        .select('id, phone, client_name, first_response_at, first_response_agent:profiles!first_response_agent_id(full_name)')
        .eq('sheet_id', id)
        .order('phone', { ascending: true })
        .range(from, to))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assignments = await fetchAllRows<any>((from, to) =>
      adminClient
        .from('whatsapp_assignments')
        .select('id, contact_id, cycle, message_text, sent_at, response_status, responded_at, agent:profiles!agent_id(id, full_name)')
        .eq('sheet_id', id)
        .order('cycle', { ascending: true })
        .range(from, to))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load contacts/assignments'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const { data: assignedAgents } = await adminClient
    .from('whatsapp_sheet_agents')
    .select('agent_id, agent:profiles!agent_id(id, full_name)')
    .eq('sheet_id', id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assigned_agents = (assignedAgents ?? []).map((r: any) => {
    const a = Array.isArray(r.agent) ? r.agent[0] : r.agent
    return { id: a?.id ?? r.agent_id, full_name: a?.full_name ?? '' }
  })

  return NextResponse.json({ sheet, contacts: contacts ?? [], assignments: assignments ?? [], assigned_agents })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, companyId } = await requireSuperAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const { id } = await params
  const adminClient = createAdminClient()

  const { data: sheet, error: sheetErr } = await adminClient
    .from('whatsapp_sheets')
    .select('id')
    .eq('id', id)
    .eq('company_id', companyId!)
    .single()

  if (sheetErr || !sheet) return NextResponse.json({ error: 'Sheet not found' }, { status: 404 })

  const { error: deleteErr } = await adminClient
    .from('whatsapp_sheets')
    .delete()
    .eq('id', id)

  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
