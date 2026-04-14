import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  // 1. Authenticate
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Get sessionId from query params
  const sessionId = request.nextUrl.searchParams.get('sessionId')
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
  }

  // 3. Fetch the practice session — RLS scopes based on user role
  const { data: session } = await supabase
    .from('practice_sessions')
    .select('audio_path')
    .eq('id', sessionId)
    .single()

  if (!session?.audio_path) {
    return NextResponse.json({ error: 'Session not found or access denied' }, { status: 404 })
  }

  // 4. Generate signed URL via admin client (service role can access private storage)
  const admin = createAdminClient()
  const { data: signedData, error: signedError } = await admin.storage
    .from('practice-recordings')
    .createSignedUrl(session.audio_path, 3600) // 1 hour expiry

  if (signedError || !signedData?.signedUrl) {
    return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 })
  }

  return NextResponse.json({ signedUrl: signedData.signedUrl })
}
