'use client'

import { useState } from 'react'
import type { ExamReportData, ReportSummary } from '@/lib/report-generator'

interface QuestionDetail {
  id: string
  correct: boolean
  pointsEarned: number
  correctAnswer: string
  maxPoints: number
  questionText?: string
  userAnswer?: string
  reasoning?: string
}

interface ExamResult {
  id: string
  phase1_score: number
  phase1_max: number
  phase2_score: number
  phase2_max: number
  phase3_completed: boolean
  phase1_details?: QuestionDetail[]
  phase2_details?: QuestionDetail[]
  created_at: string
}

function DetailsModal({ result, onClose }: { result: ExamResult; onClose: () => void }) {
  const [tab, setTab] = useState<'p1' | 'p2'>('p1')

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16,
          width: '100%', maxWidth: 760, maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#D7FF00', fontWeight: 700, fontSize: 16 }}>تفاصيل الاختبار</div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>
              {new Date(result.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'rgba(255,255,255,0.4)', fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', gap: 4, padding: '12px 24px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {([['p1', `المرحلة الأولى (${result.phase1_score}/${result.phase1_max})`], ['p2', `المرحلة الثانية (${result.phase2_score}/${result.phase2_max})`]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: '8px 16px', borderRadius: '8px 8px 0 0', fontSize: 13, fontWeight: 600,
                border: 'none', cursor: 'pointer',
                background: tab === key ? 'rgba(215,255,0,0.1)' : 'transparent',
                color: tab === key ? '#D7FF00' : 'rgba(255,255,255,0.4)',
                borderBottom: tab === key ? '2px solid #D7FF00' : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }} dir="rtl">
          {tab === 'p1' && (
            <div className="space-y-3">
              {!result.phase1_details?.length && (
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>لا توجد تفاصيل محفوظة لهذا الاختبار.</p>
              )}
              {result.phase1_details?.map((q, i) => (
                <div
                  key={q.id}
                  style={{
                    padding: '14px 16px', borderRadius: 10,
                    background: q.correct ? 'rgba(16,185,129,0.06)' : 'rgba(248,113,113,0.06)',
                    border: `1px solid ${q.correct ? 'rgba(16,185,129,0.2)' : 'rgba(248,113,113,0.2)'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginBottom: 4, fontFamily: 'monospace' }}>س{i + 1}</p>
                      <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>
                        {q.questionText ?? q.id}
                      </p>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                          إجابتك: <span style={{ color: q.correct ? '#10b981' : '#f87171', fontWeight: 600 }}>{q.userAnswer || '—'}</span>
                        </span>
                        {!q.correct && (
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                            الإجابة الصحيحة: <span style={{ color: '#10b981', fontWeight: 600 }}>{q.correctAnswer}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: q.correct ? '#10b981' : '#f87171' }}>
                      {q.pointsEarned}/{q.maxPoints}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'p2' && (
            <div className="space-y-3">
              {!result.phase2_details?.length && (
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>لا توجد تفاصيل محفوظة لهذا الاختبار.</p>
              )}
              {result.phase2_details?.map((q, i) => (
                <div
                  key={q.id}
                  style={{
                    padding: '14px 16px', borderRadius: 10,
                    background: q.correct ? 'rgba(16,185,129,0.06)' : 'rgba(248,113,113,0.06)',
                    border: `1px solid ${q.correct ? 'rgba(16,185,129,0.2)' : 'rgba(248,113,113,0.2)'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginBottom: 4, fontFamily: 'monospace' }}>س{i + 1}</p>
                      <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>
                        {q.questionText ?? q.id}
                      </p>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: q.reasoning && !q.correct ? 6 : 0 }}>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                          إجابتك: <span style={{ color: q.correct ? '#10b981' : '#f87171', fontWeight: 600 }}>{q.userAnswer || '—'}</span>
                        </span>
                        {!q.correct && (
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                            الإجابة الصحيحة: <span style={{ color: '#10b981', fontWeight: 600 }}>{q.correctAnswer}</span>
                          </span>
                        )}
                      </div>
                      {!q.correct && q.reasoning && (
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, lineHeight: 1.6, marginTop: 4 }}>
                          {q.reasoning}
                        </p>
                      )}
                    </div>
                    <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: q.correct ? '#10b981' : '#f87171' }}>
                      {q.correct ? '✓' : '✗'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AudioPlayer({ resultId }: { resultId: string }) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)

  async function loadAudio() {
    if (loaded) return
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/exam/user-audio-url?resultId=${resultId}`)
      if (!res.ok) { setError(true); return }
      const { signedUrl } = await res.json()
      setAudioUrl(signedUrl)
      setLoaded(true)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  if (error) {
    return <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>لا يوجد تسجيل</span>
  }

  if (!loaded) {
    return (
      <button
        onClick={loadAudio}
        disabled={loading}
        style={{
          fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
          background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
          border: '1px solid rgba(255,255,255,0.12)', cursor: loading ? 'default' : 'pointer',
          transition: 'all 0.15s',
        }}
      >
        {loading ? '...' : '▶ تشغيل المكالمة'}
      </button>
    )
  }

  return (
    <audio
      src={audioUrl ?? undefined}
      controls
      style={{ height: 28, maxWidth: 220, filter: 'invert(1) brightness(0.7)' }}
    />
  )
}

function DownloadButton({ result, userName }: { result: ExamResult; userName: string }) {
  const [open, setOpen] = useState(false)
  const [generating, setGenerating] = useState(false)

  async function download(format: 'pdf' | 'word') {
    setOpen(false)
    setGenerating(true)
    try {
      const res = await fetch('/api/exam/generate-report-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase1_details: result.phase1_details,
          phase2_details: result.phase2_details,
          phase1_score: result.phase1_score,
          phase1_max: result.phase1_max,
          phase2_score: result.phase2_score,
          phase2_max: result.phase2_max,
          userName,
        }),
      })
      const summary: ReportSummary = await res.json()
      const reportData: ExamReportData = result as ExamReportData

      if (format === 'pdf') {
        const { generatePDF } = await import('@/lib/report-generator')
        await generatePDF(reportData, userName, summary)
      } else {
        const { generateWord } = await import('@/lib/report-generator')
        await generateWord(reportData, userName, summary)
      }
    } catch (e) {
      console.error('Report generation failed', e)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={generating}
        style={{
          fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 6,
          background: generating ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)',
          color: generating ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.6)',
          border: '1px solid rgba(255,255,255,0.12)', cursor: generating ? 'default' : 'pointer',
          transition: 'all 0.15s',
        }}
      >
        {generating ? 'جاري التوليد…' : 'تنزيل التقرير ↓'}
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div
            style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50,
              background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8, overflow: 'hidden', minWidth: 130,
            }}
          >
            {([['pdf', '📄 PDF'], ['word', '📝 Word']] as const).map(([fmt, label]) => (
              <button
                key={fmt}
                onClick={() => download(fmt)}
                style={{
                  display: 'block', width: '100%', textAlign: 'right',
                  padding: '10px 14px', fontSize: 12, fontWeight: 600,
                  color: 'rgba(255,255,255,0.7)', background: 'none',
                  border: 'none', cursor: 'pointer',
                  transition: 'background 0.1s',
                  fontFamily: "'Montserrat', sans-serif",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function UserExamResultsTab({ results, userName }: { results: ExamResult[]; userName: string }) {
  const [selected, setSelected] = useState<ExamResult | null>(null)

  if (results.length === 0) {
    return (
      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '64px 24px', gap: 16, textAlign: 'center',
        }}
        dir="rtl"
      >
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
        }}>
          📋
        </div>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, maxWidth: 320, lineHeight: 1.7 }}>
          لم تُكمل أي اختبار بعد. بعد إنهاء الاختبار ستظهر نتائجك هنا.
        </p>
      </div>
    )
  }

  return (
    <>
      {selected && <DetailsModal result={selected} onClose={() => setSelected(null)} />}

      <div dir="rtl">
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 16 }}>
          {results.length} {results.length === 1 ? 'اختبار مكتمل' : 'اختبارات مكتملة'}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['المرحلة الأولى', 'المرحلة الثانية', 'الإجمالي', 'النتيجة', 'التاريخ', 'التفاصيل', 'المكالمة', 'تنزيل'].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}
                  >
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
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'right' }}>
                      {r.phase1_score}/{r.phase1_max}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'right' }}>
                      {r.phase2_score}/{r.phase2_max}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#D7FF00', fontWeight: 700, textAlign: 'right' }}>
                      {total}/{max} <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400, fontSize: 11 }}>({pct}%)</span>
                    </td>
                    <td className="px-4 py-3" style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                          background: passed ? 'rgba(16,185,129,0.15)' : 'rgba(248,113,113,0.15)',
                          color: passed ? '#10b981' : '#f87171',
                          border: `1px solid ${passed ? 'rgba(16,185,129,0.3)' : 'rgba(248,113,113,0.3)'}`,
                        }}
                      >
                        {passed ? 'ناجح' : 'راسب'}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'right' }}>
                      {new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3" style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => setSelected(r)}
                        style={{
                          fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 6,
                          background: 'rgba(215,255,0,0.08)', color: '#D7FF00',
                          border: '1px solid rgba(215,255,0,0.2)', cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(215,255,0,0.15)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(215,255,0,0.08)')}
                      >
                        عرض التفاصيل
                      </button>
                    </td>
                    <td className="px-4 py-3" style={{ textAlign: 'right' }}>
                      {r.phase3_completed
                        ? <AudioPlayer resultId={r.id} />
                        : <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>—</span>
                      }
                    </td>
                    <td className="px-4 py-3" style={{ textAlign: 'right' }}>
                      <DownloadButton result={r} userName={userName} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
