import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  // 1. Authenticate and check role
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['team_leader', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 2. Get callRecordId from query params
  const callRecordId = request.nextUrl.searchParams.get('callRecordId')
  if (!callRecordId) {
    return NextResponse.json({ error: 'Missing callRecordId' }, { status: 400 })
  }

  // 3. Fetch the call record — RLS scopes to user's company automatically
  const { data: callRecord } = await supabase
    .from('call_records')
    .select('audio_url')
    .eq('id', callRecordId)
    .single()

  if (!callRecord?.audio_url) {
    return NextResponse.json({ error: 'Recording not available' }, { status: 404 })
  }

  // 4. Generate signed URL via admin client (service role can access private storage)
  const admin = createAdminClient()
  const { data: signedData, error: signedError } = await admin.storage
    .from('call-recordings')
    .createSignedUrl(callRecord.audio_url, 3600) // 1 hour expiry

  if (signedError || !signedData?.signedUrl) {
    return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 })
  }

  return NextResponse.json({ signedUrl: signedData.signedUrl })
}
