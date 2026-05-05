'use client'

import { useState, useEffect, useRef } from 'react'
import ExamPhase1 from './ExamPhase1'
import ExamPhase2 from './ExamPhase2'
import ExamPhase3 from './ExamPhase3'
import ExamResults from './ExamResults'

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
}

const PHASE_LABELS: Record<ExamPhase, string> = {
  phase1: '١ — الأسئلة',
  phase2: '٢ — السيناريوهات',
  phase3: '٣ — المحاكاة',
  results: 'النتيجة',
}

export default function ExamClient({ userId, companyId, userName, userEmail }: Props) {
  const [gate, setGate] = useState<ExamGate>('loading')
  const [startError, setStartError] = useState('')

  const [phase, setPhase] = useState<ExamPhase>('phase1')

  const TIMER_DURATION = 1800 // 30 minutes
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION)
  const [timerExpired, setTimerExpired] = useState(false)
  const [forceSubmitP1, setForceSubmitP1] = useState(false)
  const [forceSubmitP2, setForceSubmitP2] = useState(false)
  const [timerKey, setTimerKey] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const skipPhase2Ref = useRef(false)
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

  // Check daily limit on mount — test account bypasses entirely
  useEffect(() => {
    if (userEmail === 'exam@test.com') {
      setGate('intro')
      return
    }
    fetch('/api/daily-limit')
      .then((r) => r.json())
      .then((data) => {
        if (data.unlimited || (data.usedToday ?? 0) < 1) {
          setGate('intro')
        } else {
          setGate('blocked')
        }
      })
      .catch(() => setGate('intro')) // fail open so auth issues don't lock users out
  }, [userEmail])

  // Start countdown when exam goes active; restart when timerKey changes (reset)
  useEffect(() => {
    if (gate !== 'active') return
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!)
          intervalRef.current = null
          setTimerExpired(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    }
  }, [gate, timerKey])

  // Stop timer once user reaches phase3 or results
  useEffect(() => {
    if (phase === 'phase3' || phase === 'results') {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    }
  }, [phase])

  // On expiry: trigger force-submit for whichever phase is active
  useEffect(() => {
    if (!timerExpired) return
    if (phase === 'phase1') {
      skipPhase2Ref.current = true
      setForceSubmitP1(true)
    } else if (phase === 'phase2') {
      setForceSubmitP2(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerExpired]) // intentionally omits `phase` — reads phase value at expiry moment

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
      setStartError('حدث خطأ. حاول مرة أخرى.')
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
    if (skipPhase2Ref.current) {
      // Timer expired during Phase 1 — skip Phase 2 with zeros and jump to Phase 3
      setPhase2Score(0)
      setPhase2Max(0)
      setPhase2Results([])
      setPhase2Questions([])
      setPhase('phase3')
    } else {
      setPhase('phase2')
    }
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

  async function handlePhase3Complete() {
    if (hasSubmittedRef.current) return
    hasSubmittedRef.current = true
    setPhase3Completed(true)

    // Save to DB
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

    setPhase('results')
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
    setForceSubmitP1(false)
    setForceSubmitP2(false)
    setTimerExpired(false)
    setTimeLeft(TIMER_DURATION)
    skipPhase2Ref.current = false
    hasSubmittedRef.current = false
    setTimerKey(k => k + 1)
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
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>جاري التحميل…</div>
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
            لقد استخدمت محاولة الاختبار اليومية
          </p>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 1.7, maxWidth: 340 }}>
            يُسمح بمحاولة واحدة فقط في اليوم. عد غداً للمحاولة مجدداً.
          </p>
        </div>
        <a
          href="/auth/login"
          style={{
            color: 'rgba(215,255,0,0.6)', fontSize: 12, textDecoration: 'underline',
            cursor: 'pointer', marginTop: 8,
          }}
        >
          تسجيل الخروج
        </a>
      </div>
    )
  }

  if (gate === 'intro') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', fontFamily: "'Montserrat', sans-serif", textAlign: 'center', gap: 28,
        padding: '0 24px',
      }}>
        <div>
          <p style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: '#D7FF00', marginBottom: 14, fontFamily: "'Space Grotesk', sans-serif",
          }}>
            الاختبار التقييمي
          </p>
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, marginBottom: 12, lineHeight: 1.3 }}>
            {userName}، أنت جاهز؟
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 1.75, maxWidth: 380 }}>
            الاختبار يتكوّن من ٣ مراحل: أسئلة متعددة الخيارات، سيناريوهات، ومحاكاة مكالمة حيّة.
          </p>
        </div>

        <div style={{
          background: 'rgba(215,255,0,0.04)',
          border: '1px solid rgba(215,255,0,0.15)',
          borderRadius: 12, padding: '14px 20px',
          display: 'flex', gap: 24,
        }}>
          {[
            { label: 'المرحلة ١', desc: 'أسئلة' },
            { label: 'المرحلة ٢', desc: 'سيناريوهات' },
            { label: 'المرحلة ٣', desc: 'محاكاة' },
          ].map((item) => (
            <div key={item.label} style={{ textAlign: 'center' }}>
              <p style={{ color: '#D7FF00', fontSize: 11, fontWeight: 700, marginBottom: 3, fontFamily: "'Space Grotesk', sans-serif" }}>
                {item.label}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{item.desc}</p>
            </div>
          ))}
        </div>

        {userEmail !== 'exam@test.com' && (
          <p style={{ color: 'rgba(255,100,100,0.7)', fontSize: 11, letterSpacing: '0.03em' }}>
            تنبيه: لديك محاولة واحدة فقط في اليوم
          </p>
        )}

        {startError && (
          <p style={{ color: 'rgba(255,100,100,0.85)', fontSize: 12 }}>{startError}</p>
        )}

        <button
          onClick={handleStartExam}
          style={{
            background: '#D7FF00', color: '#000',
            border: 'none', borderRadius: 10, padding: '13px 40px',
            fontSize: 14, fontWeight: 800, cursor: 'pointer',
            fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.06em',
          }}
        >
          ابدأ الاختبار
        </button>
      </div>
    )
  }

  // ── Active exam ────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col h-full"
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
            <span style={{ fontSize: 12, color: '#D7FF00', fontWeight: 600 }}>النتيجة</span>
          </div>
        )}
      </div>

      {/* Countdown timer — visible only during phase1 and phase2 */}
      {(phase === 'phase1' || phase === 'phase2') && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: '0.12em',
            color: timeLeft <= 10 ? '#ff4444' : '#D7FF00',
            background: timeLeft <= 10 ? 'rgba(255,68,68,0.08)' : 'rgba(215,255,0,0.06)',
            border: `1px solid ${timeLeft <= 10 ? 'rgba(255,68,68,0.3)' : 'rgba(215,255,0,0.2)'}`,
            padding: '4px 16px',
            borderRadius: 8,
            transition: 'color 0.3s, background 0.3s, border-color 0.3s',
            animation: timeLeft <= 10 ? 'timerPulse 0.8s ease-in-out infinite' : 'none',
          }}>
            {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
          </div>
        </div>
      )}

      {/* Phase content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {phase === 'phase1' && (
          <ExamPhase1 onComplete={handlePhase1Complete} forceSubmitTrigger={forceSubmitP1} />
        )}
        {phase === 'phase2' && (
          <ExamPhase2 onComplete={handlePhase2Complete} forceSubmitTrigger={forceSubmitP2} />
        )}
        {phase === 'phase3' && (
          <ExamPhase3 onComplete={handlePhase3Complete} />
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
