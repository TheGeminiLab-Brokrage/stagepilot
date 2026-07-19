import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

export async function GET() {
  const { error, status, companyId, role, fullName } = await requireAdminOrTeamLeader()
  if (error) return NextResponse.json({ error }, { status })

  const adminClient = createAdminClient()
  let query = adminClient
    .from('profiles')
    .select('id, full_name, team_name, whatsapp_active')
    .eq('company_id', companyId!)
    .eq('role', 'agent')
    .order('full_name')
  // Team leaders only manage their own team's agents
  if (role === 'team_leader') query = query.eq('team_name', fullName!)

  const { data: agents, error: agentsErr } = await query

  if (agentsErr) return NextResponse.json({ error: agentsErr.message }, { status: 500 })

  return NextResponse.json({ agents: agents ?? [] })
}

export async function PATCH(request: NextRequest) {
  const { error, status, companyId, role, fullName } = await requireAdminOrTeamLeader()
  if (error) return NextResponse.json({ error }, { status })

  const { id, whatsapp_active } = await request.json().catch(() => ({}))

  if (!id || typeof id !== 'string' || typeof whatsapp_active !== 'boolean') {
    return NextResponse.json({ error: 'Missing or invalid id/whatsapp_active' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  let query = adminClient
    .from('profiles')
    .update({ whatsapp_active })
    .eq('id', id)
    .eq('company_id', companyId!)
    .eq('role', 'agent')
  // Team leaders may only toggle their own team's agents
  if (role === 'team_leader') query = query.eq('team_name', fullName!)

  const { error: updateErr } = await query

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
