'use client'

import { useState } from 'react'

type Profile = {
  id: string
  full_name: string
  role: string
  team_name: string | null
  created_at: string
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-purple-500/20 text-purple-300',
  team_leader: 'bg-blue-500/20 text-blue-300',
  agent: 'bg-gray-500/20 text-gray-400',
}

export default function UserTable({
  initialProfiles,
  emailMap,
  currentUserId,
}: {
  initialProfiles: Profile[]
  emailMap: Record<string, string>
  currentUserId: string
}) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
  const [editingTeam, setEditingTeam] = useState<string | null>(null)
  const [teamDraft, setTeamDraft] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  async function removeUser(userId: string, name: string) {
    if (!confirm(`Remove ${name}? This cannot be undone.`)) return
    const res = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    if (res.ok) {
      setProfiles(prev => prev.filter(p => p.id !== userId))
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? 'Failed to remove user')
    }
  }

  async function saveTeam(userId: string, teamName: string) {
    setSaving(userId)
    const res = await fetch('/api/admin/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, teamName }),
    })
    if (res.ok) {
      setProfiles(prev =>
        prev.map(p => p.id === userId ? { ...p, team_name: teamName || null } : p)
      )
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? 'Failed to update team')
    }
    setSaving(null)
    setEditingTeam(null)
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wide">
          <th className="text-left px-4 py-3">Name</th>
          <th className="text-left px-4 py-3">Email</th>
          <th className="text-left px-4 py-3">Role</th>
          <th className="text-left px-4 py-3">Team</th>
          <th className="text-left px-4 py-3">Joined</th>
          <th className="px-4 py-3" />
        </tr>
      </thead>
      <tbody>
        {profiles.map(p => (
          <tr key={p.id} className="border-b border-gray-800/50">
            <td className="px-4 py-3 text-white">
              {p.full_name}
              {p.id === currentUserId && <span className="ml-2 text-xs text-gray-600">(you)</span>}
            </td>
            <td className="px-4 py-3 text-gray-400 text-xs">{emailMap[p.id] ?? '—'}</td>
            <td className="px-4 py-3">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[p.role] ?? 'bg-gray-700 text-gray-300'}`}>
                {p.role.replace('_', ' ')}
              </span>
            </td>
            <td className="px-4 py-3 text-xs">
              {editingTeam === p.id ? (
                <input
                  autoFocus
                  value={teamDraft}
                  onChange={e => setTeamDraft(e.target.value)}
                  onBlur={() => saveTeam(p.id, teamDraft)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveTeam(p.id, teamDraft)
                    if (e.key === 'Escape') setEditingTeam(null)
                  }}
                  disabled={saving === p.id}
                  className="bg-gray-800 border border-gray-600 text-white rounded px-2 py-0.5 w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              ) : (
                <button
                  onClick={() => { setEditingTeam(p.id); setTeamDraft(p.team_name ?? '') }}
                  className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                  title="Click to edit team"
                >
                  {p.team_name ?? <span className="text-gray-600">—</span>}
                </button>
              )}
            </td>
            <td className="px-4 py-3 text-gray-500 text-xs">
              {new Date(p.created_at).toLocaleDateString('en-GB')}
            </td>
            <td className="px-4 py-3 text-right">
              {p.id !== currentUserId && (
                <button
                  onClick={() => removeUser(p.id, p.full_name)}
                  className="text-xs text-gray-600 hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
