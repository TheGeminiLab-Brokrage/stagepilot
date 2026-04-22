'use client'

interface GradeResult {
  id: string
  correct: boolean
  pointsEarned: number
  correctAnswer: string
  maxPoints: number
  reasoning?: string
}

interface Props {
  phase1Score: number
  phase1Max: number
  phase1Results: GradeResult[]
  phase1Questions: { id: string; type: string; question: string }[]
  phase2Score: number
  phase2Max: number
  phase2Results: GradeResult[]
  phase2Questions: { id: string; scenario: string }[]
  phase3Completed: boolean
  userName: string
}

function ScoreRing({ score, max, label, color }: { score: number; max: number; label: string; color: string }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0
  const r = 40
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ

  return (
    <div className="flex flex-col items-center gap-2">
      <div style={{ position: 'relative', width: 100, height: 100 }}>
        <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        <div
          style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span style={{ color, fontSize: 20, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>
            {pct}%
          </span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{score}/{max}</span>
        </div>
      </div>
      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600 }}>{label}</span>
    </div>
  )
}

export default function ExamResults({
  phase1Score, phase1Max, phase1Results, phase1Questions,
  phase2Score, phase2Max, phase2Results, phase2Questions,
  phase3Completed, userName,
}: Props) {
  const total = phase1Score + phase2Score
  const totalMax = phase1Max + phase2Max
  const overallPct = totalMax > 0 ? Math.round((total / totalMax) * 100) : 0
  const passed = overallPct >= 60

  const p1Map = new Map(phase1Questions.map(q => [q.id, q]))
  const p2Map = new Map(phase2Questions.map(q => [q.id, q]))

  return (
    <div className="flex flex-col h-full overflow-y-auto" dir="rtl">
      {/* Header */}
      <div className="text-center mb-8">
        <div
          style={{
            display: 'inline-block', padding: '6px 20px', borderRadius: 20, marginBottom: 12,
            background: passed ? 'rgba(16,185,129,0.15)' : 'rgba(248,113,113,0.15)',
            border: `1px solid ${passed ? 'rgba(16,185,129,0.3)' : 'rgba(248,113,113,0.3)'}`,
            color: passed ? '#10b981' : '#f87171',
            fontSize: 13, fontWeight: 700,
          }}
        >
          {passed ? '✓ ناجح' : '✗ لم ينجح'}
        </div>
        <div style={{ color: '#D7FF00', fontSize: 26, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>
          نتيجة الامتحان
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 4 }}>
          {userName}
        </div>
      </div>

      {/* Score rings */}
      <div className="flex justify-center gap-12 mb-8">
        <ScoreRing score={phase1Score} max={phase1Max} label="المرحلة الأولى" color="#6366f1" />
        <div className="flex flex-col items-center gap-2">
          <div
            style={{
              width: 100, height: 100, borderRadius: '50%',
              border: `4px solid ${overallPct >= 60 ? '#D7FF00' : 'rgba(255,255,255,0.15)'}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ color: '#D7FF00', fontSize: 22, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>
              {overallPct}%
            </span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{total}/{totalMax}</span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600 }}>الإجمالي</span>
        </div>
        <ScoreRing score={phase2Score} max={phase2Max} label="المرحلة الثانية" color="#f59e0b" />
      </div>

      {/* Phase 3 badge */}
      <div className="flex justify-center mb-8">
        <div
          style={{
            padding: '8px 20px', borderRadius: 10, fontSize: 13,
            background: phase3Completed ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
            border: phase3Completed ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.08)',
            color: phase3Completed ? '#10b981' : 'rgba(255,255,255,0.3)',
          }}
        >
          المرحلة الثالثة — محاكاة الكول: {phase3Completed ? '✓ اتكملت' : 'لم تكتمل'}
        </div>
      </div>

      <div className="space-y-6">
        {/* Phase 1 breakdown */}
        <div>
          <h3 style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 12, fontFamily: "'Space Grotesk', sans-serif" }}>
            تفاصيل المرحلة الأولى
          </h3>
          <div className="space-y-2">
            {phase1Results.map((r) => {
              const q = p1Map.get(r.id)
              return (
                <div
                  key={r.id}
                  style={{
                    padding: '12px 16px', borderRadius: 10,
                    background: r.correct ? 'rgba(16,185,129,0.06)' : 'rgba(248,113,113,0.06)',
                    border: r.correct ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(248,113,113,0.2)',
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 1.5 }}>
                        {q?.question ?? r.id}
                      </p>
                      {!r.correct && (
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>
                          الإجابة الصحيحة: <span style={{ color: '#10b981' }}>{r.correctAnswer}</span>
                        </p>
                      )}
                    </div>
                    <span
                      style={{
                        flexShrink: 0, fontWeight: 700, fontSize: 13,
                        color: r.correct ? '#10b981' : '#f87171',
                      }}
                    >
                      {r.pointsEarned}/{r.maxPoints}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Phase 2 breakdown */}
        <div>
          <h3 style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 12, fontFamily: "'Space Grotesk', sans-serif" }}>
            تفاصيل المرحلة الثانية
          </h3>
          <div className="space-y-2">
            {phase2Results.map((r) => {
              const q = p2Map.get(r.id)
              return (
                <div
                  key={r.id}
                  style={{
                    padding: '12px 16px', borderRadius: 10,
                    background: r.correct ? 'rgba(16,185,129,0.06)' : 'rgba(248,113,113,0.06)',
                    border: r.correct ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(248,113,113,0.2)',
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 1.5 }}>
                        {q?.scenario ?? r.id}
                      </p>
                      {!r.correct && (
                        <div>
                          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>
                            الإجابة الصحيحة: <span style={{ color: '#10b981' }}>{r.correctAnswer}</span>
                          </p>
                          {r.reasoning && (
                            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2, lineHeight: 1.5 }}>
                              {r.reasoning}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <span style={{ flexShrink: 0, fontWeight: 700, fontSize: 13, color: r.correct ? '#10b981' : '#f87171' }}>
                      {r.pointsEarned}/{r.maxPoints}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
