import { NextRequest, NextResponse } from 'next/server'
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

export async function GET() {
  const { error, status, companyId } = await requireSuperAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const adminClient = createAdminClient()
  const { data: agents, error: agentsErr } = await adminClient
    .from('profiles')
    .select('id, full_name, team_name, whatsapp_active')
    .eq('company_id', companyId!)
    .eq('role', 'agent')
    .order('full_name')

  if (agentsErr) return NextResponse.json({ error: agentsErr.message }, { status: 500 })

  return NextResponse.json({ agents: agents ?? [] })
}

export async function PATCH(request: NextRequest) {
  const { error, status, companyId } = await requireSuperAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const { id, whatsapp_active } = await request.json().catch(() => ({}))

  if (!id || typeof id !== 'string' || typeof whatsapp_active !== 'boolean') {
    return NextResponse.json({ error: 'Missing or invalid id/whatsapp_active' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { error: updateErr } = await adminClient
    .from('profiles')
    .update({ whatsapp_active })
    .eq('id', id)
    .eq('company_id', companyId!)
    .eq('role', 'agent')

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
