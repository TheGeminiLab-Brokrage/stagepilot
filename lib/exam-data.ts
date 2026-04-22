// ─── SERVER-ONLY ──────────────────────────────────────────────────────────────
// Never imported by client components. Used only in /api/exam/* routes.

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

export function gradeEssay(userAnswer: string, correctAnswer: string, points: number): number {
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
