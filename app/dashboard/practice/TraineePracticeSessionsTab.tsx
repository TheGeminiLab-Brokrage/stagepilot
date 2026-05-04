'use client'

import { useState } from 'react'

export interface PracticeSessionRow {
  id: string
  scenario_id: string
  audio_path: string
  duration_seconds: number | null
  created_at: string
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
              {['السيناريو', 'التاريخ', 'الوقت', 'المدة', ''].map((h, i) => (
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
