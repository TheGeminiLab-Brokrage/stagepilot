'use client'

import { useState } from 'react'
import { useT } from '@/lib/language-context'

interface PracticeSession {
  id: string
  scenario_id: string
  audio_path: string
  duration_seconds: number | null
  created_at: string
  profiles: {
    full_name: string
  } | null
}

const SCENARIO_LABELS: Record<string, string> = {
  dr_yasmine: 'Dr. Yasmine — Cold Call',
  eng_khaled: 'Eng. Khaled — Objection Handling',
  mrs_nadia: 'Mrs. Nadia — Investment Buyer',
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

export default function PracticeSessionsTable({ sessions }: { sessions: PracticeSession[] }) {
  const [playingSession, setPlayingSession] = useState<string | null>(null)
  const [loadingSession, setLoadingSession] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string>('')
  const t = useT()

  async function playSession(sessionId: string) {
    if (playingSession === sessionId) {
      setPlayingSession(null)
      setAudioUrl('')
      return
    }

    setLoadingSession(sessionId)
    try {
      const res = await fetch(`/api/practice-audio-url?sessionId=${sessionId}`)
      if (!res.ok) {
        console.error('Failed to fetch audio URL')
        setLoadingSession(null)
        return
      }
      const { signedUrl } = await res.json()
      setAudioUrl(signedUrl)
      setPlayingSession(sessionId)
    } catch (e) {
      console.error('Error fetching audio URL:', e)
    } finally {
      setLoadingSession(null)
    }
  }

  if (sessions.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 19V5m6 14V7m-9 8h12" />
        </svg>
        <p className="text-sm">No practice sessions yet.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[rgba(215,255,0,0.12)] text-xs uppercase tracking-wide" style={{ color: 'rgba(215,255,0,0.4)' }}>
            <th className="text-left px-4 py-3">{t('adminColTrainee')}</th>
            <th className="text-left px-4 py-3">{t('adminColScenario')}</th>
            <th className="text-left px-4 py-3">{t('adminColDate')}</th>
            <th className="text-left px-4 py-3">{t('adminColTime')}</th>
            <th className="text-left px-4 py-3">{t('adminColDuration')}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.id} className="border-b border-[rgba(215,255,0,0.06)] hover:bg-[rgba(215,255,0,0.04)] transition-colors">
              <td className="px-4 py-3 text-white font-medium">
                {session.profiles?.full_name || '—'}
              </td>
              <td className="px-4 py-3 text-gray-300">
                {SCENARIO_LABELS[session.scenario_id] || session.scenario_id}
              </td>
              <td className="px-4 py-3 text-gray-400">
                {formatDate(session.created_at)}
              </td>
              <td className="px-4 py-3 text-gray-400">
                {formatTime(session.created_at)}
              </td>
              <td className="px-4 py-3 text-gray-400 font-mono">
                {formatDuration(session.duration_seconds)}
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => playSession(session.id)}
                  disabled={loadingSession === session.id}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[rgba(215,255,0,0.08)] hover:bg-[#D7FF00] text-[#D7FF00] hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={playingSession === session.id ? 'Stop playback' : 'Play recording'}
                >
                  {loadingSession === session.id ? (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                      <circle cx="12" cy="12" r="8" />
                    </svg>
                  ) : playingSession === session.id ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="4" y="4" width="16" height="16" rx="2" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Audio player (hidden, only for playback) */}
      {audioUrl && (
        <div className="px-4 py-4 border-t border-gray-800/50 bg-gray-800/10">
          <audio
            key={audioUrl}
            autoPlay
            controls
            onEnded={() => { setPlayingSession(null); setAudioUrl('') }}
            className="w-full h-10"
          >
            <source src={audioUrl} type="audio/wav" />
            Your browser does not support the audio element.
          </audio>
        </div>
      )}
    </div>
  )
}
