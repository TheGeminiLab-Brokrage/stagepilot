import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPhase2Questions, selectPhase2 } from '@/lib/exam-data'

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

  const all = getPhase2Questions()
  const selected = selectPhase2(all)

  const safe = selected.map(({ id, subtype, scenario, choices }) => ({
    id, subtype, scenario, choices,
  }))

  return NextResponse.json(safe)
}
