'use client'

interface ExamResult {
  id: string
  user_name: string
  phase1_score: number
  phase1_max: number
  phase2_score: number
  phase2_max: number
  phase3_completed: boolean
  created_at: string
}

export default function ExamResultsTable({ results }: { results: ExamResult[] }) {
  if (results.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-gray-500 text-sm">
        No exam results yet.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['Name', 'Phase 1', 'Phase 2', 'Phase 3', 'Total', 'Result', 'Date'].map(h => (
              <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((r) => {
            const total = r.phase1_score + r.phase2_score
            const max = r.phase1_max + r.phase2_max
            const pct = max > 0 ? Math.round((total / max) * 100) : 0
            const passed = pct >= 60

            return (
              <tr
                key={r.id}
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
              >
                <td className="px-5 py-3 text-white font-medium">{r.user_name}</td>
                <td className="px-5 py-3" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {r.phase1_score}/{r.phase1_max}
                </td>
                <td className="px-5 py-3" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {r.phase2_score}/{r.phase2_max}
                </td>
                <td className="px-5 py-3">
                  <span style={{ color: r.phase3_completed ? '#10b981' : 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                    {r.phase3_completed ? '✓' : '—'}
                  </span>
                </td>
                <td className="px-5 py-3" style={{ color: '#D7FF00', fontWeight: 700 }}>
                  {total}/{max} <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400, fontSize: 11 }}>({pct}%)</span>
                </td>
                <td className="px-5 py-3">
                  <span
                    style={{
                      padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: passed ? 'rgba(16,185,129,0.15)' : 'rgba(248,113,113,0.15)',
                      color: passed ? '#10b981' : '#f87171',
                      border: `1px solid ${passed ? 'rgba(16,185,129,0.3)' : 'rgba(248,113,113,0.3)'}`,
                    }}
                  >
                    {passed ? 'Pass' : 'Fail'}
                  </span>
                </td>
                <td className="px-5 py-3" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                  {new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
