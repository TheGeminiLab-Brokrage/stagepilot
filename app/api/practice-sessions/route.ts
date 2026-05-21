import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  const admin = createAdminClient()

  // Try with client_stage first; fall back without it if column missing
  const { data: withStage, error: stageErr } = await admin
    .from('practice_sessions')
    .select('id, scenario_id, audio_path, duration_seconds, created_at, call_grade, whatsapp_messages, client_stage')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!stageErr) {
    // Primary path succeeded
    if ((withStage ?? []).length > 0) {
      return NextResponse.json({ sessions: withStage })
    }

    // Primary returned 0 — try company-wide query as fallback to catch UUID drift
    if (profile?.company_id) {
      const { data: company } = await admin
        .from('practice_sessions')
        .select('id, scenario_id, audio_path, duration_seconds, created_at, call_grade, whatsapp_messages, client_stage, user_id')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(200)
      const mine = (company ?? []).filter(s => s.user_id === user.id)
      console.error(`[practice-sessions] user_id=${user.id} direct=0 company=${(company ?? []).length} mine=${mine.length}`)
      return NextResponse.json({ sessions: mine })
    }

    return NextResponse.json({ sessions: [] })
  }

  // client_stage column missing — retry without it
  const { data: noStage, error: err2 } = await admin
    .from('practice_sessions')
    .select('id, scenario_id, audio_path, duration_seconds, created_at, call_grade, whatsapp_messages')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (err2) return NextResponse.json({ error: err2.message }, { status: 500 })
  return NextResponse.json({ sessions: noStage ?? [] })
}
