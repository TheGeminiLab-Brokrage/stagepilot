'use client'

import { useState, useMemo } from 'react'
import { useT } from '@/lib/language-context'

type Profile = {
  id: string
  full_name: string
  role: string
  team_name: string | null
  created_at: string
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-purple-500/20 text-white',
  team_leader: 'bg-blue-500/20 text-white',
  agent: 'bg-gray-500/20 text-white',
  trainee: 'bg-green-500/20 text-white',
}

const ROLE_ORDER: Record<string, number> = {
  super_admin: 0,
  team_leader: 1,
  agent: 2,
  trainee: 3,
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
  const t = useT()
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
  const [editingTeam, setEditingTeam] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [roleSort, setRoleSort] = useState<'asc' | 'desc' | null>(null)
  const [removingUser, setRemovingUser] = useState<{ id: string; name: string } | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [settingPassword, setSettingPassword] = useState<{ id: string; name: string } | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordDone, setPasswordDone] = useState(false)

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

  async function savePassword() {
    if (!settingPassword) return
    setPasswordError(null)
    if (newPassword.length < 8) {
      setPasswordError(t('adminPasswordMinErr'))
      return
    }
    setPasswordSaving(true)
    const res = await fetch('/api/admin/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: settingPassword.id, password: newPassword }),
    })
    setPasswordSaving(false)
    if (res.ok) {
      setPasswordDone(true)
      setTimeout(() => {
        setSettingPassword(null)
        setNewPassword('')
        setPasswordDone(false)
      }, 1500)
    } else {
      const d = await res.json().catch(() => ({}))
      setPasswordError(d.error ?? 'Failed to update password')
    }
  }

  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wide">
            <th className="px-4 py-3">{t('adminColName')}</th>
            <th className="px-4 py-3">{t('adminColEmail')}</th>
            <th className="px-4 py-3">
              <button
                onClick={cycleRoleSort}
                className="flex items-center gap-1 hover:text-white transition-colors"
              >
                {t('adminColRole')}
                {roleSort === 'asc' && <span>↑</span>}
                {roleSort === 'desc' && <span>↓</span>}
              </button>
            </th>
            <th className="px-4 py-3">{t('adminColTeam')}</th>
            <th className="px-4 py-3">{t('adminColJoined')}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {sortedProfiles.map(p => (
            <tr key={p.id} className="border-b border-gray-800/50" style={{ transition: 'background 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(215,255,0,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <td className="px-4 py-3 text-white">
                {p.full_name}
                {p.id === currentUserId && <span className="ms-2 text-xs text-gray-600">{t('adminYouLabel')}</span>}
              </td>
              <td className="px-4 py-3 text-gray-400 text-xs">{emailMap[p.id] ?? '—'}</td>
              <td className="px-4 py-3 text-center">
                <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[p.role] ?? 'bg-gray-700 text-white'}`}>
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
                      <option value="">{t('adminUnassigned')}</option>
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
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => { setNewPassword(''); setPasswordError(null); setPasswordDone(false); setSettingPassword({ id: p.id, name: p.full_name }) }}
                    className="text-xs text-gray-600 hover:text-blue-400 transition-colors cursor-pointer"
                  >
                    {t('adminSetPasswordBtn')}
                  </button>
                  {p.id !== currentUserId && (
                    <button
                      onClick={() => { setRemoveError(null); setRemovingUser({ id: p.id, name: p.full_name }) }}
                      className="text-xs text-gray-600 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      {t('adminRemoveBtn')}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {settingPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-80 shadow-xl">
            <h3 className="text-white font-semibold text-base mb-1">{t('adminSetNewPasswordTitle')}</h3>
            <p className="text-gray-400 text-sm mb-4">{settingPassword.name}</p>
            {passwordDone ? (
              <p className="text-green-400 text-sm text-center py-2">{t('adminPasswordUpdated')}</p>
            ) : (
              <>
                <input
                  type="password"
                  autoFocus
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') savePassword() }}
                  placeholder={t('adminPlaceholderPassword')}
                  className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {passwordError && (
                  <p className="text-red-400 text-xs mb-3">{passwordError}</p>
                )}
                <div className="flex gap-3 justify-end mt-4">
                  <button
                    onClick={() => setSettingPassword(null)}
                    className="px-4 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors"
                  >
                    {t('adminCancel')}
                  </button>
                  <button
                    onClick={savePassword}
                    disabled={passwordSaving}
                    className="px-4 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    {passwordSaving ? t('adminSaving') : t('adminSave')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {removingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-80 shadow-xl">
            <h3 className="text-white font-semibold text-base mb-1">{t('adminRemoveUserTitle')}</h3>
            <p className="text-gray-400 text-sm mb-4">{removingUser.name}</p>
            <p className="text-gray-500 text-xs mb-5">{t('adminCannotUndo')}</p>
            {removeError && (
              <p className="text-red-400 text-xs mb-4">{removeError}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setRemovingUser(null)}
                className="px-4 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors"
              >
                {t('adminCancel')}
              </button>
              <button
                onClick={confirmRemoveUser}
                className="px-4 py-1.5 text-sm text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
              >
                {t('adminRemoveBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
