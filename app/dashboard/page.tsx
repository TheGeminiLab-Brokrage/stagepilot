import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StatsCards from './StatsCards'
import DashboardClient from './DashboardClient'
import DashboardPageHeader from './DashboardPageHeader'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, team_name, full_name')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'agent'
  const isLeader = role === 'team_leader' || role === 'super_admin'

  // Trainees only access /dashboard/practice
  if (role === 'trainee') redirect('/dashboard/practice')

  // Fetch calls — RLS enforces scope automatically
  const { data: rawCalls, count: totalCalls } = await supabase
    .from('call_records')
    .select(`
      id, file_name, client_name, client_phone, campaign,
      stage, stage_corrected, agent_stage, reasoning, transcript_summary,
      pain_points, triple_c, agent_feedback, audio_url,
      status, error_message, uploaded_at, agent_id, team_name
    `, { count: 'exact' })
    .order('uploaded_at', { ascending: false })
    .limit(200)

  // Fetch agent names separately — avoids relying on FK join
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentIds = [...new Set((rawCalls ?? []).map((c: any) => c.agent_id as string))]
  const { data: profileRows } = agentIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', agentIds)
    : { data: [] }

  const profileMap: Record<string, string> = {}
  for (const p of profileRows ?? []) profileMap[p.id] = p.full_name

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calls = (rawCalls ?? []).map((c: any) => ({
    ...c,
    agent_full_name: profileMap[c.agent_id] ?? null,
  }))

  const total = totalCalls ?? calls.length

  return (
    <div>
      <DashboardPageHeader isLeader={isLeader} role={role} teamName={profile?.team_name} />
      <StatsCards calls={calls} />
      {total > calls.length && (
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '4px 0 8px' }}>
          Showing the {calls.length} most recent calls of {total} total — stats above reflect only these.
        </p>
      )}
      <DashboardClient calls={calls} isLeader={isLeader} currentUserId={user.id} />
    </div>
  )
}
