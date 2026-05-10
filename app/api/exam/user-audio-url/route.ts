import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'exam' && profile.role !== 'agent')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const resultId = request.nextUrl.searchParams.get('resultId')
  if (!resultId) return NextResponse.json({ error: 'Missing resultId' }, { status: 400 })

  const admin = createAdminClient()

  // Verify result belongs to this user and get its timestamp
  const { data: result } = await admin
    .from('exam_results')
    .select('created_at')
    .eq('id', resultId)
    .eq('user_id', user.id)
    .single()

  if (!result) return NextResponse.json({ error: 'Result not found' }, { status: 404 })

  // Find recording within 4 hours of the exam result (same session)
  const resultTime = new Date(result.created_at)
  const windowStart = new Date(resultTime.getTime() - 4 * 60 * 60 * 1000).toISOString()
  const windowEnd = new Date(resultTime.getTime() + 4 * 60 * 60 * 1000).toISOString()

  const { data: recording } = await admin
    .from('exam_recordings')
    .select('audio_path')
    .eq('user_id', user.id)
    .gte('created_at', windowStart)
    .lte('created_at', windowEnd)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!recording?.audio_path) {
    return NextResponse.json({ error: 'No recording found for this exam' }, { status: 404 })
  }

  const { data: signedData, error: signedError } = await admin.storage
    .from('exam-recordings')
    .createSignedUrl(recording.audio_path, 3600)

  if (signedError || !signedData?.signedUrl) {
    return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 })
  }

  return NextResponse.json({ signedUrl: signedData.signedUrl })
}
