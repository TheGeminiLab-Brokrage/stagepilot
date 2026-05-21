'use client'

import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '@/lib/language-context'

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
  onTimerTick: (seconds: number) => void
}

const QUESTION_TIME = 60

export default function ExamPhase2({ onComplete, onTimerTick }: Props) {
  const { lang } = useLanguage()
  const isAr = lang === 'ar'
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [started, setStarted] = useState(false)

  const [questionTimeLeft, setQuestionTimeLeft] = useState(QUESTION_TIME)
  const timerFiredRef = useRef(false)
  const onTimerTickRef = useRef(onTimerTick)
  onTimerTickRef.current = onTimerTick

  // Report timer value up to ExamClient for top display
  useEffect(() => {
    onTimerTickRef.current(questionTimeLeft)
  }, [questionTimeLeft])

  // Reset per-question timer when question changes
  useEffect(() => {
    if (!started) return
    setQuestionTimeLeft(QUESTION_TIME)
    timerFiredRef.current = false
  }, [current, started])

  // Countdown
  useEffect(() => {
    if (!started || !questions) return
    if (questionTimeLeft <= 0) return
    const id = setTimeout(() => setQuestionTimeLeft(t => Math.max(0, t - 1)), 1000)
    return () => clearTimeout(id)
  }, [questionTimeLeft, started, questions])

  // Auto-advance when per-question timer hits 0
  useEffect(() => {
    if (questionTimeLeft > 0) return
    if (!started || !questions) return
    if (timerFiredRef.current) return
    timerFiredRef.current = true
    const isLast = current === questions.length - 1
    if (isLast) {
      submitPhase()
    } else {
      setCurrent(c => c + 1)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionTimeLeft])

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

  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <div className="text-center space-y-3">
          <div style={{ color: '#D7FF00', fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700 }}>
            {isAr ? 'المرحلة الثانية' : 'Phase 2'}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 17, maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
            {isAr
              ? '20 سيناريو عميل — اختار المشروع الصح لكل عميل من 3 خيارات قريبين من بعض.'
              : '20 client scenarios — pick the right project for each client from 3 similar options.'}
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
          {loading
            ? (isAr ? 'جاري التحميل…' : 'Loading…')
            : (isAr ? 'ابدأ المرحلة الثانية' : 'Start Phase 2')}
        </button>
      </div>
    )
  }

  if (!questions) return null

  const q = questions[current]
  const isLast = current === questions.length - 1
  const currentAnswered = !!answers[q.id]

  const progressPct = ((current + 1) / questions.length) * 100

  return (
    <div className="flex flex-col overflow-y-auto" dir="rtl">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: "'Space Grotesk', sans-serif" }}>
            المرحلة الثانية — سيناريوهات العملاء
          </span>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
            السؤال {current + 1} / {questions.length}
          </span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              background: '#D7FF00',
              borderRadius: 2,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Single question */}
      <div
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: currentAnswered ? '1px solid rgba(215,255,0,0.25)' : '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: '22px 24px',
          transition: 'border-color 0.2s',
          userSelect: 'none',
        }}
      >
          {/* Q number + subtype */}
          <div className="flex items-center gap-3 mb-4">
            <span
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: currentAnswered ? '#D7FF00' : 'rgba(255,255,255,0.1)',
                color: currentAnswered ? '#000' : 'rgba(255,255,255,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0,
                transition: 'all 0.2s',
              }}
            >
              {current + 1}
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

      {/* Navigation */}
      <div className="flex items-center justify-end mt-4 pt-4 gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {error && <span style={{ color: '#f87171', fontSize: 12 }}>{error}</span>}

        {/* Next or Submit */}
        {isLast ? (
          <button
            onClick={submitPhase}
            disabled={!currentAnswered || submitting}
            style={{
              background: !currentAnswered || submitting ? 'rgba(215,255,0,0.25)' : '#D7FF00',
              color: '#000', fontWeight: 700, borderRadius: 10,
              padding: '11px 32px', fontSize: 14, border: 'none',
              cursor: !currentAnswered || submitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {submitting
              ? (isAr ? 'جاري التصحيح…' : 'Grading…')
              : (isAr ? 'تسليم المرحلة الثانية ✓' : 'Submit Phase 2 ✓')}
          </button>
        ) : (
          <button
            onClick={() => setCurrent(c => c + 1)}
            disabled={!currentAnswered}
            style={{
              background: currentAnswered ? '#D7FF00' : 'rgba(215,255,0,0.25)',
              color: '#000', fontWeight: 700, borderRadius: 10,
              padding: '11px 28px', fontSize: 14, border: 'none',
              cursor: currentAnswered ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
          >
            {isAr ? 'التالي ←' : 'Next ←'}
          </button>
        )}
      </div>
    </div>
  )
}
