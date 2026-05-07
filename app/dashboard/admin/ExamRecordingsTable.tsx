'use client'

import { useState } from 'react'
import { useT } from '@/lib/language-context'

interface ExamRecording {
  id: string
  audio_path: string
  duration_seconds: number | null
  created_at: string
  profiles: {
    full_name: string
  } | null
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

export default function ExamRecordingsTable({ recordings }: { recordings: ExamRecording[] }) {
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string>('')
  const t = useT()

  async function playRecording(recordingId: string) {
    if (playingId === recordingId) {
      setPlayingId(null)
      setAudioUrl('')
      return
    }

    setLoadingId(recordingId)
    try {
      const res = await fetch(`/api/exam-audio-url?recordingId=${recordingId}`)
      if (!res.ok) {
        console.error('Failed to fetch exam audio URL')
        setLoadingId(null)
        return
      }
      const { signedUrl } = await res.json()
      setAudioUrl(signedUrl)
      setPlayingId(recordingId)
    } catch (e) {
      console.error('Error fetching exam audio URL:', e)
    } finally {
      setLoadingId(null)
    }
  }

  if (recordings.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 19V5m6 14V7m-9 8h12" />
        </svg>
        <p className="text-sm">No admin AI test recordings yet.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[rgba(215,255,0,0.12)] text-xs uppercase tracking-wide" style={{ color: 'rgba(215,255,0,0.4)' }}>
            <th className="text-left px-4 py-3">{t('adminColAdmin')}</th>
            <th className="text-left px-4 py-3">{t('adminColDate')}</th>
            <th className="text-left px-4 py-3">{t('adminColTime')}</th>
            <th className="text-left px-4 py-3">{t('adminColDuration')}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {recordings.map((rec) => (
            <tr key={rec.id} className="border-b border-[rgba(215,255,0,0.06)] hover:bg-[rgba(215,255,0,0.04)] transition-colors">
              <td className="px-4 py-3 text-white font-medium">
                {rec.profiles?.full_name || '—'}
              </td>
              <td className="px-4 py-3 text-gray-400">
                {formatDate(rec.created_at)}
              </td>
              <td className="px-4 py-3 text-gray-400">
                {formatTime(rec.created_at)}
              </td>
              <td className="px-4 py-3 text-gray-400 font-mono">
                {formatDuration(rec.duration_seconds)}
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => playRecording(rec.id)}
                  disabled={loadingId === rec.id}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[rgba(215,255,0,0.08)] hover:bg-[#D7FF00] text-[#D7FF00] hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={playingId === rec.id ? 'Stop playback' : 'Play recording'}
                >
                  {loadingId === rec.id ? (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                      <circle cx="12" cy="12" r="8" />
                    </svg>
                  ) : playingId === rec.id ? (
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

      {audioUrl && (
        <div className="px-4 py-4 border-t border-[rgba(215,255,0,0.12)] bg-[rgba(215,255,0,0.03)]">
          <audio
            key={audioUrl}
            autoPlay
            controls
            onEnded={() => { setPlayingId(null); setAudioUrl('') }}
            className="w-full h-10"
          >
            <source src={audioUrl} type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
        </div>
      )}
    </div>
  )
}
