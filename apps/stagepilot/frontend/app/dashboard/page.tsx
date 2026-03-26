import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StatsCards from './StatsCards'
import DashboardClient from './DashboardClient'

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

  // Fetch calls with joined agent name — RLS enforces scope automatically
  const { data: rawCalls } = await supabase
    .from('call_records')
    .select(`
      id, file_name, client_name, client_phone, campaign,
      stage, stage_corrected, reasoning, transcript_summary,
      pain_points, triple_c, agent_feedback,
      status, error_message, uploaded_at, agent_id, team_name,
      profiles!agent_id (full_name)
    `)
    .order('uploaded_at', { ascending: false })
    .limit(200)

  // Flatten joined profile.full_name into agent_full_name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calls = (rawCalls ?? []).map((c: any) => {
    const { profiles: profileJoin, ...rest } = c
    return { ...rest, agent_full_name: profileJoin?.full_name ?? null }
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">
            {isLeader ? 'Team Calls' : 'My Calls'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isLeader
              ? `Reviewing calls for ${profile?.team_name ?? 'your team'}`
              : 'Your processed call recordings'}
          </p>
        </div>
        {role === 'agent' && (
          <a
            href="/dashboard/upload"
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Upload Call
          </a>
        )}
      </div>

      <StatsCards calls={calls} />
      <DashboardClient calls={calls} isLeader={isLeader} currentUserId={user.id} />
    </div>
  )
}
