import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from './LogoutButton'
import GeminiVoiceButton from './components/GeminiVoiceButton'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, team_name')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'agent'
  const isLeader = role === 'team_leader' || role === 'super_admin'

  // Trainee redirect: they only access /dashboard/practice
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''
  if (role === 'trainee' && !pathname.startsWith('/dashboard/practice')) {
    redirect('/dashboard/practice')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#000', fontFamily: "'Montserrat', sans-serif" }}>
      <header style={{ borderBottom: '1px solid rgba(215,255,0,0.15)', background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* TGL Logo */}
            <a href="/dashboard" className="flex items-center gap-2.5 group">
              <img
                src="/tgl-logo-white.png"
                alt="TGL"
                className="h-7 w-auto"
                style={{ filter: 'brightness(1) drop-shadow(0 0 8px rgba(215,255,0,0.3))', transition: 'filter 0.2s' }}
                onMouseEnter={e => ((e.target as HTMLImageElement).style.filter = 'brightness(1.1) drop-shadow(0 0 14px rgba(215,255,0,0.6))')}
                onMouseLeave={e => ((e.target as HTMLImageElement).style.filter = 'brightness(1) drop-shadow(0 0 8px rgba(215,255,0,0.3))')}
              />
            </a>

            {role === 'trainee' ? (
              <nav className="flex gap-1">
                <a
                  href="/dashboard/practice"
                  className="text-xs font-semibold uppercase px-3 py-1.5 rounded-md transition-all"
                  style={{ color: 'rgba(215,255,0,0.7)', letterSpacing: '0.1em', fontFamily: "'Space Grotesk', sans-serif" }}
                  onMouseEnter={e => { const el = e.currentTarget; el.style.color = '#D7FF00'; el.style.background = 'rgba(215,255,0,0.08)' }}
                  onMouseLeave={e => { const el = e.currentTarget; el.style.color = 'rgba(215,255,0,0.7)'; el.style.background = 'transparent' }}
                >
                  AI Practice
                </a>
              </nav>
            ) : (
              <nav className="flex gap-1">
                {[
                  { href: '/dashboard', label: role === 'agent' ? 'My Calls' : 'Team Calls' },
                  ...(role === 'agent' ? [{ href: '/dashboard/upload', label: 'Upload Call' }] : []),
                  ...(role === 'super_admin' ? [{ href: '/dashboard/admin', label: 'Admin' }] : []),
                ].map(({ href, label }) => (
                  <a
                    key={href}
                    href={href}
                    className="text-xs font-semibold uppercase px-3 py-1.5 rounded-md transition-all"
                    style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em', fontFamily: "'Space Grotesk', sans-serif" }}
                    onMouseEnter={e => { const el = e.currentTarget; el.style.color = '#D7FF00'; el.style.background = 'rgba(215,255,0,0.08)' }}
                    onMouseLeave={e => { const el = e.currentTarget; el.style.color = 'rgba(255,255,255,0.45)'; el.style.background = 'transparent' }}
                  >
                    {label}
                  </a>
                ))}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: "'Montserrat', sans-serif" }}>
              {profile?.full_name}
              <span className="ml-1 px-1.5 py-0.5 rounded text-xs font-semibold capitalize" style={{ background: 'rgba(215,255,0,0.1)', color: 'rgba(215,255,0,0.7)', fontFamily: "'Space Grotesk', sans-serif" }}>
                {role.replace('_', ' ')}
              </span>
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        {children}
      </main>

      <GeminiVoiceButton />
    </div>
  )
}
