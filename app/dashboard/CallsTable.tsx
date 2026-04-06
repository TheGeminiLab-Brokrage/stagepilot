'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import CallDetailModal from './CallDetailModal'

const STAGE_COLORS: Record<string, string> = {
  'interested / follow up': 'bg-blue-500/20 text-blue-300',
  'potential to close': 'bg-purple-500/20 text-purple-300',
  'meeting scheduled': 'bg-yellow-500/20 text-yellow-300',
  'meeting done': 'bg-orange-500/20 text-orange-300',
  'done deal': 'bg-green-500/20 text-green-300',
  'not interested': 'bg-red-500/20 text-red-300',
  'low budget': 'bg-gray-500/20 text-gray-400',
}

const ALL_STAGES = Object.keys(STAGE_COLORS)

// Correction dropdown excludes final stages that leaders shouldn't manually assign
const CORRECTION_STAGES = ALL_STAGES.filter(s => s !== 'meeting done' && s !== 'done deal')

type TripleC = {
  clear_need?: { met: boolean; detail: string }
  clear_budget?: { met: boolean; detail: string }
  clear_path?: { met: boolean; detail: string }
}

export type Call = {
  id: string
  file_name: string
  client_name: string | null
  client_phone: string | null
  campaign: string | null
  stage: string | null
  stage_corrected: string | null
  agent_stage: string | null
  reasoning: string | null
  transcript_summary: string | null
  pain_points: string | null
  triple_c: TripleC | null
  agent_feedback: string | null
  audio_url: string | null
  status: string
  error_message: string | null
  uploaded_at: string
  agent_id: string
  team_name: string | null
  agent_full_name?: string | null
}

