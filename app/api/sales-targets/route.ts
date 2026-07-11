import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_ROLES = ['agent', 'team_leader', 'super_admin']

type Profile = { id: string; role: string; company_id: string; full_name: string; team_name: string | null }

async function authorise() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, company_id, full_name, team_name')
    .eq('id', user.id)
    .single()

  if (!profile || !ALLOWED_ROLES.includes(profile.role)) return null
  return { user, profile: profile as Profile }
}

function defaultPeriod() {
  // Default to Cairo today (UTC+2), matching bay-reports' convention
  const cairoNow = new Date(Date.now() + 2 * 60 * 60 * 1000)
  return `${cairoNow.getUTCFullYear()}-${String(cairoNow.getUTCMonth() + 1).padStart(2, '0')}-01`
}

// Roster of agents visible to the caller for target-setting/viewing, scoped by role.
// Excludes agents an admin has removed from this tab (sales_target_exclusions).
async function getRoster(admin: ReturnType<typeof createAdminClient>, profile: Profile) {
  if (profile.role === 'agent') {
    return [{ id: profile.id, full_name: profile.full_name, team_name: profile.team_name }]
  }

  const { data: exclusions } = await admin
    .from('sales_target_exclusions')
    .select('agent_id')
    .eq('company_id', profile.company_id)

  const excludedIds = new Set((exclusions ?? []).map(e => e.agent_id))

  let query = admin
    .from('profiles')
    .select('id, full_name, team_name')
    .eq('company_id', profile.company_id)
    .in('role', ['agent', 'team_leader'])

  if (profile.role === 'team_leader') {
    query = query.eq('team_name', profile.team_name)
  }

  const { data } = await query
  return (data ?? []).filter(a => !excludedIds.has(a.id))
}

// GET — targets + roster for a given month (default: current month)
export async function GET(request: NextRequest) {
  const auth = await authorise()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const period = request.nextUrl.searchParams.get('period') ?? defaultPeriod()

  const admin = createAdminClient()
  const roster = await getRoster(admin, auth.profile)
  const rosterIds = roster.map(r => r.id)

  const { data: targets, error } = rosterIds.length > 0
    ? await admin
        .from('sales_targets')
        .select('id, agent_id, period, target_amount, created_at, updated_at')
        .eq('company_id', auth.profile.company_id)
        .eq('period', period)
        .in('agent_id', rosterIds)
    : { data: [], error: null }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, period, roster, targets: targets ?? [] })
}

// POST — set (upsert) an agent's target for a month. super_admin only.
export async function POST(request: NextRequest) {
  const auth = await authorise()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (auth.profile.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const agentId = body?.agentId as string | undefined
  const period = body?.period as string | undefined
  const targetAmount = Number(body?.targetAmount)

  if (!agentId || !period || !Number.isFinite(targetAmount) || targetAmount < 0) {
    return NextResponse.json({ error: 'agentId, period, and a non-negative targetAmount are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: agentProfile } = await admin
    .from('profiles')
    .select('team_name')
    .eq('id', agentId)
    .eq('company_id', auth.profile.company_id)
    .single()

  if (!agentProfile) return NextResponse.json({ error: 'Agent not found' }, { status: 400 })

  const { data, error } = await admin
    .from('sales_targets')
    .upsert({
      company_id:    auth.profile.company_id,
      agent_id:      agentId,
      team_name:     agentProfile.team_name,
      period,
      target_amount: targetAmount,
      created_by:    auth.profile.id,
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'agent_id,period' })
    .select('id, agent_id, period, target_amount')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, target: data })
}

// DELETE — remove a target. super_admin only.
export async function DELETE(request: NextRequest) {
  const auth = await authorise()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (auth.profile.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await request.json().catch(() => ({})) as { id?: string }
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('sales_targets')
    .delete()
    .eq('id', id)
    .eq('company_id', auth.profile.company_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
