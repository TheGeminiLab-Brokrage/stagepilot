import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPhase1Questions, selectPhase1 } from '@/lib/exam-data'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'exam' && profile.role !== 'agent')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const all = getPhase1Questions()
  const selected = selectPhase1(all)

  // Strip answers before sending to client
  const safe = selected.map(({ id, type, question, choices, points }) => ({
    id, type, question, choices, points,
  }))

  return NextResponse.json(safe)
}
