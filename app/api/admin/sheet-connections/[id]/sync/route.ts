import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncSheetConnection } from '@/lib/sheet-sync'

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

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, companyId } = await requireSuperAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const { id } = await params
  const adminClient = createAdminClient()

  const { data: conn, error: fetchErr } = await adminClient
    .from('sheet_connections')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId!)
    .single()

  if (fetchErr || !conn) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })

  const result = await syncSheetConnection({
    id: conn.id,
    company_id: conn.company_id,
    sheet_id: conn.sheet_id,
    tab_name: conn.tab_name,
    header_row: conn.header_row ?? 1,
    scenario_ids: conn.scenario_ids ?? [],
    category: conn.category,
    column_mapping: conn.column_mapping ?? {},
  })

  await adminClient
    .from('sheet_connections')
    .update({ last_synced_at: new Date().toISOString(), last_sync_result: result })
    .eq('id', id)

  const statusCode = result.error ? 422 : 200
  return NextResponse.json(result, { status: statusCode })
}
