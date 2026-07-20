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

// Per-agent campaign health: sending pace and answer rate. A very low answer
// rate is both a wasted-effort signal and the behavior pattern WhatsApp's
// anti-spam systems ban numbers for — surfacing it early protects the numbers.
export async function GET() {
  const { error, status, companyId, role, fullName } = await requireAdminOrTeamLeader()
  if (error) return NextResponse.json({ error }, { status })

  const adminClient = createAdminClient()

  let agentsQuery = adminClient
    .from('profiles')
    .select('id, full_name, team_name')
    .eq('company_id', companyId!)
    .eq('role', 'agent')
    .order('full_name')
  if (role === 'team_leader') agentsQuery = agentsQuery.eq('team_name', fullName!)

  const { data: agents, error: agentsErr } = await agentsQuery
  if (agentsErr) return NextResponse.json({ error: agentsErr.message }, { status: 500 })

  const now = new Date()
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const stats = await Promise.all(
    (agents ?? []).map(async a => {
      const [today, week, weekAnswered] = await Promise.all([
        adminClient.from('whatsapp_assignments').select('id', { count: 'exact', head: true })
          .eq('agent_id', a.id).gte('sent_at', todayStart),
        adminClient.from('whatsapp_assignments').select('id', { count: 'exact', head: true })
          .eq('agent_id', a.id).gte('sent_at', weekAgo),
        adminClient.from('whatsapp_assignments').select('id', { count: 'exact', head: true })
          .eq('agent_id', a.id).gte('sent_at', weekAgo).eq('response_status', 'answered'),
      ])
      const sentWeek = week.count ?? 0
      return {
        id: a.id,
        full_name: a.full_name,
        team_name: a.team_name,
        sent_today: today.count ?? 0,
        sent_week: sentWeek,
        answered_week: weekAnswered.count ?? 0,
        answer_rate_week: sentWeek > 0 ? Math.round(((weekAnswered.count ?? 0) / sentWeek) * 100) : null,
      }
    })
  )

  return NextResponse.json({ stats })
}
