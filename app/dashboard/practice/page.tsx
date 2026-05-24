import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SCENARIOS } from '@/lib/gemini-scenarios'
import PracticePageWrapper from './PracticePageWrapper'

export const dynamic = 'force-dynamic'

export default async function PracticePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const admin = createAdminClient()

  // Use admin client for profile lookup to bypass any RLS issues
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/auth/login')
  }

  // Step 1: fast path — direct user_id match
  const { data: sessionsWithStage, error: stageColError } = await admin
    .from('practice_sessions')
    .select('id, scenario_id, audio_path, duration_seconds, created_at, call_grade, whatsapp_messages, client_stage')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  let rawSessions = stageColError
    ? (await admin
        .from('practice_sessions')
        .select('id, scenario_id, audio_path, duration_seconds, created_at, call_grade, whatsapp_messages')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)).data
    : sessionsWithStage

  // Step 2: UUID-drift fallback — find all profile IDs with the same full_name
  // in this company, then fetch sessions for any of those IDs
  if ((!rawSessions || rawSessions.length === 0) && profile?.company_id && profile?.full_name) {
    const { data: matchingProfiles } = await admin
      .from('profiles')
      .select('id')
      .eq('company_id', profile.company_id)
      .eq('full_name', profile.full_name)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candidateIds = [...new Set([user.id, ...(matchingProfiles ?? []).map((p: any) => p.id as string)])]

    const { data: fallbackSessions } = await admin
      .from('practice_sessions')
      .select('id, scenario_id, audio_path, duration_seconds, created_at, call_grade, whatsapp_messages, client_stage')
      .in('user_id', candidateIds)
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })
      .limit(50)

    rawSessions = fallbackSessions ?? []
  }

  const scenarioLabels = Object.fromEntries(SCENARIOS.map(s => [s.id, s.label]))

  return (
    <PracticePageWrapper
      userId={user.id}
      companyId={profile.company_id}
      userName={profile.full_name}
      role={profile.role}
      userEmail={user.email ?? ''}
      initialSessions={rawSessions ?? []}
      scenarioLabels={scenarioLabels}
    />
  )
}
