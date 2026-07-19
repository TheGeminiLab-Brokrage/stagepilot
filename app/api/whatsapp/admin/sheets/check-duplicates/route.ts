import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/supabase/fetch-all-rows'

async function requireAdminOrTeamLeader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401, companyId: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin' && profile?.role !== 'team_leader') {
    return { error: 'Forbidden', status: 403, companyId: null }
  }
  return { error: null, status: 200, companyId: profile.company_id as string }
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export async function POST(request: NextRequest) {
  const { error, status, companyId } = await requireAdminOrTeamLeader()
  if (error) return NextResponse.json({ error }, { status })

  const { phones } = await request.json().catch(() => ({}))
  if (!Array.isArray(phones) || phones.length === 0) {
    return NextResponse.json({ error: 'phones must be a non-empty array' }, { status: 400 })
  }

  const requestedKeys = new Set(phones.map((p: string) => normalizePhone(String(p ?? ''))).filter(Boolean))

  const adminClient = createAdminClient()

  let existingContacts: { id: string; phone: string; client_name: string | null; sheet_id: string }[]
  try {
    existingContacts = await fetchAllRows<{ id: string; phone: string; client_name: string | null; sheet_id: string }>((from, to) =>
      adminClient
        .from('whatsapp_contacts')
        .select('id, phone, client_name, sheet_id')
        .eq('company_id', companyId!)
        .order('id', { ascending: true })
        .range(from, to))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load existing contacts'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const matches = existingContacts.filter(c => requestedKeys.has(normalizePhone(c.phone)))
  if (matches.length === 0) {
    return NextResponse.json({ duplicates: [] })
  }

  const sheetIds = Array.from(new Set(matches.map(c => c.sheet_id)))
  const contactIds = matches.map(c => c.id)

  const [{ data: sheets }, { data: assignments }] = await Promise.all([
    adminClient.from('whatsapp_sheets').select('id, name').in('id', sheetIds),
    adminClient
      .from('whatsapp_assignments')
      .select('contact_id, response_status')
      .in('contact_id', contactIds),
  ])

  const sheetNameById = new Map((sheets ?? []).map(s => [s.id as string, s.name as string]))
  const statusByContactId = new Map((assignments ?? []).map(a => [a.contact_id as string, a.response_status as string]))

  const duplicates = matches.map(c => ({
    phone: c.phone,
    client_name: c.client_name,
    sheet_name: sheetNameById.get(c.sheet_id) ?? 'Unknown sheet',
    status: statusByContactId.get(c.id) ?? 'never_distributed',
  }))

  return NextResponse.json({ duplicates })
}
