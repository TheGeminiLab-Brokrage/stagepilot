import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import CreateUserForm from './CreateUserForm'
import UserTable from './UserTable'
import PracticeSessionsTable from './PracticeSessionsTable'
import ExamResultsTable from './ExamResultsTable'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') redirect('/dashboard')

  const adminClient = createAdminClient()
  const { data: profiles } = await adminClient
    .from('profiles')
    .select('id, full_name, role, team_name, created_at')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: true })

  const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers()
  const emailMap = Object.fromEntries((authUsers ?? []).map(u => [u.id, u.email ?? '']))

  // Fetch exam results with user names
  const { data: rawExamResults } = await adminClient
    .from('exam_results')
    .select(`id, phase1_score, phase1_max, phase2_score, phase2_max, phase3_completed, created_at, profiles!user_id(full_name)`)
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })
    .limit(100)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const examResults = (rawExamResults ?? []).map((r: any) => ({
    ...r,
    user_name: (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles)?.full_name ?? 'Unknown',
  }))

  // Fetch practice sessions with trainee names
  const { data: rawSessions } = await adminClient
    .from('practice_sessions')
    .select(`id, scenario_id, audio_path, duration_seconds, created_at, profiles!user_id(full_name)`)
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })
    .limit(100)

  // Flatten the profiles object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const practiceSessions = (rawSessions ?? []).map((s: any) => ({
    ...s,
    profiles: Array.isArray(s.profiles) ? s.profiles[0] : s.profiles,
  }))

  return (
    <div className="max-w-4xl overflow-y-auto h-full pb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{profiles?.length ?? 0} users in your company</p>
        </div>
      </div>

      {/* User list */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-8">
        <UserTable
          initialProfiles={profiles ?? []}
          emailMap={emailMap}
          currentUserId={user.id}
        />
      </div>

      {/* Create user form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-5 mb-8">
        <h2 className="text-white font-medium mb-4">Add New User</h2>
        <CreateUserForm
          teamLeaders={(profiles ?? [])
            .filter(p => p.role === 'team_leader')
            .map(p => p.full_name)}
        />
      </div>

      {/* Exam Results */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-white">Exam Results</h1>
            <p className="text-sm text-gray-500 mt-0.5">{examResults.length} exams completed</p>
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <ExamResultsTable results={examResults} />
        </div>
      </div>

      {/* Practice Sessions */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-white">Practice Sessions</h1>
            <p className="text-sm text-gray-500 mt-0.5">{practiceSessions?.length ?? 0} sessions recorded</p>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <PracticeSessionsTable sessions={practiceSessions ?? []} />
        </div>
      </div>
    </div>
  )
}
