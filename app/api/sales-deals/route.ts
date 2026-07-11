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

function nextPeriod(period: string) {
  const [year, month] = period.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1 + 1, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

// Roster of agents visible to the caller, scoped by role — mirrors /api/sales-targets.
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

// GET — deals for a given month (default: current month), scoped to the caller's role
export async function GET(request: NextRequest) {
  const auth = await authorise()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const period = request.nextUrl.searchParams.get('period') ?? defaultPeriod()

  const admin = createAdminClient()
  const roster = await getRoster(admin, auth.profile)
  const rosterIds = roster.map(r => r.id)

  const { data: deals, error } = rosterIds.length > 0
    ? await admin
        .from('sales_deals')
        .select('id, agent_id, client_name, deal_value, deal_date, created_at')
        .eq('company_id', auth.profile.company_id)
        .gte('deal_date', period)
        .lt('deal_date', nextPeriod(period))
        .in('agent_id', rosterIds)
        .order('deal_date', { ascending: false })
    : { data: [], error: null }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, period, deals: deals ?? [] })
}

// POST — log a new deal. super_admin only.
export async function POST(request: NextRequest) {
  const auth = await authorise()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (auth.profile.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const agentId = body?.agentId as string | undefined
  const clientName = String(body?.clientName ?? '').trim()
  const dealValue = Number(body?.dealValue)
  const dealDate = body?.dealDate as string | undefined

  if (!agentId || !clientName || !dealDate || !Number.isFinite(dealValue) || dealValue <= 0) {
    return NextResponse.json({ error: 'agentId, clientName, a positive dealValue, and dealDate are required' }, { status: 400 })
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
    .from('sales_deals')
    .insert({
      company_id:  auth.profile.company_id,
      agent_id:    agentId,
      team_name:   agentProfile.team_name,
      client_name: clientName,
      deal_value:  dealValue,
      deal_date:   dealDate,
      created_by:  auth.profile.id,
    })
    .select('id, agent_id, client_name, deal_value, deal_date')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, deal: data })
}

// PUT — edit an existing deal. super_admin only.
export async function PUT(request: NextRequest) {
  const auth = await authorise()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (auth.profile.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const id = body?.id as string | undefined
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = createAdminClient()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.clientName !== undefined) {
    const clientName = String(body.clientName).trim()
    if (!clientName) return NextResponse.json({ error: 'clientName cannot be empty' }, { status: 400 })
    update.client_name = clientName
  }
  if (body.dealValue !== undefined) {
    const dealValue = Number(body.dealValue)
    if (!Number.isFinite(dealValue) || dealValue <= 0) return NextResponse.json({ error: 'dealValue must be positive' }, { status: 400 })
    update.deal_value = dealValue
  }
  if (body.dealDate !== undefined) update.deal_date = body.dealDate
  if (body.agentId !== undefined) {
    const { data: agentProfile } = await admin
      .from('profiles')
      .select('team_name')
      .eq('id', body.agentId)
      .eq('company_id', auth.profile.company_id)
      .single()
    if (!agentProfile) return NextResponse.json({ error: 'Agent not found' }, { status: 400 })
    update.agent_id = body.agentId
    update.team_name = agentProfile.team_name
  }

  const { data, error } = await admin
    .from('sales_deals')
    .update(update)
    .eq('id', id)
    .eq('company_id', auth.profile.company_id)
    .select('id, agent_id, client_name, deal_value, deal_date')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, deal: data })
}

// DELETE — remove a deal. super_admin only.
export async function DELETE(request: NextRequest) {
  const auth = await authorise()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (auth.profile.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await request.json().catch(() => ({})) as { id?: string }
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('sales_deals')
    .delete()
    .eq('id', id)
    .eq('company_id', auth.profile.company_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
