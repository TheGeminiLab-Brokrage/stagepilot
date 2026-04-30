'use client'

interface Props {
  phase1Score: number
  phase1Max: number
  phase1Results: unknown[]
  phase1Questions: unknown[]
  phase2Score: number
  phase2Max: number
  phase2Results: unknown[]
  phase2Questions: unknown[]
  phase3Completed: boolean
  userName: string
  onReset: () => void
}

export default function ExamResults({ userName, onReset }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8" dir="rtl">
      <div
        style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(16,185,129,0.15)',
          border: '2px solid rgba(16,185,129,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36,
        }}
      >
        ✓
      </div>

      <div className="text-center space-y-3">
        <div style={{ color: '#D7FF00', fontSize: 26, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>
          تم إنهاء الاختبار
        </div>
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15 }}>
          {userName}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, maxWidth: 400, lineHeight: 1.7 }}>
          شكراً! تم تسجيل إجاباتك بنجاح. سيتم مراجعة نتيجتك من قِبل الإدارة وسيتم إبلاغك بها.
        </div>
      </div>

      <button
        onClick={onReset}
        style={{
          background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)',
          border: '1px solid rgba(255,255,255,0.12)', fontWeight: 700, borderRadius: 10,
          padding: '12px 36px', fontSize: 14, cursor: 'pointer', transition: 'all 0.15s',
          marginTop: 16,
        }}
        onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)'; (e.target as HTMLButtonElement).style.color = '#fff' }}
        onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; (e.target as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)' }}
      >
        إعادة الامتحان من البداية ↺
      </button>
    </div>
  )
}
