import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Use admin client for profile lookup to bypass any RLS issues
  const { data: profile } = await admin
    .from('profiles')
    .select('company_id, role, full_name')
    .eq('id', user.id)
    .single()

  // Step 1: fast path — direct user_id match
  const { data: direct, error: directErr } = await admin
    .from('practice_sessions')
    .select('id, scenario_id, audio_path, duration_seconds, created_at, call_grade, whatsapp_messages, client_stage')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!directErr && (direct ?? []).length > 0) {
    return NextResponse.json({ sessions: direct })
  }

  // Step 2: UUID-drift fallback — find all profile IDs with the same full_name
  // in this company, then fetch sessions for any of those IDs
  if (profile?.company_id && profile?.full_name) {
    const { data: matchingProfiles } = await admin
      .from('profiles')
      .select('id')
      .eq('company_id', profile.company_id)
      .eq('full_name', profile.full_name)

    const candidateIds = [...new Set([user.id, ...(matchingProfiles ?? []).map((p: { id: string }) => p.id)])]

    const { data: sessions, error: sessErr } = await admin
      .from('practice_sessions')
      .select('id, scenario_id, audio_path, duration_seconds, created_at, call_grade, whatsapp_messages, client_stage')
      .in('user_id', candidateIds)
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })
      .limit(50)

    console.error(`[practice-sessions] user_id=${user.id} direct=0 candidates=${candidateIds.length} found=${(sessions ?? []).length}`)

    if (!sessErr) {
      return NextResponse.json({ sessions: sessions ?? [] })
    }
  }

  return NextResponse.json({ sessions: [] })
}
