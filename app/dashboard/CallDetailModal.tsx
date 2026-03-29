'use client'

import { useEffect, useState } from 'react'

const STAGE_COLORS: Record<string, string> = {
  'interested / follow up': 'bg-blue-500/20 text-blue-300',
  'potential to close': 'bg-purple-500/20 text-purple-300',
  'meeting scheduled': 'bg-yellow-500/20 text-yellow-300',
  'meeting done': 'bg-orange-500/20 text-orange-300',
  'done deal': 'bg-green-500/20 text-green-300',
  'not interested': 'bg-red-500/20 text-red-300',
  'low budget': 'bg-gray-500/20 text-gray-400',
}

type TripleC = {
  clear_need?: { met: boolean; detail: string }
  clear_budget?: { met: boolean; detail: string }
  clear_path?: { met: boolean; detail: string }
}

type Call = {
  id: string
  client_name: string | null
  client_phone: string | null
  campaign: string | null
  stage: string | null
  stage_corrected: string | null
  agent_stage: string | null
  audio_url: string | null
  reasoning: string | null
  transcript_summary: string | null
  pain_points: string | null
  triple_c: TripleC | null
  agent_feedback: string | null
  file_name: string
}

export default function CallDetailModal({
  call,
  isLeader,
  onClose,
}: {
  call: Call
  isLeader: boolean
  onClose: () => void
}) {
  const stage = call.stage_corrected ?? call.stage
  const stageBadge = stage ? (STAGE_COLORS[stage] ?? 'bg-gray-700 text-gray-300') : ''

  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioError, setAudioError] = useState('')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function loadAudio() {
    setAudioLoading(true)
    setAudioError('')
    const res = await fetch(`/api/audio-url?callRecordId=${call.id}`)
    if (!res.ok) {
      setAudioError('Could not load recording.')
      setAudioLoading(false)
      return
    }
    const { signedUrl } = await res.json()
    setAudioUrl(signedUrl)
    setAudioLoading(false)
  }

  const tripleC = call.triple_c
  const tripleCItems = tripleC ? [
    { key: 'clear_need', label: 'Clear Need', description: 'Did the prospect articulate a specific pain point?', data: tripleC.clear_need },
    { key: 'clear_budget', label: 'Clear Budget', description: 'Was budget or willingness to invest confirmed?', data: tripleC.clear_budget },
    { key: 'clear_path', label: 'Clear Path', description: 'Were decision-makers and sign-off process identified?', data: tripleC.clear_path },
  ] : []

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-800">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-white font-semibold text-lg">{call.client_name ?? 'Unknown Client'}</h2>
              {call.client_phone && <span className="text-gray-500 text-sm">{call.client_phone}</span>}
              {stage && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stageBadge}`}>
                  {stage}
                  {call.stage_corrected && call.stage && call.stage_corrected !== call.stage && (
                    <span className="ml-1 text-gray-500">(was: {call.stage})</span>
                  )}
                </span>
              )}
              {call.agent_stage && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <span>Agent:</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[call.agent_stage] ?? 'bg-gray-700 text-gray-300'}`}>
                    {call.agent_stage}
                  </span>
                </span>
              )}
            </div>
            {call.campaign && <p className="text-gray-500 text-sm mt-0.5">Campaign: {call.campaign}</p>}
            <p className="text-gray-600 text-xs mt-0.5 truncate max-w-xs">{call.file_name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-white transition-colors text-xl leading-none ml-4 mt-0.5"
          >×</button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Audio Player — team leaders and admins only */}
          {isLeader && call.audio_url && (
            <Section title="Call Recording">
              {audioUrl ? (
                <audio controls src={audioUrl} className="w-full h-10 accent-blue-500" />
              ) : (
                <button
                  onClick={loadAudio}
                  disabled={audioLoading}
                  className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
                >
                  {audioLoading ? 'Loading…' : '▶ Load Recording'}
                </button>
              )}
              {audioError && <p className="text-red-400 text-xs mt-1">{audioError}</p>}
            </Section>
          )}

          {/* Summary */}
          <Section title="Summary">
            {call.transcript_summary
              ? <p className="text-gray-300 text-sm leading-relaxed">{call.transcript_summary}</p>
              : <p className="text-gray-600 text-sm italic">Analysis not available</p>}
          </Section>

          {/* Triple C */}
          <Section title="Triple C Analysis">
            {tripleCItems.length > 0 ? (
              <div className="space-y-3">
                {tripleCItems.map(({ key, label, description, data }) => (
                  <div key={key} className="flex gap-3">
                    <div className="mt-0.5 shrink-0">
                      {data?.met
                        ? <span className="text-green-400 text-base">✓</span>
                        : <span className="text-red-400 text-base">✗</span>}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{label}</p>
                      <p className="text-xs text-gray-600 mb-1">{description}</p>
                      {data?.detail
                        ? <p className="text-sm text-gray-400 leading-relaxed">{data.detail}</p>
                        : <p className="text-gray-600 text-sm italic">No detail available</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-sm italic">Analysis not available</p>
            )}
          </Section>

          {/* Pain Points */}
          <Section title="Client Pain Points">
            {call.pain_points
              ? <pre className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">{call.pain_points}</pre>
              : <p className="text-gray-600 text-sm italic">Analysis not available</p>}
          </Section>

          {/* Agent Feedback */}
          <Section title="Agent Feedback">
            {call.agent_feedback
              ? <p className="text-gray-300 text-sm leading-relaxed">{call.agent_feedback}</p>
              : <p className="text-gray-600 text-sm italic">Analysis not available</p>}
          </Section>

          {/* AI Reasoning */}
          {call.reasoning && (
            <Section title="AI Stage Reasoning">
              <p className="text-gray-400 text-sm leading-relaxed">{call.reasoning}</p>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </div>
  )
}
