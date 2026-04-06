import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const { companyName, fullName, email, password } = await request.json()

  if (!companyName || !fullName || !email || !password) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // 1. Create the company
  const { data: company, error: companyError } = await adminClient
    .from('companies')
    .insert({ name: companyName })
    .select('id')
    .single()

  if (companyError || !company) {
    return NextResponse.json({ error: 'Failed to create company' }, { status: 500 })
  }

  // 2. Create the auth user
  const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !newUser.user) {
    // Roll back company
    await adminClient.from('companies').delete().eq('id', company.id)
    return NextResponse.json({ error: authError?.message ?? 'Failed to create account' }, { status: 500 })
  }

  // 3. Create the super_admin profile
  const { error: profileError } = await adminClient
    .from('profiles')
    .insert({
      id: newUser.user.id,
      company_id: company.id,
      full_name: fullName,
      role: 'super_admin',
      team_name: null,
    })

  if (profileError) {
    // Roll back both
    await adminClient.auth.admin.deleteUser(newUser.user.id)
    await adminClient.from('companies').delete().eq('id', company.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
