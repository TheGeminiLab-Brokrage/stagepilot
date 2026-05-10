'use client'

import { useState, useEffect, useRef } from 'react'
import ExamPhase1 from './ExamPhase1'
import ExamPhase2 from './ExamPhase2'
import ExamPhase3 from './ExamPhase3'
import ExamResults from './ExamResults'
import { useT } from '@/lib/language-context'

type ExamPhase = 'phase1' | 'phase2' | 'phase3' | 'results'
type ExamGate = 'loading' | 'intro' | 'active' | 'blocked'

interface GradeResult {
  id: string
  correct: boolean
  pointsEarned: number
  correctAnswer: string
  maxPoints: number
  reasoning?: string
  questionText?: string
  userAnswer?: string
}

interface Props {
  userId: string
  companyId: string
  userName: string
  userEmail: string
  onExamComplete?: () => void
}

export default function ExamClient({ userId, companyId, userName, userEmail, onExamComplete }: Props) {
  const t = useT()
  const PHASE_LABELS: Record<ExamPhase, string> = {
    phase1: t('examPhase1'),
    phase2: t('examPhase2'),
    phase3: t('examPhase3'),
    results: t('examResults'),
  }

  const [gate, setGate] = useState<ExamGate>('loading')
  const [startError, setStartError] = useState('')
  const [countdown, setCountdown] = useState('')

  useEffect(() => {
    if (gate !== 'blocked') return
    function tick() {
      const now = new Date()
      const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
      const diff = Math.max(0, reset.getTime() - now.getTime())
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [gate])

  const [phase, setPhase] = useState<ExamPhase>('phase1')
  const [questionTimeDisplay, setQuestionTimeDisplay] = useState(60)

  const hasSubmittedRef = useRef(false)

  const [phase1Answers, setPhase1Answers] = useState<{ id: string; response: string }[]>([])
  const [phase1Results, setPhase1Results] = useState<GradeResult[]>([])
  const [phase1Score, setPhase1Score] = useState(0)
  const [phase1Max, setPhase1Max] = useState(0)
  const [phase1Questions, setPhase1Questions] = useState<{ id: string; type: string; question: string }[]>([])

  const [phase2Answers, setPhase2Answers] = useState<{ id: string; response: string }[]>([])
  const [phase2Results, setPhase2Results] = useState<GradeResult[]>([])
  const [phase2Score, setPhase2Score] = useState(0)
  const [phase2Max, setPhase2Max] = useState(0)
  const [phase2Questions, setPhase2Questions] = useState<{ id: string; scenario: string }[]>([])

  const [phase3Completed, setPhase3Completed] = useState(false)
  const phase3AudioPathRef = useRef<string | null>(null)

  // Check daily limit on mount — test account bypasses entirely
  useEffect(() => {
    if (userEmail === 'exam@test.com') {
      setGate('intro')
      return
    }
    fetch('/api/daily-limit')
      .then((r) => r.json())
      .then((data) => {
        const examUsed = data.usedToday ?? data.usedExamToday ?? 0
        if (data.unlimited || examUsed < 1) {
          setGate('intro')
        } else {
          setGate('blocked')
        }
      })
      .catch(() => setGate('intro'))
  }, [userEmail])

  async function handleStartExam() {
    setStartError('')
    if (userEmail === 'exam@test.com') {
      setGate('active')
      return
    }
    try {
      const res = await fetch('/api/exam/start-attempt', { method: 'POST' })
      const data = await res.json()
      if (data.allowed) {
        setGate('active')
      } else {
        setGate('blocked')
      }
    } catch {
      setStartError(t('examStartError'))
    }
  }

  function handlePhase1Complete(
    answers: { id: string; response: string }[],
    results: GradeResult[],
    totalScore: number,
    maxScore: number,
    questions: { id: string; type: string; question: string }[],
  ) {
    setPhase1Answers(answers)
    setPhase1Results(results)
    setPhase1Score(totalScore)
    setPhase1Max(maxScore)
    setPhase1Questions(questions)
    setPhase('phase2')
  }

  function handlePhase2Complete(
    answers: { id: string; response: string }[],
    results: GradeResult[],
    totalScore: number,
    maxScore: number,
    questions: { id: string; scenario: string }[],
  ) {
    setPhase2Answers(answers)
    setPhase2Results(results)
    setPhase2Score(totalScore)
    setPhase2Max(maxScore)
    setPhase2Questions(questions)
    setPhase('phase3')
  }

  function handlePhase3RecordingSaved(audioPath: string) {
    phase3AudioPathRef.current = audioPath
  }

  async function handlePhase3Complete() {
    if (hasSubmittedRef.current) return
    hasSubmittedRef.current = true
    setPhase3Completed(true)

    try {
      await fetch('/api/exam/save-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase1Score,
          phase1Max,
          phase2Score,
          phase2Max,
          phase3Completed: true,
          phase1Details: phase1Results,
          phase2Details: phase2Results,
        }),
      })
    } catch {
      // Non-blocking — results screen still shows
    }

    if (phase3AudioPathRef.current) {
      fetch('/api/exam/trigger-grading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioPath: phase3AudioPathRef.current }),
      }).catch(() => {})
    }

    setPhase('results')
    onExamComplete?.()
  }

  function handleReset() {
    if (userEmail !== 'exam@test.com') {
      setGate('blocked')
      return
    }
    setPhase('phase1')
    setPhase1Answers([])
    setPhase1Results([])
    setPhase1Score(0)
    setPhase1Max(0)
    setPhase1Questions([])
    setPhase2Answers([])
    setPhase2Results([])
    setPhase2Score(0)
    setPhase2Max(0)
    setPhase2Questions([])
    setPhase3Completed(false)
    hasSubmittedRef.current = false
    setQuestionTimeDisplay(60)
    setGate('intro')
  }

  const phaseOrder: ExamPhase[] = ['phase1', 'phase2', 'phase3', 'results']
  const currentIdx = phaseOrder.indexOf(phase)

  // ── Gate screens ───────────────────────────────────────────────────────────

  if (gate === 'loading') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', fontFamily: "'Montserrat', sans-serif",
      }}>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>{t('examLoading')}</div>
      </div>
    )
  }

  if (gate === 'blocked') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', fontFamily: "'Montserrat', sans-serif", textAlign: 'center', gap: 20,
        padding: '0 24px',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'rgba(255,60,60,0.1)',
          border: '1px solid rgba(255,60,60,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28,
        }}>
          🔒
        </div>
        <div>
          <p style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
            {t('examBlockedTitle')}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 1.7, maxWidth: 340 }}>
            {t('examBlockedBody')}
          </p>
        </div>
        {countdown && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            background: 'rgba(215,255,0,0.04)',
            border: '1px solid rgba(215,255,0,0.15)',
            borderRadius: 12,
            padding: '14px 32px',
          }}>
            <p style={{ color: 'rgba(215,255,0,0.5)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Space Grotesk', sans-serif" }}>
              {t('examBlockedResetsIn')}
            </p>
            <p style={{ color: '#D7FF00', fontSize: 28, fontWeight: 800, letterSpacing: '0.08em', fontVariantNumeric: 'tabular-nums', fontFamily: "'Space Grotesk', sans-serif" }}>
              {countdown}
            </p>
          </div>
        )}
        <a
          href="/dashboard"
          style={{
            color: 'rgba(215,255,0,0.6)', fontSize: 12, textDecoration: 'underline',
            cursor: 'pointer', marginTop: 8,
          }}
        >
          {t('examBlockedLogout')}
        </a>
      </div>
    )
  }

  if (gate === 'intro') {
    const phases = [
      { label: t('examIntroPhase1Label'), desc: t('examIntroPhase1Desc') },
      { label: t('examIntroPhase2Label'), desc: t('examIntroPhase2Desc') },
      { label: t('examIntroPhase3Label'), desc: t('examIntroPhase3Desc') },
    ]
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', fontFamily: "'Montserrat', sans-serif", textAlign: 'center', gap: 40,
        padding: '0 32px',
      }}>
        <div>
          <p style={{
            fontSize: 16, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: '#D7FF00', marginBottom: 18, fontFamily: "'Space Grotesk', sans-serif",
          }}>
            {t('examTagline')}
          </p>
          <h1 dir="ltr" style={{ color: '#fff', fontSize: 40, fontWeight: 800, marginBottom: 16, lineHeight: 1.2 }}>
            {userName}، {t('examReadyQuestion')}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 17, lineHeight: 1.75, maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
            {t('examIntroBody')}
          </p>
        </div>

        <div style={{
          background: 'rgba(215,255,0,0.04)',
          border: '1px solid rgba(215,255,0,0.15)',
          borderRadius: 14, padding: '20px 40px',
          display: 'flex', gap: 48,
        }}>
          {phases.map((item) => (
            <div key={item.label} style={{ textAlign: 'center' }}>
              <p style={{ color: '#D7FF00', fontSize: 14, fontWeight: 700, marginBottom: 5, fontFamily: "'Space Grotesk', sans-serif" }}>
                {item.label}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>{item.desc}</p>
            </div>
          ))}
        </div>

        {userEmail !== 'exam@test.com' && (
          <p style={{ color: 'rgba(255,100,100,0.7)', fontSize: 13, letterSpacing: '0.03em' }}>
            {t('examIntroWarning')}
          </p>
        )}

        {startError && (
          <p style={{ color: 'rgba(255,100,100,0.85)', fontSize: 14 }}>{startError}</p>
        )}

        <button
          onClick={handleStartExam}
          style={{
            background: '#D7FF00', color: '#000',
            border: 'none', borderRadius: 12, padding: '18px 72px',
            fontSize: 18, fontWeight: 800, cursor: 'pointer',
            fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.06em',
          }}
        >
          {t('examStartBtn')}
        </button>
      </div>
    )
  }

  // ── Active exam ────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col"
      style={{ fontFamily: "'Montserrat', sans-serif" }}
    >
      <style>{`
        @keyframes timerPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(1.05); }
        }
      `}</style>

      {/* Phase stepper */}
      <div className="flex items-center gap-1 mb-6" dir="rtl">
        {(['phase1', 'phase2', 'phase3'] as ExamPhase[]).map((p, i) => {
          const idx = phaseOrder.indexOf(p)
          const done = currentIdx > idx
          const active = phase === p
          return (
            <div key={p} className="flex items-center gap-1">
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 14px', borderRadius: 20,
                  background: active ? 'rgba(215,255,0,0.12)' : done ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
                  border: active ? '1px solid rgba(215,255,0,0.4)' : done ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  transition: 'all 0.3s',
                }}
              >
                <span style={{ fontSize: 13, color: active ? '#D7FF00' : done ? '#10b981' : 'rgba(255,255,255,0.35)', fontWeight: 700 }}>
                  {done ? '✓' : String(i + 1)}
                </span>
                <span style={{ fontSize: 12, color: active ? '#D7FF00' : done ? '#10b981' : 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                  {PHASE_LABELS[p]}
                </span>
              </div>
              {i < 2 && (
                <div style={{ width: 20, height: 1, background: done ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)' }} />
              )}
            </div>
          )
        })}
        {phase === 'results' && (
          <div style={{ marginRight: 8, padding: '5px 14px', borderRadius: 20, background: 'rgba(215,255,0,0.12)', border: '1px solid rgba(215,255,0,0.4)' }}>
            <span style={{ fontSize: 12, color: '#D7FF00', fontWeight: 600 }}>{t('examResults')}</span>
          </div>
        )}
      </div>

      {/* Per-question countdown — visible only during phase1 and phase2 */}
      {(phase === 'phase1' || phase === 'phase2') && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: '0.12em',
            color: questionTimeDisplay <= 10 ? '#ff4444' : '#D7FF00',
            background: questionTimeDisplay <= 10 ? 'rgba(255,68,68,0.08)' : 'rgba(215,255,0,0.06)',
            border: `1px solid ${questionTimeDisplay <= 10 ? 'rgba(255,68,68,0.3)' : 'rgba(215,255,0,0.2)'}`,
            padding: '4px 16px',
            borderRadius: 8,
            transition: 'color 0.3s, background 0.3s, border-color 0.3s',
            animation: questionTimeDisplay <= 10 ? 'timerPulse 0.8s ease-in-out infinite' : 'none',
          }}>
            {String(Math.floor(questionTimeDisplay / 60)).padStart(2, '0')}:{String(questionTimeDisplay % 60).padStart(2, '0')}
          </div>
        </div>
      )}

      {/* Phase content */}
      <div>
        {phase === 'phase1' && (
          <ExamPhase1 onComplete={handlePhase1Complete} onTimerTick={setQuestionTimeDisplay} />
        )}
        {phase === 'phase2' && (
          <ExamPhase2 onComplete={handlePhase2Complete} onTimerTick={setQuestionTimeDisplay} />
        )}
        {phase === 'phase3' && (
          <ExamPhase3 onComplete={handlePhase3Complete} onRecordingSaved={handlePhase3RecordingSaved} />
        )}
        {phase === 'results' && (
          <ExamResults
            phase1Score={phase1Score}
            phase1Max={phase1Max}
            phase1Results={phase1Results}
            phase1Questions={phase1Questions}
            phase2Score={phase2Score}
            phase2Max={phase2Max}
            phase2Results={phase2Results}
            phase2Questions={phase2Questions}
            phase3Completed={phase3Completed}
            userName={userName}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  )
}
