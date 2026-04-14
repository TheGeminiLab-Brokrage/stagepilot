import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  // 1. Auth check — any logged-in user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // 2. Parse JSON body (blob already uploaded via signed URL)
  const { audioPath, scenarioId, durationSeconds } = await request.json().catch(() => ({}))

  if (!audioPath || !scenarioId) {
    return NextResponse.json({ error: 'Missing required fields: audioPath, scenarioId' }, { status: 400 })
  }

  const durationSec = parseInt(String(durationSeconds) ?? '0', 10)

  // 3. Insert practice_sessions record only (audio already in storage)
  const admin = createAdminClient()
  const { error: insertError } = await admin
    .from('practice_sessions')
    .insert({
      user_id: user.id,
      company_id: profile.company_id,
      scenario_id: scenarioId,
      audio_path: audioPath,
      duration_seconds: isNaN(durationSec) ? null : durationSec,
    })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
