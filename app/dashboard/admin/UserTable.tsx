'use client'

import { useState, useMemo } from 'react'

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

const ROLE_ORDER: Record<string, number> = {
  super_admin: 0,
  team_leader: 1,
  agent: 2,
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
  const [saving, setSaving] = useState<string | null>(null)
  const [roleSort, setRoleSort] = useState<'asc' | 'desc' | null>(null)
  const [removingUser, setRemovingUser] = useState<{ id: string; name: string } | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const teamLeaders = useMemo(
    () => profiles.filter(p => p.role === 'team_leader').map(p => p.full_name),
    [profiles]
  )

  const sortedProfiles = useMemo(() => {
    if (!roleSort) return profiles
    return [...profiles].sort((a, b) => {
      const diff = (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99)
      return roleSort === 'asc' ? diff : -diff
    })
  }, [profiles, roleSort])

  async function confirmRemoveUser() {
    if (!removingUser) return
    setRemoveError(null)
    const res = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: removingUser.id }),
    })
    if (res.ok) {
      setProfiles(prev => prev.filter(p => p.id !== removingUser.id))
      setRemovingUser(null)
    } else {
      const d = await res.json().catch(() => ({}))
      setRemoveError(d.error ?? 'Failed to remove user')
    }
  }

  async function saveTeam(userId: string, teamName: string) {
    const teamValue = teamName || null
    setSaving(userId)
    const res = await fetch('/api/admin/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, teamName: teamValue }),
    })
    if (res.ok) {
      setProfiles(prev =>
        prev.map(p => p.id === userId ? { ...p, team_name: teamValue } : p)
      )
    }
    setSaving(null)
    setEditingTeam(null)
  }

  function cycleRoleSort() {
    setRoleSort(s => s === null ? 'asc' : s === 'asc' ? 'desc' : null)
  }

  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wide">
            <th className="text-left px-4 py-3">Name</th>
            <th className="text-left px-4 py-3">Email</th>
            <th className="text-left px-4 py-3">
              <button
                onClick={cycleRoleSort}
                className="flex items-center gap-1 hover:text-white transition-colors"
              >
                Role
                {roleSort === 'asc' && <span>↑</span>}
                {roleSort === 'desc' && <span>↓</span>}
              </button>
            </th>
            <th className="text-left px-4 py-3">Team</th>
            <th className="text-left px-4 py-3">Joined</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {sortedProfiles.map(p => (
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
                {p.role === 'agent' ? (
                  editingTeam === p.id ? (
                    <select
                      autoFocus
                      disabled={saving === p.id}
                      defaultValue={p.team_name ?? ''}
                      onChange={e => saveTeam(p.id, e.target.value)}
                      onBlur={() => setEditingTeam(null)}
                      className="bg-gray-800 border border-gray-600 text-white rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">— unassigned —</option>
                      {teamLeaders.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  ) : (
                    <button
                      onClick={() => setEditingTeam(p.id)}
                      className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                      title="Click to change team"
                    >
                      {p.team_name ?? <span className="text-gray-600">—</span>}
                    </button>
                  )
                ) : (
                  <span className="text-gray-600">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-500 text-xs">
                {new Date(p.created_at).toLocaleDateString('en-GB')}
              </td>
              <td className="px-4 py-3 text-right">
                {p.id !== currentUserId && (
                  <button
                    onClick={() => { setRemoveError(null); setRemovingUser({ id: p.id, name: p.full_name }) }}
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

      {removingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-80 shadow-xl">
            <h3 className="text-white font-semibold text-base mb-1">Remove user?</h3>
            <p className="text-gray-400 text-sm mb-4">{removingUser.name}</p>
            <p className="text-gray-500 text-xs mb-5">This cannot be undone.</p>
            {removeError && (
              <p className="text-red-400 text-xs mb-4">{removeError}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setRemovingUser(null)}
                className="px-4 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveUser}
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
