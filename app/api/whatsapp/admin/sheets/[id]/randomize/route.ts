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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, companyId } = await requireSuperAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const { id } = await params
  const adminClient = createAdminClient()

  const { data: sheet, error: sheetErr } = await adminClient
    .from('whatsapp_sheets')
    .select('id, current_cycle, company_id')
    .eq('id', id)
    .eq('company_id', companyId!)
    .single()

  if (sheetErr || !sheet) return NextResponse.json({ error: 'Sheet not found' }, { status: 404 })

  // Check for sheet-specific agent assignments first
  const { data: sheetAgents } = await adminClient
    .from('whatsapp_sheet_agents')
    .select('agent_id')
    .eq('sheet_id', id)

  const [{ data: contacts, error: contactsErr }, { data: existing, error: existingErr }] = await Promise.all([
    adminClient.from('whatsapp_contacts').select('id').eq('sheet_id', id),
    adminClient.from('whatsapp_assignments').select('contact_id, agent_id, sent_at').eq('sheet_id', id),
  ])

  let agents: { id: string }[] | null = null
  let agentsErr: { message: string } | null = null

  if (sheetAgents && sheetAgents.length > 0) {
    // Sheet has specific agent assignments — use only those agents
    const { data, error } = await adminClient
      .from('profiles')
      .select('id')
      .in('id', sheetAgents.map(r => r.agent_id))
      .eq('role', 'agent')
    agents = data
    agentsErr = error
  } else {
    // Legacy sheet — fall back to all whatsapp_active agents
    const { data, error } = await adminClient
      .from('profiles')
      .select('id')
      .eq('company_id', sheet.company_id)
      .eq('role', 'agent')
      .eq('whatsapp_active', true)
    agents = data
    agentsErr = error
  }

  if (agentsErr) return NextResponse.json({ error: agentsErr.message }, { status: 500 })
  if (contactsErr) return NextResponse.json({ error: contactsErr.message }, { status: 500 })
  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 })

  if (!agents || agents.length === 0) {
    return NextResponse.json({ error: 'No agents available to assign' }, { status: 400 })
  }

  const DRIP_SIZE = 30

  // Golden rule: a contact, once assigned to any agent, is permanently theirs —
  // it never re-enters distribution for a different agent, answered or not.
  const assignedContactIds = new Set((existing ?? []).map(a => a.contact_id))
  const newCycle = sheet.current_cycle + 1

  // Seed each eligible agent's load from their current unsent (in-flight) count,
  // so this round tops them up to DRIP_SIZE instead of stacking another 30 on
  // top of whatever they haven't sent yet.
  const load = new Map<string, number>(agents.map(a => [a.id, 0]))
  for (const a of existing ?? []) {
    if (!a.sent_at && load.has(a.agent_id)) {
      load.set(a.agent_id, load.get(a.agent_id)! + 1)
    }
  }

  const newRows: { sheet_id: string; contact_id: string; agent_id: string; company_id: string; cycle: number }[] = []
  let exhausted = 0
  let alreadyAssigned = 0

  for (const contact of shuffle(contacts ?? [])) {
    if (assignedContactIds.has(contact.id)) { alreadyAssigned++; continue }

    const eligible = agents.filter(a => load.get(a.id)! < DRIP_SIZE)
    if (eligible.length === 0) { exhausted++; continue }

    eligible.sort((a, b) => (load.get(a.id)! - load.get(b.id)!))
    const minLoad = load.get(eligible[0].id)!
    const tied = eligible.filter(a => load.get(a.id) === minLoad)
    const chosen = tied[Math.floor(Math.random() * tied.length)]

    newRows.push({ sheet_id: id, contact_id: contact.id, agent_id: chosen.id, company_id: sheet.company_id, cycle: newCycle })
    load.set(chosen.id, load.get(chosen.id)! + 1)
  }

  if (newRows.length > 0) {
    const { error: insertErr } = await adminClient.from('whatsapp_assignments').insert(newRows)
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  const { error: updateErr } = await adminClient
    .from('whatsapp_sheets')
    .update({ current_cycle: newCycle })
    .eq('id', id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ success: true, cycle: newCycle, assigned: newRows.length, exhausted, alreadyAssigned })
}
