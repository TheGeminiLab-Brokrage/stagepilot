import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAssessmentAccess, MANAGER_ROLES } from '@/lib/assessment/require-access'

const NEON = '#D7FF00'
const CARD = 'rgba(255,255,255,0.03)'
const BORDER = 'rgba(255,255,255,0.08)'
const MUTED = 'rgba(255,255,255,0.4)'

// One row per agent: training + activity signals side by side, so a leader
// answers "who needs development, on what" from a single screen.
export default async function AgentDevelopmentOverviewPage() {
  const profile = await requireAssessmentAccess(MANAGER_ROLES)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase
    .from('profiles')
    .select('company_id, full_name, role')
    .eq('id', user!.id)
    .single()

  const admin = createAdminClient()

  let agentsQuery = admin
    .from('profiles')
    .select('id, full_name, team_name')
    .eq('company_id', me!.company_id)
    .eq('role', 'agent')
    .order('full_name')
  if (me!.role === 'team_leader') agentsQuery = agentsQuery.eq('team_name', me!.full_name)

  const { data: agents } = await agentsQuery

  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const rows = await Promise.all(
    (agents ?? []).map(async a => {
      const [examRes, practiceCount, callsCount, assessDone] = await Promise.all([
        admin.from('exam_results')
          .select('phase1_score, phase1_max, phase2_score, phase2_max, created_at')
          .eq('user_id', a.id)
          .order('created_at', { ascending: false })
          .limit(1),
        admin.from('practice_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', a.id)
          .gte('created_at', monthAgo),
        admin.from('call_records')
          .select('id', { count: 'exact', head: true })
          .eq('agent_id', a.id)
          .gte('uploaded_at', monthAgo),
        admin.from('assessment_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', a.id)
          .not('completed_at', 'is', null),
      ])

      const exam = examRes.data?.[0]
      const pct = (score: number | null, max: number | null) =>
        score != null && max != null && max > 0 ? Math.round((Number(score) / Number(max)) * 100) : null

      return {
        id: a.id,
        name: a.full_name,
        team: a.team_name,
        examP1: pct(exam?.phase1_score ?? null, exam?.phase1_max ?? null),
        examP2: pct(exam?.phase2_score ?? null, exam?.phase2_max ?? null),
        practice30d: practiceCount.count ?? 0,
        calls30d: callsCount.count ?? 0,
        assessmentsDone: assessDone.count ?? 0,
      }
    })
  )

  const scoreColor = (v: number | null) =>
    v === null ? MUTED : v >= 70 ? NEON : v >= 50 ? '#ffb020' : '#ff8080'

  return (
    <div style={{ fontFamily: "'Montserrat', sans-serif" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
          Agent <span style={{ color: NEON }}>Development</span>
        </h1>
        <p style={{ color: MUTED, fontSize: 13, marginTop: 6 }}>
          {profile.role === 'super_admin' ? 'All agents' : 'Your team'} — latest exam scores, training activity, and call volume (last 30 days). Red scores need attention.
        </p>
      </div>

      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {['Agent', 'Team', 'Exam Phase 1', 'Exam Phase 2', 'Practice (30d)', 'Calls (30d)', 'Assessments', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', color: MUTED, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: '12px 16px', color: '#fff', whiteSpace: 'nowrap' }}>{r.name}</td>
                  <td style={{ padding: '12px 16px', color: MUTED, whiteSpace: 'nowrap' }}>{r.team ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: scoreColor(r.examP1) }}>{r.examP1 === null ? 'Not taken' : `${r.examP1}%`}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: scoreColor(r.examP2) }}>{r.examP2 === null ? 'Not taken' : `${r.examP2}%`}</td>
                  <td style={{ padding: '12px 16px', color: r.practice30d === 0 ? '#ff8080' : '#fff' }}>{r.practice30d}</td>
                  <td style={{ padding: '12px 16px', color: r.calls30d === 0 ? '#ff8080' : '#fff' }}>{r.calls30d}</td>
                  <td style={{ padding: '12px 16px', color: '#fff' }}>{r.assessmentsDone}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <Link href={`/dashboard/assessment/manager/agent/${r.id}`} style={{ color: NEON, fontSize: 12, textDecoration: 'none' }}>
                      Details →
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: MUTED }}>No agents found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
