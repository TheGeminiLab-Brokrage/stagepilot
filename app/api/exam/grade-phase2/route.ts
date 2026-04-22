import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPhase2Questions } from '@/lib/exam-data'

interface SubmittedAnswer {
  id: string
  response: string
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'exam') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { answers }: { answers: SubmittedAnswer[] } = await req.json()
  const bank = getPhase2Questions()
  const bankMap = new Map(bank.map(q => [q.id, q]))

  const POINTS_PER_Q = 2
  let totalScore = 0
  const maxScore = answers.length * POINTS_PER_Q

  const results = answers.map(({ id, response }) => {
    const q = bankMap.get(id)
    if (!q) return { id, correct: false, pointsEarned: 0, correctAnswer: '', reasoning: '' }

    const correct = response.trim() === q.answer.trim()
    const pointsEarned = correct ? POINTS_PER_Q : 0
    totalScore += pointsEarned

    return { id, correct, pointsEarned, correctAnswer: q.answer, reasoning: q.reasoning, maxPoints: POINTS_PER_Q }
  })

  return NextResponse.json({ results, totalScore, maxScore })
}
