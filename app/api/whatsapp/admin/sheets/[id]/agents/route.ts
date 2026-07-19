import { NextResponse } from 'next/server'
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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, companyId, role, fullName } = await requireAdminOrTeamLeader()
  if (error) return NextResponse.json({ error }, { status })

  const { id } = await params
  const adminClient = createAdminClient()

  // Verify sheet belongs to this company
  const { data: sheet, error: sheetErr } = await adminClient
    .from('whatsapp_sheets')
    .select('id')
    .eq('id', id)
    .eq('company_id', companyId!)
    .single()

  if (sheetErr || !sheet) return NextResponse.json({ error: 'Sheet not found' }, { status: 404 })

  let agentsQuery = adminClient
    .from('profiles')
    .select('id, full_name, team_name, whatsapp_active')
    .eq('company_id', companyId!)
    .eq('role', 'agent')
    .order('full_name', { ascending: true })
  // Team leaders may only assign their own team's agents to a sheet
  if (role === 'team_leader') agentsQuery = agentsQuery.eq('team_name', fullName!)

  const [{ data: agents, error: agentsErr }, { data: assigned, error: assignedErr }] = await Promise.all([
    agentsQuery,
    adminClient
      .from('whatsapp_sheet_agents')
      .select('agent_id')
      .eq('sheet_id', id),
  ])

  if (agentsErr) return NextResponse.json({ error: agentsErr.message }, { status: 500 })
  if (assignedErr) return NextResponse.json({ error: assignedErr.message }, { status: 500 })

  const assignedSet = new Set((assigned ?? []).map(r => r.agent_id as string))

  const result = (agents ?? []).map(a => ({
    id: a.id,
    full_name: a.full_name,
    team_name: a.team_name ?? null,
    whatsapp_active: a.whatsapp_active ?? true,
    assigned: assignedSet.has(a.id),
  }))

  return NextResponse.json({ agents: result })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, companyId, role, fullName } = await requireAdminOrTeamLeader()
  if (error) return NextResponse.json({ error }, { status })

  const { id } = await params
  const adminClient = createAdminClient()

  // Verify sheet belongs to this company
  const { data: sheet, error: sheetErr } = await adminClient
    .from('whatsapp_sheets')
    .select('id, company_id')
    .eq('id', id)
    .eq('company_id', companyId!)
    .single()

  if (sheetErr || !sheet) return NextResponse.json({ error: 'Sheet not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const { agent_ids } = body as { agent_ids?: string[] }
  if (!Array.isArray(agent_ids)) return NextResponse.json({ error: 'agent_ids must be an array' }, { status: 400 })

  // Compute diff against current assignments
  const { data: current } = await adminClient
    .from('whatsapp_sheet_agents')
    .select('agent_id')
    .eq('sheet_id', id)

  const currentIds = (current ?? []).map(r => r.agent_id as string)

  let submittedIds = agent_ids
  let removableIds = currentIds

  if (role === 'team_leader') {
    // A team leader may only touch their own team's assignments on this sheet —
    // other teams' assigned agents must be left untouched.
    const { data: teamAgents } = await adminClient
      .from('profiles')
      .select('id')
      .eq('company_id', companyId!)
      .eq('role', 'agent')
      .eq('team_name', fullName!)
    const teamIds = new Set((teamAgents ?? []).map(a => a.id as string))
    submittedIds = agent_ids.filter(aid => teamIds.has(aid))
    removableIds = currentIds.filter(aid => teamIds.has(aid))
  }

  const newSet = new Set(submittedIds)
  const currentSet = new Set(currentIds)

  const toAdd = submittedIds.filter(aid => !currentSet.has(aid))
  const toRemove = removableIds.filter(aid => !newSet.has(aid))

  await Promise.all([
    toAdd.length > 0
      ? adminClient.from('whatsapp_sheet_agents').upsert(
          toAdd.map(agent_id => ({ sheet_id: id, agent_id, company_id: sheet.company_id })),
          { onConflict: 'sheet_id,agent_id', ignoreDuplicates: true }
        )
      : Promise.resolve(),
    toRemove.length > 0
      ? adminClient
          .from('whatsapp_sheet_agents')
          .delete()
          .eq('sheet_id', id)
          .in('agent_id', toRemove)
      : Promise.resolve(),
  ])

  return NextResponse.json({ success: true, assigned: submittedIds.length })
}
