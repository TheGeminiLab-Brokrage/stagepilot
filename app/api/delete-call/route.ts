import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { callId } = await request.json()
  if (!callId) return NextResponse.json({ error: 'Missing callId' }, { status: 400 })

  // RLS enforces ownership — agents can only delete their own, leaders can delete their team's
  const { error } = await supabase.from('call_records').delete().eq('id', callId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
