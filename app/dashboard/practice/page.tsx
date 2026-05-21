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

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/auth/login')
  }

  const admin = createAdminClient()
  const { data: sessionsWithStage, error: stageColError } = await admin
    .from('practice_sessions')
    .select('id, scenario_id, audio_path, duration_seconds, created_at, call_grade, whatsapp_messages, client_stage')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  // client_stage column may not exist yet — fall back without it if so
  const rawSessions = stageColError
    ? (await admin
        .from('practice_sessions')
        .select('id, scenario_id, audio_path, duration_seconds, created_at, call_grade, whatsapp_messages')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)).data
    : sessionsWithStage

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
