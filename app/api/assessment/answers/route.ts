import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId, answers } = await req.json()
  if (!sessionId || !Array.isArray(answers) || answers.length === 0) {
    return NextResponse.json({ error: 'sessionId and answers required' }, { status: 400 })
  }

  // Confirm the session belongs to the caller before inserting — RLS also
  // enforces this, but check explicitly so we can return a clean 403.
  const { data: session } = await supabase
    .from('assessment_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rows = answers.map((a: { phase: string; question_id: string; answer_given: string | null; correct: boolean }) => ({
    session_id: sessionId,
    phase: a.phase,
    question_id: a.question_id,
    answer_given: a.answer_given,
    correct: a.correct,
  }))

  const { error } = await supabase.from('assessment_answers').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
