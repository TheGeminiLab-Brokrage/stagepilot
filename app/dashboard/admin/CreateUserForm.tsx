'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/language-context'

export default function CreateUserForm({ teamLeaders }: { teamLeaders: string[] }) {
  const t = useT()
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('agent')
  const [teamName, setTeamName] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setError('')

    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, password, role, teamName: teamName || null }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to create user.')
      setStatus('error')
      return
    }

    setStatus('done')
    setFullName('')
    setEmail('')
    setPassword('')
    setRole('agent')
    setTeamName('')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('adminLabelFullName')}</label>
          <input
            type="text"
            required
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Mohammed Shaaban"
            className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(215,255,0,0.15)] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D7FF00] focus:border-[rgba(215,255,0,0.4)]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('adminColEmail')}</label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="user@company.com"
            className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(215,255,0,0.15)] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D7FF00] focus:border-[rgba(215,255,0,0.4)]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('adminLabelPassword')}</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={t('adminPlaceholderPassword')}
            className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(215,255,0,0.15)] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D7FF00] focus:border-[rgba(215,255,0,0.4)]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('adminLabelRole')}</label>
          <select
            value={role}
            onChange={e => { setRole(e.target.value); setTeamName('') }}
            className="w-full border border-[rgba(215,255,0,0.15)] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D7FF00] focus:border-[rgba(215,255,0,0.4)] cursor-pointer"
            style={{ background: '#0f0f0f' }}
          >
            <option value="agent" style={{ background: '#0f0f0f', color: '#fff' }}>{t('roleAgent')}</option>
            <option value="team_leader" style={{ background: '#0f0f0f', color: '#fff' }}>{t('roleTeamLeader')}</option>
            <option value="trainee" style={{ background: '#0f0f0f', color: '#fff' }}>{t('roleTrainee')}</option>
            <option value="exam" style={{ background: '#0f0f0f', color: '#fff' }}>{t('adminRoleExam')}</option>
            <option value="super_admin" style={{ background: '#0f0f0f', color: '#fff' }}>{t('roleSuperAdmin')}</option>
          </select>
        </div>
        {role === 'agent' && (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('adminColTeam')}</label>
            <select
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              className="w-full border border-[rgba(215,255,0,0.15)] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D7FF00] focus:border-[rgba(215,255,0,0.4)]"
              style={{ background: '#0f0f0f' }}
            >
              <option value="" style={{ background: '#0f0f0f', color: '#fff' }}>{t('adminNoTeam')}</option>
              {teamLeaders.map(name => (
                <option key={name} value={name} style={{ background: '#0f0f0f', color: '#fff' }}>{name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}
      {status === 'done' && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg px-4 py-3">
          {t('adminUserCreatedMsg')}
        </div>
      )}

      <button
        type="submit"
        disabled={status === 'loading'}
        style={{
          background: status === 'loading' ? 'rgba(215,255,0,0.4)' : '#D7FF00',
          color: '#000',
          fontWeight: 700,
          borderRadius: 8,
          padding: '8px 20px',
          fontSize: 13,
          border: 'none',
          cursor: status === 'loading' ? 'default' : 'pointer',
          transition: 'all 0.15s',
          letterSpacing: '0.01em',
        }}
        onMouseEnter={e => { if (status !== 'loading') (e.currentTarget as HTMLButtonElement).style.background = '#c8f000' }}
        onMouseLeave={e => { if (status !== 'loading') (e.currentTarget as HTMLButtonElement).style.background = '#D7FF00' }}
      >
        {status === 'loading' ? t('adminCreatingBtn') : t('adminCreateUserBtn')}
      </button>
    </form>
  )
}
