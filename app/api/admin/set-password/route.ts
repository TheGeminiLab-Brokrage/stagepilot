import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()

  const { data: adminProfile } = await adminClient
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!adminProfile || adminProfile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, password } = await request.json()

  if (!userId || !password) {
    return NextResponse.json({ error: 'Missing userId or password' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  // Verify the target user belongs to the same company
  const { data: targetProfile } = await adminClient
    .from('profiles')
    .select('company_id')
    .eq('id', userId)
    .single()

  if (!targetProfile || targetProfile.company_id !== adminProfile.company_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await adminClient.auth.admin.updateUserById(userId, { password })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
