import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Profile = { id: string; role: string; company_id: string }

async function authorise() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') return null
  return { user, profile: profile as Profile }
}

// GET — list agents currently removed from the Sales Targets roster
export async function GET() {
  const auth = await authorise()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data: exclusions, error } = await admin
    .from('sales_target_exclusions')
    .select('agent_id')
    .eq('company_id', auth.profile.company_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const agentIds = (exclusions ?? []).map(e => e.agent_id)
  const { data: agents } = agentIds.length > 0
    ? await admin.from('profiles').select('id, full_name, team_name').in('id', agentIds)
    : { data: [] }

  return NextResponse.json({ ok: true, excluded: agents ?? [] })
}

// POST — remove an agent from the Sales Targets roster
export async function POST(request: NextRequest) {
  const auth = await authorise()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { agentId } = await request.json().catch(() => ({})) as { agentId?: string }
  if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('sales_target_exclusions')
    .upsert({
      company_id: auth.profile.company_id,
      agent_id:   agentId,
      created_by: auth.profile.id,
    }, { onConflict: 'company_id,agent_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — add an agent back to the Sales Targets roster
export async function DELETE(request: NextRequest) {
  const auth = await authorise()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { agentId } = await request.json().catch(() => ({})) as { agentId?: string }
  if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('sales_target_exclusions')
    .delete()
    .eq('company_id', auth.profile.company_id)
    .eq('agent_id', agentId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