export default function CallsTable({
  calls,
  isLeader,
  currentUserId,
}: {
  calls: Call[]
  isLeader: boolean
  currentUserId: string
}) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [localCalls, setLocalCalls] = useState(calls)
  const [selectedCall, setSelectedCall] = useState<Call | null>(null)
  const [deletingCall, setDeletingCall] = useState<{ id: string; name: string | null; phone: string | null } | null>(null)

  async function removeCall(callId: string) {
    const res = await fetch('/api/delete-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId }),
    })
    if (res.ok) setLocalCalls(prev => prev.filter(c => c.id !== callId))
    setDeletingCall(null)
  }

  useEffect(() => {
    setLocalCalls(calls)
  }, [calls])

  useEffect(() => {
    const hasProcessing = localCalls.some(c => c.status === 'processing')
    if (!hasProcessing) return
    const id = setInterval(() => router.refresh(), 5000)
    return () => clearInterval(id)
  }, [localCalls, router])

  async function saveCorrection(callId: string, newStage: string) {
    const stageValue = newStage || null // "" → null to clear correction
    setSaving(true)
    const res = await fetch('/api/update-stage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId, stage: stageValue }),
    })
    setSaving(false)
    if (res.ok) {
      setLocalCalls(prev =>
        prev.map(c => c.id === callId ? { ...c, stage_corrected: stageValue } : c)
      )
      setEditingId(null)
    }
  }

  if (localCalls.length === 0) {
    return (
      <div className="text-center py-20 text-gray-600">
        No calls yet.{' '}
        {!isLeader && (
          <a href="/dashboard/upload" className="text-blue-500 hover:underline">
            Upload your first call
          </a>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3">File</th>
              <th className="text-left px-4 py-3">Client</th>
              {isLeader && <th className="text-left px-4 py-3">Agent</th>}
              <th className="text-left px-4 py-3">Campaign</th>
              <th className="text-left px-4 py-3">AI Stage</th>
              {isLeader && <th className="text-left px-4 py-3">Agent Stage</th>}
              {isLeader && <th className="text-left px-4 py-3">Correction</th>}
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Date</th>
              <th className="px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {localCalls.map(call => {
              const displayStage = call.stage_corrected ?? call.stage
              const correctionDiffers = call.stage_corrected && call.stage_corrected !== call.stage
              const stageBadge = displayStage
                ? (correctionDiffers
                    ? 'bg-red-900/40 text-red-300 ring-1 ring-red-700/50'
                    : 'bg-green-900/40 text-green-300 ring-1 ring-green-700/50')
                : ''

              return (
                <tr
                  key={call.id}
                  className="group border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer"
                  onClick={() => call.status === 'done' && setSelectedCall(call)}
                >
                  <td className="px-4 py-3 text-gray-300 max-w-[180px] truncate" title={call.file_name}>
                    {call.file_name}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white">{call.client_name ?? '—'}</div>
                    <div className="text-gray-500 text-xs">{call.client_phone ?? ''}</div>
                  </td>
                  {isLeader && (
                    <td className="px-4 py-3 text-gray-400 text-xs">{call.agent_full_name ?? '—'}</td>
                  )}
                  <td className="px-4 py-3 text-gray-400">{call.campaign ?? '—'}</td>
                  <td className="px-4 py-3">
                    {displayStage ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stageBadge}`}>
                        {displayStage}
                      </span>
                    ) : '—'}
                  </td>

                  {isLeader && (
                    <td className="px-4 py-3">
                      {call.agent_stage ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[call.agent_stage] ?? 'bg-gray-700 text-gray-300'}`}>
                          {call.agent_stage}
                        </span>
                      ) : '—'}
                    </td>
                  )}

                  {isLeader && (
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      {editingId === call.id ? (
                        <select
                          autoFocus
                          disabled={saving}
                          defaultValue={call.stage_corrected ?? ''}
                          onChange={e => saveCorrection(call.id, e.target.value)}
                          onBlur={() => setEditingId(null)}
                          className="bg-gray-800 border border-gray-600 text-white text-xs rounded px-2 py-1"
                        >
                          <option value="">— remove correction —</option>
                          {CORRECTION_STAGES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      ) : (
                        <button
                          onClick={() => setEditingId(call.id)}
                          className={`text-xs transition-colors ${
                            call.stage_corrected
                              ? correctionDiffers
                                ? 'text-red-400 hover:text-blue-400'
                                : 'text-green-400 hover:text-blue-400'
                              : 'text-gray-500 hover:text-blue-400'
                          }`}
                        >
                          {call.stage_corrected ? `✓ ${call.stage_corrected}` : 'Correct →'}
                        </button>
                      )}
                    </td>
                  )}

                  <td className="px-4 py-3">
                    {call.status === 'processing' && (
                      <span className="text-xs text-yellow-400">Processing…</span>
                    )}
                    {call.status === 'done' && (
                      <span className="text-xs text-green-400">Done</span>
                    )}
                    {call.status === 'error' && (
                      <span className="flex items-center gap-1">
                        <span className="text-xs text-red-400">Error</span>
                        {call.error_message && (
                          <span
                            title={call.error_message.slice(0, 200)}
                            className="cursor-help text-red-400 text-xs"
                          >ⓘ</span>
                        )}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(call.uploaded_at).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-2 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setDeletingCall({ id: call.id, name: call.client_name, phone: call.client_phone })}
                      title="Remove"
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 text-sm transition-all px-1"
                    >×</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selectedCall && (
        <CallDetailModal call={selectedCall} isLeader={isLeader} onClose={() => setSelectedCall(null)} />
      )}

      {deletingCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-80 shadow-xl">
            <h3 className="text-white font-semibold text-base mb-1">Remove client?</h3>
            <p className="text-gray-400 text-sm mb-1">{deletingCall.name ?? 'Unknown client'}</p>
            {deletingCall.phone && (
              <p className="text-gray-600 text-xs mb-4">{deletingCall.phone}</p>
            )}
            <p className="text-gray-500 text-xs mb-5">This call record will be permanently deleted.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeletingCall(null)}
                className="px-4 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => removeCall(deletingCall.id)}
                className="px-4 py-1.5 text-sm text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
