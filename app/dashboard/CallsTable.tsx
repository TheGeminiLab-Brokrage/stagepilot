'use client'

import { useState } from 'react'

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

type Call = {
  id: string
  file_name: string
  client_name: string | null
  client_phone: string | null
  campaign: string | null
  stage: string | null
  stage_corrected: string | null
  status: string
  uploaded_at: string
  agent_id: string
  team_name: string | null
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [localCalls, setLocalCalls] = useState(calls)

  async function saveCorrection(callId: string, newStage: string) {
    setSaving(true)
    const res = await fetch('/api/update-stage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId, stage: newStage }),
    })
    setSaving(false)
    if (res.ok) {
      setLocalCalls(prev =>
        prev.map(c => c.id === callId ? { ...c, stage_corrected: newStage } : c)
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
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wide">
            <th className="text-left px-4 py-3">File</th>
            <th className="text-left px-4 py-3">Client</th>
            <th className="text-left px-4 py-3">Campaign</th>
            <th className="text-left px-4 py-3">AI Stage</th>
            {isLeader && <th className="text-left px-4 py-3">Correction</th>}
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-left px-4 py-3">Date</th>
          </tr>
        </thead>
        <tbody>
          {localCalls.map(call => {
            const displayStage = call.stage_corrected ?? call.stage
            const stageBadge = displayStage ? STAGE_COLORS[displayStage] ?? 'bg-gray-700 text-gray-300' : ''

            return (
              <tr key={call.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3 text-gray-300 max-w-[200px] truncate" title={call.file_name}>
                  {call.file_name}
                </td>
                <td className="px-4 py-3">
                  <div className="text-white">{call.client_name ?? '—'}</div>
                  <div className="text-gray-500 text-xs">{call.client_phone ?? ''}</div>
                </td>
                <td className="px-4 py-3 text-gray-400">{call.campaign ?? '—'}</td>
                <td className="px-4 py-3">
                  {call.stage ? (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stageBadge}`}>
                      {call.stage}
                      {call.stage_corrected && call.stage_corrected !== call.stage && (
                        <span className="ml-1 line-through opacity-50">{call.stage}</span>
                      )}
                    </span>
                  ) : '—'}
                </td>

                {isLeader && (
                  <td className="px-4 py-3">
                    {editingId === call.id ? (
                      <select
                        autoFocus
                        disabled={saving}
                        defaultValue={call.stage_corrected ?? call.stage ?? ''}
                        onChange={e => saveCorrection(call.id, e.target.value)}
                        onBlur={() => setEditingId(null)}
                        className="bg-gray-800 border border-gray-600 text-white text-xs rounded px-2 py-1"
                      >
                        {ALL_STAGES.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setEditingId(call.id)}
                        className="text-xs text-gray-500 hover:text-blue-400 transition-colors"
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
                    <span className="text-xs text-red-400">Error</span>
                  )}
                </td>

                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {new Date(call.uploaded_at).toLocaleDateString('en-GB')}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
