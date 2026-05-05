'use client'

import { useState, useEffect, useRef } from 'react'

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
  forceSubmitTrigger: boolean
}

const typeLabel: Record<string, string> = {
  mcq: 'اختيار من متعدد',
  truefalse: 'صح أو غلط',
  essay: 'سؤال مقالي',
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

export default function ExamPhase1({ onComplete, forceSubmitTrigger }: Props) {
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [grading, setGrading] = useState(false)
  const [error, setError] = useState('')
  const [started, setStarted] = useState(false)

  const forceSubmitFiredRef = useRef(false)
  useEffect(() => {
    if (!forceSubmitTrigger) return
    if (forceSubmitFiredRef.current) return
    forceSubmitFiredRef.current = true
    if (!questions || questions.length === 0) {
      onComplete([], [], 0, 0, [])
      return
    }
    const answersArr = questions.map(q => ({ id: q.id, response: answers[q.id] ?? '' }))
    setGrading(true)
    fetch('/api/exam/grade-phase1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: answersArr }),
    })
      .then(r => r.json())
      .then(data => onComplete(answersArr, data.results, data.totalScore, data.maxScore, questions))
      .catch(() => onComplete(answersArr, [], 0, 0, questions))
      .finally(() => setGrading(false))
  }, [forceSubmitTrigger])

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
      <div className="flex flex-col items-center justify-center h-full gap-6" dir="rtl">
        <div className="text-center space-y-3">
          <div style={{ color: '#D7FF00', fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700 }}>
            المرحلة الأولى
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, maxWidth: 480 }}>
            10 أسئلة متنوعة — اختيار من متعدد، صح أو غلط، وأسئلة مقالية. الأسئلة تظهر واحدة واحدة.
          </div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
            على الأقل سؤالين من كل نوع
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
          {loading ? 'جاري التحميل…' : 'ابدأ المرحلة الأولى'}
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
    <div className="flex flex-col h-full" dir="rtl">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: "'Space Grotesk', sans-serif" }}>
            المرحلة الأولى — الأسئلة
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
        className="flex-1 flex flex-col gap-5 overflow-y-auto"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${typeBorder[q.type]}`,
          borderRadius: 16,
          padding: '28px 32px',
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
            {typeLabel[q.type]}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{q.points} درجة</span>
        </div>

        {/* Question text */}
        <p style={{ color: '#fff', fontSize: 17, lineHeight: 1.7, fontWeight: 500 }}>
          {q.question}
        </p>

        {/* MCQ choices */}
        {q.type === 'mcq' && q.choices && (
          <div className="space-y-3 mt-2">
            {q.choices.map((choice, i) => {
              const selected = currentAnswer === choice.charAt(0)
              return (
                <button
                  key={i}
                  onClick={() => setAnswers(a => ({ ...a, [q.id]: choice.charAt(0) }))}
                  style={{
                    width: '100%', textAlign: 'right', padding: '12px 16px',
                    borderRadius: 10, border: selected ? '1.5px solid #D7FF00' : '1px solid rgba(255,255,255,0.1)',
                    background: selected ? 'rgba(215,255,0,0.1)' : 'rgba(255,255,255,0.03)',
                    color: selected ? '#D7FF00' : 'rgba(255,255,255,0.7)',
                    cursor: 'pointer', fontSize: 14, transition: 'all 0.15s',
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
            {['صح', 'غلط'].map(opt => {
              const selected = currentAnswer === opt
              const isTrue = opt === 'صح'
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
                  {opt}
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
            placeholder="اكتب إجابتك هنا…"
            rows={4}
            style={{
              width: '100%', borderRadius: 10,
              border: currentAnswer ? '1.5px solid rgba(245,158,11,0.5)' : '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              color: '#fff', fontSize: 14, padding: '12px 16px',
              resize: 'vertical', outline: 'none', lineHeight: 1.7,
            }}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-5">
        <button
          onClick={() => setCurrent(c => Math.max(0, c - 1))}
          disabled={current === 0}
          style={{
            color: 'rgba(255,255,255,0.4)', background: 'transparent', border: 'none',
            cursor: current === 0 ? 'default' : 'pointer', fontSize: 13,
            opacity: current === 0 ? 0.3 : 1,
          }}
        >
          ← السابق
        </button>

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
          {grading ? 'جاري التصحيح…' : isLast ? 'تسليم المرحلة الأولى ✓' : 'التالي →'}
        </button>
      </div>
    </div>
  )
}
