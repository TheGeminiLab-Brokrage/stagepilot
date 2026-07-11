import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  const fullName = profile?.full_name ?? ''

  const { data: sessions, error: se } = await supabase
    .from('assessment_sessions')
    .select('*')
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
  if (se) return NextResponse.json({ error: se.message }, { status: 500 })
  if (!sessions?.length) return NextResponse.json([])

  const ids = sessions.map(s => s.id)
  const { data: answers, error: ae } = await supabase
    .from('assessment_answers')
    .select('*')
    .in('session_id', ids)
  if (ae) return NextResponse.json({ error: ae.message }, { status: 500 })

  const result = sessions.map(session => ({
    session: { ...session, full_name: fullName },
    answers: (answers ?? []).filter(a => a.session_id === session.id),
  }))
  return NextResponse.json(result)
}
