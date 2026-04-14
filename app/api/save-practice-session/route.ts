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

  // 2. Parse multipart form data
  const form = await request.formData()
  const audioBlob = form.get('audioBlob') as File | null
  const scenarioId = form.get('scenarioId') as string | null
  const durationSeconds = parseInt(form.get('durationSeconds') as string ?? '0', 10)

  if (!audioBlob || !scenarioId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // 3. Upload to Supabase Storage using admin client
  const admin = createAdminClient()
  const audioPath = `${user.id}/${Date.now()}.wav`
  const arrayBuffer = await audioBlob.arrayBuffer()

  const { error: uploadError } = await admin.storage
    .from('practice-recordings')
    .upload(audioPath, arrayBuffer, {
      contentType: audioBlob.type || 'audio/mpeg',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // 4. Insert practice_sessions record
  const { error: insertError } = await admin
    .from('practice_sessions')
    .insert({
      user_id: user.id,
      company_id: profile.company_id,
      scenario_id: scenarioId,
      audio_path: audioPath,
      duration_seconds: isNaN(durationSeconds) ? null : durationSeconds,
    })

  if (insertError) {
    // Best-effort cleanup of orphaned storage file
    await admin.storage.from('practice-recordings').remove([audioPath])
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
