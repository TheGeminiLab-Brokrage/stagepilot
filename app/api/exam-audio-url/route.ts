import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const recordingId = request.nextUrl.searchParams.get('recordingId')
  if (!recordingId) {
    return NextResponse.json({ error: 'Missing recordingId' }, { status: 400 })
  }

  const { data: recording } = await supabase
    .from('exam_recordings')
    .select('audio_path')
    .eq('id', recordingId)
    .single()

  if (!recording?.audio_path) {
    return NextResponse.json({ error: 'Recording not found or access denied' }, { status: 404 })
  }

  const admin = createAdminClient()
  const { data: signedData, error: signedError } = await admin.storage
    .from('exam-recordings')
    .createSignedUrl(recording.audio_path, 3600)

  if (signedError || !signedData?.signedUrl) {
    return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 })
  }

  return NextResponse.json({ signedUrl: signedData.signedUrl })
}
