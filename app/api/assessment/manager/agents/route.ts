import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireManagerOrAdmin } from '@/lib/assessment/server-auth'

export async function GET() {
  const { error, status, caller } = await requireManagerOrAdmin()
  if (!caller) return NextResponse.json({ error }, { status })

  const admin = createAdminClient()

  let agentsQuery = admin
    .from('profiles')
    .select('id, full_name')
    .eq('company_id', caller.company_id)
    .eq('role', 'agent')

  if (caller.role === 'team_leader') {
    agentsQuery = agentsQuery.eq('team_name', caller.team_name)
  }

  const { data: agents, error: pe } = await agentsQuery.order('full_name')
  if (pe) return NextResponse.json({ error: pe.message }, { status: 500 })
  if (!agents?.length) return NextResponse.json([])

  const agentIds = agents.map(a => a.id)
  const { data: sessions, error: se } = await admin
    .from('assessment_sessions')
    .select('*')
    .in('user_id', agentIds)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
  if (se) return NextResponse.json({ error: se.message }, { status: 500 })

  const sessionIds = (sessions ?? []).map(s => s.id)
  const { data: answers, error: ae } = sessionIds.length
    ? await admin.from('assessment_answers').select('*').in('session_id', sessionIds)
    : { data: [], error: null }
  if (ae) return NextResponse.json({ error: ae.message }, { status: 500 })

  const result = agents.map(agent => {
    const agentSessions = (sessions ?? []).filter(s => s.user_id === agent.id)
    return {
      id: agent.id,
      full_name: agent.full_name,
      sessions: agentSessions.map(session => ({
        session: { ...session, full_name: agent.full_name },
        answers: (answers ?? []).filter(a => a.session_id === session.id),
      })),
    }
  })

  return NextResponse.json(result)
}
