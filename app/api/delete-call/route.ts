import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { callId } = await request.json()
  if (!callId) return NextResponse.json({ error: 'Missing callId' }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

  const admin = createAdminClient()

  // Verify the call belongs to this user/team before deleting
  const { data: call } = await admin
    .from('call_records')
    .select('agent_id, company_id')
    .eq('id', callId)
    .single()
  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAgent = profile.role === 'agent'
  if (isAgent && call.agent_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!isAgent && call.company_id !== profile.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await admin.from('call_records').delete().eq('id', callId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
