import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  // 1. Verify caller is super_admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!adminProfile || adminProfile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { fullName, email, password, role, teamName } = await request.json()

  if (!fullName || !email || !password || !role) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!['agent', 'team_leader', 'super_admin', 'trainee'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // 2. Create the auth user (email already confirmed — no invite email needed)
  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError || !newUser.user) {
    return NextResponse.json({ error: createError?.message ?? 'Failed to create user' }, { status: 500 })
  }

  // 3. Insert the profile row into the same company
  // Team leaders use their own full_name as the team identifier (agents set team_name = leader's full_name)
  const resolvedTeamName = role === 'team_leader' ? fullName : (teamName || null)

  const { error: profileError } = await adminClient
    .from('profiles')
    .insert({
      id: newUser.user.id,
      company_id: adminProfile.company_id,
      full_name: fullName,
      role,
      team_name: resolvedTeamName,
    })

  if (profileError) {
    // Roll back the auth user if profile insert fails
    await adminClient.auth.admin.deleteUser(newUser.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, userId: newUser.user.id })
}
