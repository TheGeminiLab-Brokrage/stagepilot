'use client'

import { useState } from 'react'

interface Choice {
  label: string
  text: string
}

interface Question {
  id: string
  subtype: 'narrative' | 'budget'
  scenario: string
  choices: Choice[]
}

interface GradeResult {
  id: string
  correct: boolean
  pointsEarned: number
  correctAnswer: string
  reasoning: string
  maxPoints: number
}

interface Props {
  onComplete: (answers: { id: string; response: string }[], results: GradeResult[], totalScore: number, maxScore: number, questions: Question[]) => void
}

export default function ExamPhase2({ onComplete }: Props) {
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [started, setStarted] = useState(false)

  async function startPhase() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/exam/phase2-questions')
      if (!res.ok) throw new Error('Failed to load')
      const qs = await res.json()
      setQuestions(qs)
      setStarted(true)
    } catch {
      setError('Failed to load questions. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function submitPhase() {
    if (!questions) return
    setSubmitting(true)
    const answersArr = questions.map(q => ({ id: q.id, response: answers[q.id] ?? '' }))
    try {
      const res = await fetch('/api/exam/grade-phase2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersArr }),
      })
      const data = await res.json()
      onComplete(answersArr, data.results, data.totalScore, data.maxScore, questions)
    } catch {
      setError('Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const answered = questions ? questions.filter(q => answers[q.id]).length : 0

  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6" dir="rtl">
        <div className="text-center space-y-3">
          <div style={{ color: '#D7FF00', fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700 }}>
            المرحلة الثانية
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, maxWidth: 480 }}>
            20 سيناريو عميل — اختار المشروع الصح لكل عميل من 3 خيارات قريبين من بعض.
          </div>
        </div>
        {error && <div style={{ color: '#f87171', fontSize: 13 }}>{error}</div>}
        <button
          onClick={startPhase}
          disabled={loading}
          style={{
            background: '#D7FF00', color: '#000', fontWeight: 700, borderRadius: 10,
            padding: '12px 36px', fontSize: 15, border: 'none', cursor: 'pointer',
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? 'جاري التحميل…' : 'ابدأ المرحلة الثانية'}
        </button>
      </div>
    )
  }

  if (!questions) return null

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: "'Space Grotesk', sans-serif" }}>
          المرحلة الثانية — سيناريوهات العملاء
        </span>
        <span style={{ color: '#D7FF00', fontSize: 13, fontWeight: 700 }}>
          {answered} / {questions.length} اتجاوب
        </span>
      </div>

      {/* Scrollable questions */}
      <div className="flex-1 overflow-y-auto space-y-5 pl-1">
        {questions.map((q, idx) => (
          <div
            key={q.id}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: answers[q.id] ? '1px solid rgba(215,255,0,0.25)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14,
              padding: '22px 24px',
              transition: 'border-color 0.2s',
            }}
          >
            {/* Q number + subtype */}
            <div className="flex items-center gap-3 mb-4">
              <span
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: answers[q.id] ? '#D7FF00' : 'rgba(255,255,255,0.1)',
                  color: answers[q.id] ? '#000' : 'rgba(255,255,255,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                  transition: 'all 0.2s',
                }}
              >
                {idx + 1}
              </span>
              <span
                style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                  background: q.subtype === 'narrative' ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)',
                  border: q.subtype === 'narrative' ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(245,158,11,0.3)',
                  color: q.subtype === 'narrative' ? 'rgba(165,180,252,0.9)' : 'rgba(252,211,77,0.9)',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {q.subtype === 'narrative' ? 'سيناريو' : 'ميزانية'}
              </span>
            </div>

            <p style={{ color: '#fff', fontSize: 14, lineHeight: 1.75, marginBottom: 18 }}>
              {q.scenario}
            </p>

            <div className="space-y-2">
              {q.choices.map(choice => {
                const selected = answers[q.id] === choice.label
                return (
                  <button
                    key={choice.label}
                    onClick={() => setAnswers(a => ({ ...a, [q.id]: choice.label }))}
                    style={{
                      width: '100%', textAlign: 'right', padding: '10px 14px',
                      borderRadius: 8, border: selected ? '1.5px solid #D7FF00' : '1px solid rgba(255,255,255,0.08)',
                      background: selected ? 'rgba(215,255,0,0.1)' : 'rgba(255,255,255,0.02)',
                      color: selected ? '#D7FF00' : 'rgba(255,255,255,0.65)',
                      cursor: 'pointer', fontSize: 13, transition: 'all 0.15s',
                      display: 'flex', gap: 10, alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        border: selected ? '2px solid #D7FF00' : '2px solid rgba(255,255,255,0.2)',
                        background: selected ? '#D7FF00' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, color: selected ? '#000' : 'transparent',
                      }}
                    >
                      {selected ? '✓' : ''}
                    </span>
                    <span>{choice.label}) {choice.text}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Submit */}
      <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {error && <span style={{ color: '#f87171', fontSize: 12 }}>{error}</span>}
        <div className="mr-auto flex items-center gap-4">
          {answered < questions.length && (
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
              لسه فيه {questions.length - answered} سؤال
            </span>
          )}
          <button
            onClick={submitPhase}
            disabled={answered < questions.length || submitting}
            style={{
              background: answered < questions.length || submitting ? 'rgba(215,255,0,0.25)' : '#D7FF00',
              color: '#000', fontWeight: 700, borderRadius: 10,
              padding: '11px 32px', fontSize: 14, border: 'none',
              cursor: answered < questions.length || submitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {submitting ? 'جاري التصحيح…' : 'تسليم المرحلة الثانية ✓'}
          </button>
        </div>
      </div>
    </div>
  )
}
