// ─── SERVER-ONLY ──────────────────────────────────────────────────────────────
// Never imported by client components. Used only in /api/exam/* routes.

import * as XLSX from 'xlsx'
import path from 'path'
import { randomUUID } from 'crypto'

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

function parsePhase1(): Phase1Question[] {
  const filePath = path.join(process.cwd(), 'data', 'phase1-questions.xlsx')
  const wb = XLSX.readFile(filePath)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][]

  const questions: Phase1Question[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row[0] || !row[1]) continue

    const typeRaw = String(row[0]).trim()
    const question = String(row[1]).trim()
    const choicesRaw = row[2] ? String(row[2]).trim() : ''
    const answer = row[3] ? String(row[3]).trim() : ''
    const points = row[4] ? Number(row[4]) : 0

    let type: Phase1Type
    let choices: string[] | undefined

    if (typeRaw === 'اختيار من متعدد') {
      type = 'mcq'
      // choices are newline-separated "أ) ...\nب) ...\nج) ...\nد) ..."
      choices = choicesRaw
        .split('\n')
        .map(c => c.trim())
        .filter(c => c.length > 0)
    } else if (typeRaw === 'صح أو غلط') {
      type = 'truefalse'
      choices = ['صح', 'غلط']
    } else if (typeRaw === 'سؤال مقالي') {
      type = 'essay'
    } else {
      continue
    }

    questions.push({ id: randomUUID(), type, question, choices, answer, points })
  }

  return questions
}

function parsePhase2(): Phase2Question[] {
  const filePath = path.join(process.cwd(), 'data', 'phase2-questions.xlsx')
  const wb = XLSX.readFile(filePath)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][]

  const questions: Phase2Question[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row[0]) continue

    const scenario = String(row[0]).trim()
    const choicesRaw = row[1] ? String(row[1]).trim() : ''
    const answer = row[2] ? String(row[2]).trim() : ''
    const reasoning = row[3] ? String(row[3]).trim() : ''

    if (!scenario || !choicesRaw || !answer) continue

    // Choices: "أ) Ozone (Catalyst)\nب) N Square\nج) Twins Mall"
    const choiceLines = choicesRaw
      .split('\n')
      .map(c => c.trim())
      .filter(c => c.length > 0)

    const choices = choiceLines.map(line => {
      const match = line.match(/^([أبج])\)\s*(.+)$/)
      if (match) return { label: match[1], text: match[2].trim() }
      return { label: '', text: line }
    }).filter(c => c.label)

    // Extract just the label letter from answer like "أ) Ozone (Catalyst)"
    const answerMatch = answer.match(/^([أبج])/)
    const answerLabel = answerMatch ? answerMatch[1] : answer

    // Determine subtype: budget questions start with "عندنا د."
    const subtype: 'narrative' | 'budget' = scenario.startsWith('عندنا د.') ? 'budget' : 'narrative'

    questions.push({ id: randomUUID(), subtype, scenario, choices, answer: answerLabel, reasoning })
  }

  return questions
}

// Parse once at module load (server startup)
let _phase1: Phase1Question[] | null = null
let _phase2: Phase2Question[] | null = null

export function getPhase1Questions(): Phase1Question[] {
  if (!_phase1) _phase1 = parsePhase1()
  return _phase1
}

export function getPhase2Questions(): Phase2Question[] {
  if (!_phase2) _phase2 = parsePhase2()
  return _phase2
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
