'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }

    window.location.href = '/dashboard/find-property'
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background: '#000',
        fontFamily: "'Montserrat', sans-serif",
        // Stardust radial atmosphere
        backgroundImage: `
          radial-gradient(ellipse 60% 50% at 50% 0%, rgba(215,255,0,0.06) 0%, transparent 70%),
          radial-gradient(ellipse 40% 40% at 80% 80%, rgba(215,255,0,0.03) 0%, transparent 60%)
        `,
      }}
    >
      <div className="w-full max-w-sm px-4">
        {/* Logo */}
        <div className="text-center mb-10">
          <img
            src="/tgl-logo-white.png"
            alt="TGL"
            className="h-14 w-auto mx-auto mb-5"
            style={{ filter: 'drop-shadow(0 0 16px rgba(215,255,0,0.4))' }}
          />
          <p
            className="text-xs uppercase tracking-widest font-semibold"
            style={{ color: 'rgba(255,255,255,0.35)', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.2em' }}
          >
            Sign in to your account
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="space-y-4 rounded-2xl p-8"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(215,255,0,0.12)',
            boxShadow: '0 0 60px rgba(215,255,0,0.04), inset 0 1px 0 rgba(215,255,0,0.08)',
          }}
        >
          {error && (
            <div
              className="text-xs rounded-lg px-4 py-3 text-center"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}
            >
              {error}
            </div>
          )}

          <div>
            <label
              className="block text-xs font-semibold mb-2 uppercase"
              style={{ color: 'rgba(215,255,0,0.5)', letterSpacing: '0.1em', fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg px-4 py-3 text-sm transition-all focus:outline-none"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(215,255,0,0.2)',
                color: '#fff',
                fontFamily: "'Montserrat', sans-serif",
              }}
              placeholder="you@company.com"
              onFocus={e => (e.target.style.borderColor = 'rgba(215,255,0,0.6)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(215,255,0,0.2)')}
            />
          </div>

          <div>
            <label
              className="block text-xs font-semibold mb-2 uppercase"
              style={{ color: 'rgba(215,255,0,0.5)', letterSpacing: '0.1em', fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg px-4 py-3 text-sm transition-all focus:outline-none"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(215,255,0,0.2)',
                color: '#fff',
                fontFamily: "'Montserrat', sans-serif",
              }}
              placeholder="••••••••"
              onFocus={e => (e.target.style.borderColor = 'rgba(215,255,0,0.6)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(215,255,0,0.2)')}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="tgl-btn-glow w-full font-bold rounded-lg py-3 text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-2"
            style={{
              background: '#D7FF00',
              color: '#000',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.08em',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.2)' }}>
          New company?{' '}
          <Link
            href="/auth/register"
            className="transition-colors"
            style={{ color: 'rgba(215,255,0,0.6)' }}
            onMouseEnter={e => ((e.target as HTMLAnchorElement).style.color = '#D7FF00')}
            onMouseLeave={e => ((e.target as HTMLAnchorElement).style.color = 'rgba(215,255,0,0.6)')}
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}
