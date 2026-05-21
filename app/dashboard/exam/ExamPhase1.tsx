'use client'

import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '@/lib/language-context'

interface Question {
  id: string
  type: 'mcq' | 'truefalse' | 'essay'
  question: string
  choices?: string[]
  points: number
}

interface GradeResult {
  id: string
  correct: boolean
  pointsEarned: number
  correctAnswer: string
  maxPoints: number
}

interface Props {
  onComplete: (answers: { id: string; response: string }[], results: GradeResult[], totalScore: number, maxScore: number, questions: Question[]) => void
  onTimerTick: (seconds: number) => void
}

const typeLabelAr: Record<string, string> = {
  mcq: 'اختيار من متعدد',
  truefalse: 'صح أو غلط',
  essay: 'سؤال مقالي',
}
const typeLabelEn: Record<string, string> = {
  mcq: 'MCQ',
  truefalse: 'True / False',
  essay: 'Essay',
}

const typeColor: Record<string, string> = {
  mcq: 'rgba(99,102,241,0.15)',
  truefalse: 'rgba(16,185,129,0.15)',
  essay: 'rgba(245,158,11,0.15)',
}

const typeBorder: Record<string, string> = {
  mcq: 'rgba(99,102,241,0.4)',
  truefalse: 'rgba(16,185,129,0.4)',
  essay: 'rgba(245,158,11,0.4)',
}

const QUESTION_TIME = 60

