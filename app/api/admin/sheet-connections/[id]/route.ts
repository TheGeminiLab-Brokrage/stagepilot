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

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, companyId } = await requireSuperAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const { id } = await params
  const body = await req.json()
  const { name, scenario_ids, category, column_mapping, is_active } = body

  const adminClient = createAdminClient()
  const { data, error: dbErr } = await adminClient
    .from('sheet_connections')
    .update({
      ...(name !== undefined && { name }),
      ...(scenario_ids !== undefined && { scenario_ids }),
      ...(category !== undefined && { category }),
      ...(column_mapping !== undefined && { column_mapping }),
      ...(is_active !== undefined && { is_active }),
    })
    .eq('id', id)
    .eq('company_id', companyId!)
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, companyId } = await requireSuperAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const { id } = await params
  const adminClient = createAdminClient()

  // Get the connection details to find source_refs to soft-delete
  const { data: conn } = await adminClient
    .from('sheet_connections')
    .select('sheet_id, tab_name')
    .eq('id', id)
    .eq('company_id', companyId!)
    .single()

  if (conn) {
    const refPrefix = `sheet:${conn.sheet_id}:tab:${encodeURIComponent(conn.tab_name)}:%`
    await adminClient
      .from('knowledge_entries')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .like('source_ref', refPrefix)
      .eq('company_id', companyId!)
  }

  const { error: dbErr } = await adminClient
    .from('sheet_connections')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId!)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
