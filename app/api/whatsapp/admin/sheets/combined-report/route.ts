import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/supabase/fetch-all-rows'

async function requireAdminOrTeamLeader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401, companyId: null, role: null, fullName: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin' && profile?.role !== 'team_leader') {
    return { error: 'Forbidden', status: 403, companyId: null, role: null, fullName: null }
  }
  return { error: null, status: 200, companyId: profile.company_id as string, role: profile.role as string, fullName: profile.full_name as string }
}

type Status = 'answered' | 'not_answered' | 'pending' | 'never_distributed'

export async function POST(request: NextRequest) {
  const { error, status, companyId, role, fullName } = await requireAdminOrTeamLeader()
  if (error) return NextResponse.json({ error }, { status })

  const { sheet_ids } = await request.json().catch(() => ({}))
  if (!Array.isArray(sheet_ids) || sheet_ids.length === 0) {
    return NextResponse.json({ error: 'sheet_ids must be a non-empty array' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  const { data: sheets, error: sheetsErr } = await adminClient
    .from('whatsapp_sheets')
    .select('id, name')
    .in('id', sheet_ids)
    .eq('company_id', companyId!)

  if (sheetsErr) return NextResponse.json({ error: sheetsErr.message }, { status: 500 })
  if (!sheets || sheets.length === 0) return NextResponse.json({ error: 'No matching sheets found' }, { status: 404 })

  const validSheetIds = sheets.map(s => s.id as string)

  let contacts: { id: string; phone: string; client_name: string | null; sheet_id: string }[]
  let assignments: { contact_id: string; agent_id: string; response_status: string }[]
  try {
    ;[contacts, assignments] = await Promise.all([
      fetchAllRows<{ id: string; phone: string; client_name: string | null; sheet_id: string }>((from, to) =>
        adminClient.from('whatsapp_contacts').select('id, phone, client_name, sheet_id').in('sheet_id', validSheetIds).order('id', { ascending: true }).range(from, to)),
      fetchAllRows<{ contact_id: string; agent_id: string; response_status: string }>((from, to) =>
        adminClient.from('whatsapp_assignments').select('contact_id, agent_id, response_status').in('sheet_id', validSheetIds).order('id', { ascending: true }).range(from, to)),
    ])
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load contacts/assignments'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  let teamAgentIds: Set<string> | null = null
  if (role === 'team_leader') {
    const { data: teamAgents } = await adminClient
      .from('profiles')
      .select('id')
      .eq('company_id', companyId!)
      .eq('role', 'agent')
      .eq('team_name', fullName!)
    teamAgentIds = new Set((teamAgents ?? []).map(a => a.id as string))
  }

  const assignmentByContactId = new Map(assignments.map(a => [a.contact_id, a]))
  const sheetNameById = new Map(sheets.map(s => [s.id as string, s.name as string]))

  const rows: { phone: string; client_name: string | null; sheet_name: string; status: Status }[] = []
  const stats: Record<Status, number> = { answered: 0, not_answered: 0, pending: 0, never_distributed: 0 }

  for (const c of contacts) {
    const assignment = assignmentByContactId.get(c.id)

    // Team leaders only see unclaimed contacts (available to anyone) plus contacts
    // already assigned to their own team — another team's claimed contacts are hidden.
    if (teamAgentIds && assignment && !teamAgentIds.has(assignment.agent_id)) continue

    const contactStatus: Status = assignment ? (assignment.response_status as Status) : 'never_distributed'
    stats[contactStatus]++
    rows.push({
      phone: c.phone,
      client_name: c.client_name,
      sheet_name: sheetNameById.get(c.sheet_id) ?? 'Unknown sheet',
      status: contactStatus,
    })
  }

  return NextResponse.json({
    sheets: sheets.map(s => ({ id: s.id, name: s.name })),
    stats: { ...stats, total: rows.length },
    contacts: rows,
  })
}
