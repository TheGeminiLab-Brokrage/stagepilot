// ─── SERVER-ONLY ──────────────────────────────────────────────────────────────
// Never imported by client components. Used only in /api/exam/* routes.

import OpenAI from 'openai'
import phase1Raw from '../data/phase1-questions.json'
import phase2Raw from '../data/phase2-questions.json'

export type Phase1Type = 'mcq' | 'truefalse' | 'essay'

export interface Phase1Question {
  id: string
  type: Phase1Type
  question: string
  choices?: string[]
  answer: string
  points: number
}

export interface Phase2Question {
  id: string
  subtype: 'narrative' | 'budget'
  scenario: string
  choices: { label: string; text: string }[]
  answer: string
  reasoning: string
}

export function getPhase1Questions(): Phase1Question[] {
  return phase1Raw as Phase1Question[]
}

export function getPhase2Questions(): Phase2Question[] {
  return phase2Raw as Phase2Question[]
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function selectPhase1(all: Phase1Question[]): Phase1Question[] {
  const mcq = shuffle(all.filter(q => q.type === 'mcq'))
  const tf = shuffle(all.filter(q => q.type === 'truefalse'))
  const essay = shuffle(all.filter(q => q.type === 'essay'))
  const selected = [...mcq.slice(0, 2), ...tf.slice(0, 2), ...essay.slice(0, 2)]
  const remaining = shuffle([...mcq.slice(2), ...tf.slice(2), ...essay.slice(2)])
  return shuffle([...selected, ...remaining.slice(0, 4)])
}

export function selectPhase2(all: Phase2Question[]): Phase2Question[] {
  const narrative = shuffle(all.filter(q => q.subtype === 'narrative'))
  const budget = shuffle(all.filter(q => q.subtype === 'budget'))
  return shuffle([...narrative.slice(0, 5), ...budget.slice(0, 5)])
}

export async function gradeEssay(
  userAnswer: string,
  correctAnswer: string,
  points: number,
  question?: string
): Promise<number> {
  if (!userAnswer.trim()) return 0

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const prompt = `You are grading a free-text exam answer for a real estate sales training exam.

${question ? `Question: ${question}\n` : ''}Model Answer: ${correctAnswer}
Student's Answer: ${userAnswer}
Maximum Points: ${points}

Grade the student's answer based on conceptual accuracy and understanding. Exact wording does not matter — only whether the core idea is correct and sufficiently complete. Be fair but rigorous.

Respond with valid JSON only, no other text: {"score": <integer from 0 to ${points}>}`

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 50,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    })

    const text = completion.choices[0].message.content?.trim() ?? ''
    const parsed = JSON.parse(text)
    return Math.min(Math.max(0, Math.round(parsed.score)), points)
  } catch {
    // Fallback to keyword matching if AI call fails
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
    const keyWords = normalize(correctAnswer).split(' ').filter(w => w.length > 2)
    if (keyWords.length === 0) return points
    const userNorm = normalize(userAnswer)
    const matched = keyWords.filter(w => userNorm.includes(w)).length
    const ratio = matched / keyWords.length
    if (ratio >= 0.8) return points
    if (ratio >= 0.5) return Math.floor(points * 0.6)
    return 0
  }
}
