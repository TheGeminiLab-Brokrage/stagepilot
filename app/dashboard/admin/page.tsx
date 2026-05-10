import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminUsersClient from './AdminUsersClient'
import PracticeSessionsTable from './PracticeSessionsTable'
import ExamResultsTable from './ExamResultsTable'
import ExamRecordingsTable from './ExamRecordingsTable'
import AdminSectionTitle from './AdminSectionTitle'

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
    .select(`id, phase1_score, phase1_max, phase2_score, phase2_max, phase3_completed, phase1_details, phase2_details, created_at, report_downloaded_at, profiles!user_id(full_name)`)
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })
    .limit(100)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const examResults = (rawExamResults ?? []).map((r: any) => ({
    ...r,
    user_name: (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles)?.full_name ?? 'Unknown',
  }))

  // Fetch admin exam recordings
  const { data: rawExamRecordings } = await adminClient
    .from('exam_recordings')
    .select(`id, audio_path, duration_seconds, created_at, profiles!user_id(full_name)`)
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })
    .limit(100)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const examRecordings = (rawExamRecordings ?? []).map((r: any) => ({
    ...r,
    profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles,
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
    <div className="max-w-4xl pb-8">
      <div className="flex items-center justify-between mb-6">
        <AdminSectionTitle
          titleKey="adminHeading"
          count={profiles?.length ?? 0}
          subtitleKey="adminUsersInCompany"
        />
      </div>

      <AdminUsersClient
        initialProfiles={profiles ?? []}
        initialEmailMap={emailMap}
        currentUserId={user.id}
      />

      {/* Exam Results */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <AdminSectionTitle
            titleKey="adminExamResultsTitle"
            count={examResults.length}
            subtitleKey="adminExamsCompleted"
          />
        </div>
        <div style={{ borderRadius: 12, background: 'rgba(215,255,0,0.03)', border: '1px solid rgba(215,255,0,0.12)', overflow: 'hidden' }}>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            <ExamResultsTable results={examResults} />
          </div>
        </div>
      </div>

      {/* AI Test Exam Recordings */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <AdminSectionTitle
            titleKey="adminExamRecordingsTitle"
            count={examRecordings.length}
            subtitleKey="adminRecordingsCount"
            subtitleColor="rgba(215,255,0,0.5)"
          />
        </div>
        <div style={{ borderRadius: 12, background: 'rgba(215,255,0,0.03)', border: '1px solid rgba(215,255,0,0.12)', overflow: 'hidden' }}>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            <ExamRecordingsTable recordings={examRecordings} />
          </div>
        </div>
      </div>

      {/* Practice Sessions */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <AdminSectionTitle
            titleKey="adminPracticeSessionsTitle"
            count={practiceSessions?.length ?? 0}
            subtitleKey="adminSessionsRecorded"
          />
        </div>

        <div style={{ borderRadius: 12, background: 'rgba(215,255,0,0.03)', border: '1px solid rgba(215,255,0,0.12)', overflow: 'hidden' }}>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            <PracticeSessionsTable sessions={practiceSessions ?? []} />
          </div>
        </div>
      </div>
    </div>
  )
}
