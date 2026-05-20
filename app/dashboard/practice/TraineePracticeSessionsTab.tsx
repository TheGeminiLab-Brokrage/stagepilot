'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/language-context'

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
  whatsapp_messages?: string[] | null
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

function WhatsAppMessagesModal({ messages, date, onClose }: { messages: string[]; date: string; onClose: () => void }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 420, borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: '#075E54', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#128C7E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, color: '#fff', flexShrink: 0, fontFamily: 'system-ui, sans-serif' }}>
            ه
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 15, fontFamily: 'system-ui, sans-serif' }}>هشام</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: 'system-ui, sans-serif' }}>{date}</div>
          </div>
          <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {/* Chat area */}
        <div style={{ background: '#ECE5DD', flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ textAlign: 'center', margin: '4px 0 8px' }}>
            <span style={{ background: 'rgba(0,0,0,0.11)', color: 'rgba(0,0,0,0.45)', fontSize: 11, padding: '4px 14px', borderRadius: 20, fontFamily: 'system-ui, sans-serif' }}>
              رسائل الواتساب بعد المكالمة
            </span>
          </div>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ background: '#DCF8C6', borderRadius: '12px 12px 4px 12px', padding: '7px 10px', maxWidth: '82%', fontSize: 14, color: '#111', boxShadow: '0 1px 2px rgba(0,0,0,0.12)', direction: 'rtl', lineHeight: 1.5, fontFamily: 'system-ui, sans-serif', wordBreak: 'break-word' }}>
                {msg}
                <span style={{ fontSize: 10, color: 'rgba(0,0,0,0.38)', marginRight: 6, display: 'inline-block', verticalAlign: 'bottom' }}>✓✓</span>
              </div>
            </div>
          ))}
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
  const [whatsAppSession, setWhatsAppSession] = useState<{ messages: string[]; date: string } | null>(null)
  const { lang } = useLanguage()
  const isAr = lang === 'ar'

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
        dir={isAr ? 'rtl' : 'ltr'}
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
          {isAr
            ? <>لم تُسجَّل أي جلسات تدريب بعد.<br />ابدأ جلسة تدريب لتظهر هنا.</>
            : <>No practice sessions recorded yet.<br />Start a practice session to see it here.</>}
        </p>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'Montserrat', sans-serif" }}>
      {whatsAppSession && (
        <WhatsAppMessagesModal
          messages={whatsAppSession.messages}
          date={whatsAppSession.date}
          onClose={() => setWhatsAppSession(null)}
        />
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }} dir="rtl">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['السيناريو', 'التاريخ', 'الوقت', 'المدة', 'الدرجة', 'واتساب', ''].map((h, i) => (
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
                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                  {session.scenario_id === 'hesham' && session.whatsapp_messages?.length ? (
                    <button
                      onClick={() => setWhatsAppSession({ messages: session.whatsapp_messages!, date: formatDate(session.created_at) })}
                      title="عرض رسائل الواتساب"
                      style={{ width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(37,211,102,0.15)', color: '#25D366', transition: 'all 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(37,211,102,0.28)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(37,211,102,0.15)' }}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>—</span>
                  )}
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
