'use client'

import { useState } from 'react'
import ExamPhase1 from './ExamPhase1'
import ExamPhase2 from './ExamPhase2'
import ExamPhase3 from './ExamPhase3'
import ExamResults from './ExamResults'

type ExamPhase = 'phase1' | 'phase2' | 'phase3' | 'results'

interface GradeResult {
  id: string
  correct: boolean
  pointsEarned: number
  correctAnswer: string
  maxPoints: number
  reasoning?: string
}

interface Props {
  userId: string
  companyId: string
  userName: string
}

const PHASE_LABELS: Record<ExamPhase, string> = {
  phase1: '١ — الأسئلة',
  phase2: '٢ — السيناريوهات',
  phase3: '٣ — المحاكاة',
  results: 'النتيجة',
}

export default function ExamClient({ userId, companyId, userName }: Props) {
  const [phase, setPhase] = useState<ExamPhase>('phase1')

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

  async function handlePhase3Complete() {
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
        }),
      })
    } catch {
      // Non-blocking — results screen still shows
    }

    setPhase('results')
  }

  function handleReset() {
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
  }

  const phaseOrder: ExamPhase[] = ['phase1', 'phase2', 'phase3', 'results']
  const currentIdx = phaseOrder.indexOf(phase)

  return (
    <div
      className="flex flex-col h-full"
      style={{ fontFamily: "'Montserrat', sans-serif" }}
    >
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

      {/* Phase content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {phase === 'phase1' && (
          <ExamPhase1 onComplete={handlePhase1Complete} />
        )}
        {phase === 'phase2' && (
          <ExamPhase2 onComplete={handlePhase2Complete} />
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
