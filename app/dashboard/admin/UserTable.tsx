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
  profiles,
  emailMap,
  currentUserId,
  teamLeaders,
  onRemoveProfile,
  onUpdateTeamProfile,
}: {
  profiles: Profile[]
  emailMap: Record<string, string>
  currentUserId: string
  teamLeaders: string[]
  onRemoveProfile: (id: string) => void
  onUpdateTeamProfile: (id: string, team: string | null) => void
}) {
  const t = useT()
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
      onRemoveProfile(removingUser.id)
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
      onUpdateTeamProfile(userId, teamValue)
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
                <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${ROLE_COLORS[p.role] ?? 'bg-gray-700 text-white'}`}>
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
                      className="border border-gray-600 text-white rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      style={{ background: '#0f0f0f' }}
                    >
                      <option value="" style={{ background: '#0f0f0f', color: '#fff' }}>{t('adminUnassigned')}</option>
                      {teamLeaders.map(name => (
                        <option key={name} value={name} style={{ background: '#0f0f0f', color: '#fff' }}>{name}</option>
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
                    className="text-xs text-gray-600 transition-colors cursor-pointer"
                    style={{ transition: 'color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#d7ff00')}
                    onMouseLeave={e => (e.currentTarget.style.color = '')}
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
          <div style={{
            background: '#0a0a0a',
            border: '1px solid rgba(215,255,0,0.15)',
            borderRadius: 16,
            padding: '28px 28px 24px',
            width: 340,
            boxShadow: '0 0 0 1px rgba(215,255,0,0.05), 0 24px 60px rgba(0,0,0,0.8)',
            fontFamily: "'Montserrat', sans-serif",
          }}>
            <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: '0 0 4px' }}>{t('adminSetNewPasswordTitle')}</h3>
            <p style={{ color: 'rgba(215,255,0,0.6)', fontSize: 13, margin: '0 0 20px', fontFamily: "'Space Grotesk', sans-serif" }}>{settingPassword.name}</p>
            {passwordDone ? (
              <p style={{ color: '#d7ff00', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>{t('adminPasswordUpdated')}</p>
            ) : (
              <>
                <input
                  type="password"
                  autoFocus
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') savePassword() }}
                  placeholder={t('adminPlaceholderPassword')}
                  style={{
                    width: '100%', background: 'rgba(215,255,0,0.04)', border: '1px solid rgba(215,255,0,0.2)',
                    color: '#fff', borderRadius: 8, padding: '10px 12px', fontSize: 13,
                    outline: 'none', boxSizing: 'border-box', marginBottom: 8,
                    fontFamily: "'Space Grotesk', sans-serif", transition: 'border-color 0.15s',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(215,255,0,0.5)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(215,255,0,0.2)')}
                />
                {passwordError && (
                  <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '6px 10px' }}>{passwordError}</p>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button
                    onClick={() => setSettingPassword(null)}
                    style={{
                      padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, cursor: 'pointer',
                      background: 'transparent', color: 'rgba(255,255,255,0.45)',
                      border: '1px solid rgba(255,255,255,0.12)', transition: 'all 0.15s',
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
                  >
                    {t('adminCancel')}
                  </button>
                  <button
                    onClick={savePassword}
                    disabled={passwordSaving}
                    style={{
                      padding: '8px 18px', fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: passwordSaving ? 'not-allowed' : 'pointer',
                      background: passwordSaving ? 'rgba(215,255,0,0.1)' : 'rgba(215,255,0,0.15)',
                      color: passwordSaving ? 'rgba(215,255,0,0.4)' : '#d7ff00',
                      border: '1px solid rgba(215,255,0,0.3)', transition: 'all 0.15s',
                      fontFamily: "'Space Grotesk', sans-serif", opacity: passwordSaving ? 0.6 : 1,
                    }}
                    onMouseEnter={e => { if (!passwordSaving) { e.currentTarget.style.background = 'rgba(215,255,0,0.25)'; e.currentTarget.style.borderColor = 'rgba(215,255,0,0.5)' } }}
                    onMouseLeave={e => { e.currentTarget.style.background = passwordSaving ? 'rgba(215,255,0,0.1)' : 'rgba(215,255,0,0.15)'; e.currentTarget.style.borderColor = 'rgba(215,255,0,0.3)' }}
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
          <div style={{
            background: '#0a0a0a',
            border: '1px solid rgba(215,255,0,0.15)',
            borderRadius: 16,
            padding: '28px 28px 24px',
            width: 340,
            boxShadow: '0 0 0 1px rgba(215,255,0,0.05), 0 24px 60px rgba(0,0,0,0.8)',
            fontFamily: "'Montserrat', sans-serif",
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                🗑️
              </div>
              <div>
                <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: 0 }}>{t('adminRemoveUserTitle')}</h3>
                <p style={{ color: 'rgba(215,255,0,0.6)', fontSize: 13, margin: '2px 0 0', fontFamily: "'Space Grotesk', sans-serif" }}>{removingUser.name}</p>
              </div>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 20, lineHeight: 1.5 }}>{t('adminCannotUndo')}</p>
            {removeError && (
              <p style={{ color: '#f87171', fontSize: 12, marginBottom: 16, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px' }}>{removeError}</p>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setRemovingUser(null)}
                style={{
                  padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, cursor: 'pointer',
                  background: 'transparent', color: 'rgba(255,255,255,0.45)',
                  border: '1px solid rgba(255,255,255,0.12)', transition: 'all 0.15s',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
              >
                {t('adminCancel')}
              </button>
              <button
                onClick={confirmRemoveUser}
                style={{
                  padding: '8px 18px', fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: 'pointer',
                  background: 'rgba(239,68,68,0.15)', color: '#f87171',
                  border: '1px solid rgba(239,68,68,0.3)', transition: 'all 0.15s',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.25)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
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
