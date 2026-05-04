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
  user_name: string
  phase1_score: number
  phase1_max: number
  phase2_score: number
  phase2_max: number
  phase3_completed: boolean
  phase1_details?: QuestionDetail[]
  phase2_details?: QuestionDetail[]
  created_at: string
  report_downloaded_at?: string | null
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
        {/* Modal header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#D7FF00', fontWeight: 700, fontSize: 16 }}>{result.user_name}</div>
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

        {/* Tabs */}
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

        {/* Content */}
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
                      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginBottom: 4, fontFamily: 'monospace' }}>
                        س{i + 1}
                      </p>
                      <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>
                        {q.questionText ?? q.id}
                      </p>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                          إجابة المتقدم: <span style={{ color: q.correct ? '#10b981' : '#f87171', fontWeight: 600 }}>{q.userAnswer || '—'}</span>
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
                      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginBottom: 4, fontFamily: 'monospace' }}>
                        س{i + 1}
                      </p>
                      <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>
                        {q.questionText ?? q.id}
                      </p>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: q.reasoning && !q.correct ? 6 : 0 }}>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                          إجابة المتقدم: <span style={{ color: q.correct ? '#10b981' : '#f87171', fontWeight: 600 }}>{q.userAnswer || '—'}</span>
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

function DownloadButton({ result }: { result: ExamResult }) {
  const [generating, setGenerating] = useState(false)
  const [downloaded, setDownloaded] = useState(!!result.report_downloaded_at)

  if (downloaded) {
    return (
      <span style={{
        fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 6,
        background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.2)',
        border: '1px solid rgba(255,255,255,0.07)', display: 'inline-block',
      }}>
        تم التحميل
      </span>
    )
  }

  async function download() {
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
          userName: result.user_name,
        }),
      })
      const summary: ReportSummary = await res.json()
      const reportData = result as unknown as ExamReportData
      const { generateWord } = await import('@/lib/report-generator')
      await generateWord(reportData, result.user_name, summary)
      await fetch('/api/exam/mark-downloaded', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultId: result.id }),
      })
      setDownloaded(true)
    } catch (e) {
      console.error('Report generation failed', e)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <button
      onClick={download}
      disabled={generating}
      style={{
        fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 6,
        background: generating ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)',
        color: generating ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.5)',
        border: '1px solid rgba(255,255,255,0.1)', cursor: generating ? 'default' : 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {generating ? '...' : '↓ تقرير'}
    </button>
  )
}

export default function ExamResultsTable({ results }: { results: ExamResult[] }) {
  const [selected, setSelected] = useState<ExamResult | null>(null)

  if (results.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-gray-500 text-sm">
        No exam results yet.
      </div>
    )
  }

  return (
    <>
      {selected && <DetailsModal result={selected} onClose={() => setSelected(null)} />}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Name', 'Phase 1', 'Phase 2', 'Phase 3', 'Total', 'Result', 'Date', '', ''].map((h, i) => (
                <th key={i} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>
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
                  <td className="px-5 py-3">
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
                  <td className="px-5 py-3">
                    <DownloadButton result={r} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
