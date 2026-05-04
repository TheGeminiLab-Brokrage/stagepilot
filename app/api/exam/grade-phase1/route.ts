import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPhase1Questions, gradeEssay } from '@/lib/exam-data'

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
  const bank = getPhase1Questions()
  const bankMap = new Map(bank.map(q => [q.id, q]))

  let totalScore = 0
  let maxScore = 0

  function getChoiceText(letter: string, choices: string[] = []): string {
    return choices.find(c => c.charAt(0) === letter) ?? letter
  }

  const results = await Promise.all(answers.map(async ({ id, response }) => {
    const q = bankMap.get(id)
    if (!q) return { id, correct: false, pointsEarned: 0, correctAnswer: '' }

    maxScore += q.points
    let pointsEarned = 0
    let correct = false

    if (q.type === 'essay') {
      pointsEarned = await gradeEssay(response, q.answer, q.points, q.question)
      correct = pointsEarned === q.points
    } else {
      // MCQ and T/F: normalize and compare
      correct = response.trim() === q.answer.trim()
      pointsEarned = correct ? q.points : 0
    }

    totalScore += pointsEarned
    const correctAnswer = q.type === 'mcq' ? getChoiceText(q.answer, q.choices ?? []) : q.answer
    const userAnswer = q.type === 'mcq' ? getChoiceText(response, q.choices ?? []) : response
    return { id, correct, pointsEarned, correctAnswer, maxPoints: q.points, questionText: q.question, userAnswer }
  }))

  return NextResponse.json({ results, totalScore, maxScore })
}
