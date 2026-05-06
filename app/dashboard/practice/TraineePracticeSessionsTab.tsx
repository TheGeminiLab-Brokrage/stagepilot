'use client'

import { useState } from 'react'

interface CriterionGrade { score: number; max: number; feedback: string }

interface CallGrade {
  total_score: number
  ice_breaking: CriterionGrade
  discovery_questions: CriterionGrade
  unit_recommendation: CriterionGrade
  action_taking: CriterionGrade
  overall_feedback: string
  graded_at: string
}

export interface PracticeSessionRow {
  id: string
  scenario_id: string
  audio_path: string
  duration_seconds: number | null
  created_at: string
  call_grade?: CallGrade | null
}

const CRITERIA_LABELS: Record<keyof Omit<CallGrade, 'total_score' | 'overall_feedback' | 'graded_at'>, string> = {
  ice_breaking: 'كسر الجليد',
  discovery_questions: 'أسئلة الاستكشاف',
  unit_recommendation: 'توصية الوحدة',
  action_taking: 'اتخاذ الإجراء',
}

function GradeModal({ grade, onClose }: { grade: CallGrade; onClose: () => void }) {
  const criteria = (['ice_breaking', 'discovery_questions', 'unit_recommendation', 'action_taking'] as const)
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#D7FF00', fontWeight: 700, fontSize: 16 }}>تقييم المكالمة</div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>الدرجة الإجمالية: {grade.total_score}/100</div>
          </div>
          <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.4)', fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }} dir="rtl">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {criteria.map(key => {
              const c = grade[key]
              const pct = Math.round((c.score / c.max) * 100)
              const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#f87171'
              return (
                <div key={key} style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{CRITERIA_LABELS[key]}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color }}>{c.score}/{c.max}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', marginBottom: 10 }}>
                    <div style={{ height: '100%', borderRadius: 2, background: color, width: `${pct}%`, transition: 'width 0.4s ease' }} />
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 1.7, margin: 0 }}>{c.feedback}</p>
                </div>
              )
            })}
          </div>
          {grade.overall_feedback && (
            <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(215,255,0,0.04)', border: '1px solid rgba(215,255,0,0.15)' }}>
              <div style={{ color: '#D7FF00', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>التقييم العام</div>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.8, margin: 0 }}>{grade.overall_feedback}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const EDUCATIONAL_SCENARIO_IDS = new Set(['mohammed_tgl', 'mohammed_madinet_masr', 'mona_hassan'])

function CallGradeCell({ grade, scenarioId }: { grade?: CallGrade | null; scenarioId: string }) {
  const [open, setOpen] = useState(false)
  if (!grade) {
    if (EDUCATIONAL_SCENARIO_IDS.has(scenarioId)) {
      return <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>—</span>
    }
    return <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>جاري التحليل...</span>
  }
  const color = grade.total_score >= 70 ? '#10b981' : grade.total_score >= 40 ? '#f59e0b' : '#f87171'
  return (
    <>
      {open && <GradeModal grade={grade} onClose={() => setOpen(false)} />}
      <button
        onClick={() => setOpen(true)}
        style={{
          fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
          background: `rgba(${color === '#10b981' ? '16,185,129' : color === '#f59e0b' ? '245,158,11' : '248,113,113'},0.12)`,
          color, border: `1px solid ${color}33`, cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        {grade.total_score}/100
      </button>
    </>
  )
}

interface Props {
  sessions: PracticeSessionRow[]
  scenarioLabels: Record<string, string>
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds === 0) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export default function TraineePracticeSessionsTab({ sessions, scenarioLabels }: Props) {
  const [playingSession, setPlayingSession] = useState<string | null>(null)
  const [loadingSession, setLoadingSession] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string>('')
  const [errorRows, setErrorRows] = useState<Set<string>>(new Set())

  async function playSession(sessionId: string) {
    if (playingSession === sessionId) {
      setPlayingSession(null)
      setAudioUrl('')
      return
    }

    setLoadingSession(sessionId)
    setErrorRows(prev => { const s = new Set(prev); s.delete(sessionId); return s })
    try {
      const res = await fetch(`/api/practice-audio-url?sessionId=${sessionId}`)
      if (!res.ok) {
        setErrorRows(prev => new Set(prev).add(sessionId))
        setLoadingSession(null)
        return
      }
      const { signedUrl } = await res.json()
      setAudioUrl(signedUrl)
      setPlayingSession(sessionId)
    } catch {
      setErrorRows(prev => new Set(prev).add(sessionId))
    } finally {
      setLoadingSession(null)
    }
  }

  if (sessions.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px 24px',
          gap: 16,
          textAlign: 'center',
        }}
        dir="rtl"
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'rgba(215,255,0,0.06)',
            border: '1px solid rgba(215,255,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(215,255,0,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, lineHeight: 1.6, maxWidth: 280 }}>
          لم تُسجَّل أي جلسات تدريب بعد.<br />ابدأ جلسة تدريب لتظهر هنا.
        </p>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'Montserrat', sans-serif" }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }} dir="rtl">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['السيناريو', 'التاريخ', 'الوقت', 'المدة', 'الدرجة', ''].map((h, i) => (
                <th
                  key={i}
                  style={{
                    padding: '10px 16px',
                    textAlign: 'right',
                    color: 'rgba(255,255,255,0.3)',
                    fontWeight: 700,
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr
                key={session.id}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
                  {scenarioLabels[session.scenario_id] ?? session.scenario_id}
                </td>
                <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
                  {formatDate(session.created_at)}
                </td>
                <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
                  {formatTime(session.created_at)}
                </td>
                <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {formatDuration(session.duration_seconds)}
                </td>
                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                  <CallGradeCell grade={session.call_grade} scenarioId={session.scenario_id} />
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'left' }}>
                  {errorRows.has(session.id) ? (
                    <span style={{ fontSize: 11, color: 'rgba(255,80,80,0.7)' }}>غير متاح</span>
                  ) : (
                    <button
                      onClick={() => playSession(session.id)}
                      disabled={loadingSession === session.id}
                      title={playingSession === session.id ? 'إيقاف التشغيل' : 'تشغيل التسجيل'}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        border: 'none',
                        cursor: loadingSession === session.id ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: playingSession === session.id
                          ? 'rgba(215,255,0,0.15)'
                          : 'rgba(255,255,255,0.06)',
                        color: playingSession === session.id ? '#D7FF00' : 'rgba(255,255,255,0.5)',
                        transition: 'all 0.15s',
                        opacity: loadingSession === session.id ? 0.5 : 1,
                      }}
                      onMouseEnter={e => {
                        if (loadingSession !== session.id) {
                          const btn = e.currentTarget as HTMLButtonElement
                          btn.style.background = 'rgba(215,255,0,0.15)'
                          btn.style.color = '#D7FF00'
                        }
                      }}
                      onMouseLeave={e => {
                        const btn = e.currentTarget as HTMLButtonElement
                        if (playingSession === session.id) return
                        btn.style.background = 'rgba(255,255,255,0.06)'
                        btn.style.color = 'rgba(255,255,255,0.5)'
                      }}
                    >
                      {loadingSession === session.id ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                          <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                          <circle cx="12" cy="12" r="8" strokeOpacity="0.3" />
                        </svg>
                      ) : playingSession === session.id ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="4" y="4" width="16" height="16" rx="2" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {audioUrl && (
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(215,255,0,0.03)',
          }}
        >
          <audio
            key={audioUrl}
            autoPlay
            controls
            onEnded={() => { setPlayingSession(null); setAudioUrl('') }}
            style={{ width: '100%', height: 36, accentColor: '#D7FF00' }}
          >
            <source src={audioUrl} type="audio/mpeg" />
          </audio>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
