import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify user is a team leader or super_admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role === 'agent') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { callId, stage } = await request.json()
  if (!callId) {
    return NextResponse.json({ error: 'Missing callId' }, { status: 400 })
  }
  // stage may be null to clear a correction

  // RLS will ensure team leader can only update their own team's calls
  const { error } = await supabase
    .from('call_records')
    .update({ stage_corrected: stage })
    .eq('id', callId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
