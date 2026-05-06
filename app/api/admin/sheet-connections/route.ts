import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractSheetId, syncSheetConnection } from '@/lib/sheet-sync'

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

export async function GET() {
  const { error, status, companyId } = await requireSuperAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const adminClient = createAdminClient()
  const { data, error: dbErr } = await adminClient
    .from('sheet_connections')
    .select('*')
    .eq('company_id', companyId!)
    .order('created_at', { ascending: false })

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const { error, status, companyId } = await requireSuperAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const body = await req.json()
  const { name, sheet_url, tab_name, scenario_ids, category, column_mapping } = body

  if (!name || !sheet_url || !tab_name || !category || !column_mapping) {
    return NextResponse.json({ error: 'name, sheet_url, tab_name, category, and column_mapping are required' }, { status: 400 })
  }

  const sheet_id = extractSheetId(sheet_url)
  const adminClient = createAdminClient()

  const { data, error: dbErr } = await adminClient
    .from('sheet_connections')
    .insert({
      company_id: companyId!,
      name,
      sheet_id,
      tab_name,
      scenario_ids: scenario_ids ?? [],
      category,
      column_mapping,
    })
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  // Trigger initial sync
  const syncResult = await syncSheetConnection({
    id: data.id,
    company_id: companyId!,
    sheet_id,
    tab_name,
    scenario_ids: scenario_ids ?? [],
    category,
    column_mapping,
  })

  await adminClient
    .from('sheet_connections')
    .update({ last_synced_at: new Date().toISOString(), last_sync_result: syncResult })
    .eq('id', data.id)

  return NextResponse.json({ ...data, last_sync_result: syncResult }, { status: 201 })
}