export default function ExamPhase1({ onComplete, onTimerTick }: Props) {
  const { lang } = useLanguage()
  const isAr = lang === 'ar'
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [grading, setGrading] = useState(false)
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
      submitExam()
    } else {
      setCurrent(c => c + 1)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionTimeLeft])

  async function startExam() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/exam/phase1-questions')
      if (!res.ok) throw new Error('Failed to load questions')
      const qs = await res.json()
      setQuestions(qs)
      setStarted(true)
    } catch {
      setError('Failed to load exam questions. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function submitExam() {
    if (!questions) return
    setGrading(true)
    const answersArr = questions.map(q => ({ id: q.id, response: answers[q.id] ?? '' }))
    try {
      const res = await fetch('/api/exam/grade-phase1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersArr }),
      })
      const data = await res.json()
      onComplete(answersArr, data.results, data.totalScore, data.maxScore, questions)
    } catch {
      setError('Failed to submit. Please try again.')
    } finally {
      setGrading(false)
    }
  }

  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <div className="text-center space-y-3">
          <div style={{ color: '#D7FF00', fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700 }}>
            {isAr ? 'المرحلة الأولى' : 'Phase 1'}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 17, maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
            {isAr
              ? '10 أسئلة متنوعة — اختيار من متعدد، صح أو غلط، وأسئلة مقالية. الأسئلة تظهر واحدة واحدة.'
              : '10 varied questions — MCQ, true/false, and essay. One question at a time.'}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15 }}>
            {isAr ? 'على الأقل سؤالين من كل نوع' : 'At least 2 questions per type'}
          </div>
        </div>
        {error && <div style={{ color: '#f87171', fontSize: 13 }}>{error}</div>}
        <button
          onClick={startExam}
          disabled={loading}
          style={{
            background: '#D7FF00', color: '#000', fontWeight: 700, borderRadius: 10,
            padding: '12px 36px', fontSize: 15, border: 'none', cursor: 'pointer',
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading
            ? (isAr ? 'جاري التحميل…' : 'Loading…')
            : (isAr ? 'ابدأ المرحلة الأولى' : 'Start Phase 1')}
        </button>
      </div>
    )
  }

  if (!questions) return null

  const q = questions[current]
  const isLast = current === questions.length - 1
  const currentAnswer = answers[q.id] ?? ''

  function handleNext() {
    if (isLast) {
      submitExam()
    } else {
      setCurrent(c => c + 1)
    }
  }

  return (
    <div className="flex flex-col overflow-y-auto" dir="rtl">
      {/* Progress */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-2">
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: "'Space Grotesk', sans-serif" }}>
            {isAr ? 'المرحلة الأولى — الأسئلة' : 'Phase 1 — Questions'}
          </span>
          <span style={{ color: '#D7FF00', fontSize: 13, fontWeight: 700 }}>
            {current + 1} / {questions.length}
          </span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
          <div
            style={{
              height: '100%', borderRadius: 2,
              background: '#D7FF00',
              width: `${((current + 1) / questions.length) * 100}%`,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Question card */}
      <div
        className="flex flex-col gap-3"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${typeBorder[q.type]}`,
          borderRadius: 16,
          padding: '14px 20px',
          userSelect: 'none',
        }}
      >
        {/* Type badge + points */}
        <div className="flex items-center justify-between">
          <span
            style={{
              background: typeColor[q.type],
              border: `1px solid ${typeBorder[q.type]}`,
              color: 'rgba(255,255,255,0.8)',
              fontSize: 11,
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: 20,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {(isAr ? typeLabelAr : typeLabelEn)[q.type]}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{q.points} {isAr ? 'درجة' : 'pt'}</span>
        </div>

        {/* Question text */}
        <p style={{ color: '#fff', fontSize: 15, lineHeight: 1.6, fontWeight: 500 }}>
          {q.question}
        </p>

        {/* MCQ choices */}
        {q.type === 'mcq' && q.choices && (
          <div className="space-y-2">
            {q.choices.map((choice, i) => {
              const selected = currentAnswer === choice.charAt(0)
              return (
                <button
                  key={i}
                  onClick={() => setAnswers(a => ({ ...a, [q.id]: choice.charAt(0) }))}
                  style={{
                    width: '100%', textAlign: 'right', padding: '9px 14px',
                    borderRadius: 10, border: selected ? '1.5px solid #D7FF00' : '1px solid rgba(255,255,255,0.1)',
                    background: selected ? 'rgba(215,255,0,0.1)' : 'rgba(255,255,255,0.03)',
                    color: selected ? '#D7FF00' : 'rgba(255,255,255,0.7)',
                    cursor: 'pointer', fontSize: 13, transition: 'all 0.15s',
                    display: 'block',
                  }}
                >
                  {choice}
                </button>
              )
            })}
          </div>
        )}

        {/* T/F choices */}
        {q.type === 'truefalse' && (
          <div className="flex gap-4 mt-2">
            {(['صح', 'غلط'] as const).map(opt => {
              const selected = currentAnswer === opt
              const isTrue = opt === 'صح'
              const displayLabel = isAr ? opt : (isTrue ? 'True' : 'False')
              return (
                <button
                  key={opt}
                  onClick={() => setAnswers(a => ({ ...a, [q.id]: opt }))}
                  style={{
                    flex: 1, padding: '14px', borderRadius: 10,
                    border: selected
                      ? `1.5px solid ${isTrue ? '#10b981' : '#f87171'}`
                      : '1px solid rgba(255,255,255,0.1)',
                    background: selected
                      ? isTrue ? 'rgba(16,185,129,0.15)' : 'rgba(248,113,113,0.15)'
                      : 'rgba(255,255,255,0.03)',
                    color: selected
                      ? isTrue ? '#10b981' : '#f87171'
                      : 'rgba(255,255,255,0.6)',
                    cursor: 'pointer', fontSize: 16, fontWeight: 700, transition: 'all 0.15s',
                  }}
                >
                  {displayLabel}
                </button>
              )
            })}
          </div>
        )}

        {/* Essay textarea */}
        {q.type === 'essay' && (
          <textarea
            value={currentAnswer}
            onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
            placeholder={isAr ? 'اكتب إجابتك هنا…' : 'Write your answer here…'}
            rows={4}
            style={{
              width: '100%', borderRadius: 10,
              border: currentAnswer ? '1.5px solid rgba(245,158,11,0.5)' : '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              color: '#fff', fontSize: 14, padding: '12px 16px',
              resize: 'vertical', outline: 'none', lineHeight: 1.7,
              userSelect: 'text',
            }}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-end mt-3 gap-3">
        {error && <span style={{ color: '#f87171', fontSize: 12 }}>{error}</span>}

        <button
          onClick={handleNext}
          disabled={!currentAnswer || grading}
          style={{
            background: !currentAnswer || grading ? 'rgba(215,255,0,0.3)' : '#D7FF00',
            color: '#000', fontWeight: 700, borderRadius: 10,
            padding: '10px 28px', fontSize: 14, border: 'none',
            cursor: !currentAnswer || grading ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {grading
            ? (isAr ? 'جاري التصحيح…' : '…Grading')
            : isLast
              ? (isAr ? 'تسليم المرحلة الأولى ✓' : 'Submit Phase 1 ✓')
              : (isAr ? 'التالي →' : '→ Next')}
        </button>
      </div>
    </div>
  )
}
