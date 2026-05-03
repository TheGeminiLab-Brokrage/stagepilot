import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'exam') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Test account is exempt from daily limits
  if (user.email === 'exam@test.com') {
    return NextResponse.json({ allowed: true, isTestAccount: true })
  }

  const admin = createAdminClient()

  const now = new Date()
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const tomorrowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))

  const { count } = await admin
    .from('exam_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', todayStart.toISOString())
    .lt('created_at', tomorrowStart.toISOString())

  if ((count ?? 0) >= 1) {
    return NextResponse.json({ allowed: false })
  }

  const { error } = await admin
    .from('exam_attempts')
    .insert({ user_id: user.id, company_id: profile.company_id })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ allowed: true })
}
