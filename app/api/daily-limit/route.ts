import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const role = profile.role
  const admin = createAdminClient()

  const now = new Date()
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const tomorrowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))

  if (role === 'trainee') {
    const { data: rows } = await admin
      .from('practice_sessions')
      .select('scenario_id')
      .eq('user_id', user.id)
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', tomorrowStart.toISOString())

    const usage: Record<string, number> = {}
    for (const row of rows ?? []) {
      usage[row.scenario_id] = (usage[row.scenario_id] ?? 0) + 1
    }

    return NextResponse.json({ role: 'trainee', limit: 3, usage })
  }

  if (role === 'exam') {
    if (user.email === 'exam@test.com') {
      return NextResponse.json({ role: 'exam', unlimited: true })
    }

    const { count } = await admin
      .from('exam_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', tomorrowStart.toISOString())

    return NextResponse.json({ role: 'exam', limit: 1, usedToday: count ?? 0 })
  }

  if (role === 'agent') {
    const [practiceRes, examRes] = await Promise.all([
      admin
        .from('practice_sessions')
        .select('scenario_id')
        .eq('user_id', user.id)
        .gte('created_at', todayStart.toISOString())
        .lt('created_at', tomorrowStart.toISOString()),
      admin
        .from('exam_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', todayStart.toISOString())
        .lt('created_at', tomorrowStart.toISOString()),
    ])

    const usage: Record<string, number> = {}
    for (const row of practiceRes.data ?? []) {
      usage[row.scenario_id] = (usage[row.scenario_id] ?? 0) + 1
    }
    return NextResponse.json({ role: 'agent', limit: 3, usage, usedExamToday: examRes.count ?? 0 })
  }

  return NextResponse.json({ role, unlimited: true })
}
