import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId, clientStage } = await request.json().catch(() => ({}))

  if (!sessionId || !clientStage) {
    return NextResponse.json({ error: 'Missing sessionId or clientStage' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: session } = await admin
    .from('practice_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const { error } = await admin
    .from('practice_sessions')
    .update({ client_stage: clientStage })
    .eq('id', sessionId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
