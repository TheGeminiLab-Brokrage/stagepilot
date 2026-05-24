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

  const admin = createAdminClient()

  // 3. Fetch the session and the user's profile via admin client (bypasses RLS)
  // This allows agents to play sessions saved under a drifted UID (same company)
  const [{ data: session }, { data: userProfile }] = await Promise.all([
    admin.from('practice_sessions').select('audio_path, company_id').eq('id', sessionId).single(),
    admin.from('profiles').select('company_id').eq('id', user.id).single(),
  ])

  if (!session?.audio_path) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // 4. Company-level access check (prevents cross-company access)
  if (session.company_id !== userProfile?.company_id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // 5. Generate signed URL via admin client (service role can access private storage)
  const { data: signedData, error: signedError } = await admin.storage
    .from('practice-recordings')
    .createSignedUrl(session.audio_path, 3600) // 1 hour expiry

  if (signedError || !signedData?.signedUrl) {
    return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 })
  }

  return NextResponse.json({ signedUrl: signedData.signedUrl })
}
