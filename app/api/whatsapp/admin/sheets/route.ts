import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdminOrTeamLeader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401, companyId: null, userId: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin' && profile?.role !== 'team_leader') {
    return { error: 'Forbidden', status: 403, companyId: null, userId: null }
  }
  return { error: null, status: 200, companyId: profile.company_id as string, userId: user.id }
}

interface IncomingContact {
  phone: string
  client_name?: string | null
}

export async function POST(request: NextRequest) {
  const { error, status, companyId, userId } = await requireAdminOrTeamLeader()
  if (error) return NextResponse.json({ error }, { status })

  const { name, contacts } = await request.json().catch(() => ({}))

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Missing sheet name' }, { status: 400 })
  }
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return NextResponse.json({ error: 'No contacts provided' }, { status: 400 })
  }

  // Dedupe by normalized phone within this sheet
  const seen = new Set<string>()
  const rows: { sheet_id: string; company_id: string; phone: string; client_name: string | null }[] = []
  const cleanContacts = (contacts as IncomingContact[])
    .map(c => ({ phone: String(c.phone ?? '').trim(), client_name: c.client_name ? String(c.client_name).trim() : null }))
    .filter(c => c.phone.length > 0)

  for (const c of cleanContacts) {
    const key = c.phone.replace(/\D/g, '')
    if (!key || seen.has(key)) continue
    seen.add(key)
    rows.push({ sheet_id: '', company_id: companyId!, phone: c.phone, client_name: c.client_name })
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No valid phone numbers found' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  const { data: sheet, error: sheetError } = await adminClient
    .from('whatsapp_sheets')
    .insert({ company_id: companyId, name, uploaded_by: userId })
    .select()
    .single()

  if (sheetError || !sheet) {
    return NextResponse.json({ error: sheetError?.message ?? 'Failed to create sheet' }, { status: 500 })
  }

  const contactRows = rows.map(r => ({ ...r, sheet_id: sheet.id }))

  const { error: contactsError } = await adminClient
    .from('whatsapp_contacts')
    .insert(contactRows)

  if (contactsError) {
    await adminClient.from('whatsapp_sheets').delete().eq('id', sheet.id)
    return NextResponse.json({ error: contactsError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, sheet, contactCount: contactRows.length })
}
