import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const DRIP_SIZE = 30

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'agent') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { sheetId } = body as { sheetId?: string }
  if (!sheetId) return NextResponse.json({ error: 'sheetId required' }, { status: 400 })

  const adminClient = createAdminClient()

  // Verify sheet belongs to the agent's company
  const { data: sheet } = await adminClient
    .from('whatsapp_sheets')
    .select('id, current_cycle, company_id')
    .eq('id', sheetId)
    .eq('company_id', profile.company_id)
    .single()

  if (!sheet) return NextResponse.json({ error: 'Sheet not found' }, { status: 404 })

  // If sheet has specific agent assignments, verify this agent is one of them
  const { data: sheetAgents } = await adminClient
    .from('whatsapp_sheet_agents')
    .select('agent_id')
    .eq('sheet_id', sheetId)

  if (sheetAgents && sheetAgents.length > 0) {
    if (!sheetAgents.some(r => r.agent_id === user.id)) {
      return NextResponse.json({ error: 'You are not assigned to this sheet' }, { status: 403 })
    }
  }

  // Get all contact_ids already claimed by any agent for this sheet
  const { data: claimed } = await adminClient
    .from('whatsapp_assignments')
    .select('contact_id')
    .eq('sheet_id', sheetId)

  const claimedIds = (claimed ?? []).map(c => c.contact_id as string)

  // Fetch contacts not yet assigned to any agent
  let contactsQuery = adminClient
    .from('whatsapp_contacts')
    .select('id, phone, client_name')
    .eq('sheet_id', sheetId)

  if (claimedIds.length > 0) {
    contactsQuery = contactsQuery.not('id', 'in', `(${claimedIds.join(',')})`)
  }

  const { data: available, error: availErr } = await contactsQuery
  if (availErr) return NextResponse.json({ error: availErr.message }, { status: 500 })

  if (!available || available.length === 0) {
    return NextResponse.json({ assignments: [], done: true })
  }

  const batch = shuffle(available).slice(0, DRIP_SIZE)

  const newRows = batch.map(contact => ({
    sheet_id: sheetId,
    contact_id: contact.id,
    agent_id: user.id,
    company_id: profile.company_id as string,
    cycle: sheet.current_cycle,
  }))

  const { data: inserted, error: insertErr } = await adminClient
    .from('whatsapp_assignments')
    .insert(newRows)
    .select('id')

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  const insertedIds = (inserted ?? []).map(r => r.id as string)

  // Re-query with joined contact + sheet to match the shape WhatsAppClient expects
  const { data: rawAssignments, error: fetchErr } = await adminClient
    .from('whatsapp_assignments')
    .select(`
      id, cycle, message_text, sent_at, response_status,
      contact:whatsapp_contacts!contact_id(id, phone, client_name),
      sheet:whatsapp_sheets!sheet_id(id, name, current_cycle)
    `)
    .in('id', insertedIds)
    .order('created_at', { ascending: true })

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignments = (rawAssignments ?? []).map((a: any) => ({
    ...a,
    contact: Array.isArray(a.contact) ? a.contact[0] : a.contact,
    sheet: Array.isArray(a.sheet) ? a.sheet[0] : a.sheet,
  })).filter((a: any) => a.contact && a.sheet)

  return NextResponse.json({ assignments, done: false })
}
