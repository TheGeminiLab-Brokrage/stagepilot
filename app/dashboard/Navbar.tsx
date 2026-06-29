'use client'

import { usePathname } from 'next/navigation'
import { useLanguage, useT } from '@/lib/language-context'

interface NavbarProps {
  role: string
  fullName: string | null | undefined
  rightSlot?: React.ReactNode
}

const ROLE_KEY_MAP: Record<string, 'roleAgent' | 'roleTeamLeader' | 'roleSuperAdmin' | 'roleTrainee' | 'roleExam' | 'rolePropertyViewer'> = {
  agent: 'roleAgent',
  team_leader: 'roleTeamLeader',
  super_admin: 'roleSuperAdmin',
  trainee: 'roleTrainee',
  exam: 'roleExam',
  property_viewer: 'rolePropertyViewer',
}

export default function Navbar({ role, fullName, rightSlot }: NavbarProps) {
  const { lang, setLang } = useLanguage()
  const t = useT()
  const pathname = usePathname()

  const roleNavLinks =
    role === 'trainee'
      ? [{ href: '/dashboard/practice', label: t('navAiPractice') }]
      : role === 'exam'
      ? [{ href: '/dashboard/exam', label: t('navExam') }]
      : role === 'property_viewer'
      ? []
      : role === 'super_admin'
      ? [
          { href: '/dashboard/find-property', label: 'Find a Property' },
          { href: '/dashboard/performance', label: 'Performance' },
          { href: '/dashboard/admin/reports', label: t('navReports') },
          { href: '/dashboard', label: t('navTeamCalls') },
          { href: '/dashboard/admin', label: t('navAdmin') },
          { href: '/dashboard/admin/knowledge-base', label: t('navKnowledgeBase') },
        ]
      : [
          { href: '/dashboard/find-property', label: 'Find a Property' },
          ...(role === 'agent' ? [{ href: '/dashboard/daily-report', label: 'Daily Report' }] : []),
          ...(role === 'agent' ? [
            { href: '/dashboard/practice', label: t('navAiPractice') },
            { href: '/dashboard/exam', label: t('navExam') },
          ] : []),
          { href: '/dashboard/performance', label: 'Performance' },
          { href: '/dashboard', label: role === 'agent' ? t('navMyCalls') : t('navTeamCalls') },
          ...(role === 'agent' ? [
            { href: '/dashboard/upload', label: t('navUploadCall') },
          ] : []),
        ]

  const navLinks = [
    ...roleNavLinks,
    ...(role === 'property_viewer' ? [{ href: '/dashboard/find-property', label: 'Find a Property' }] : []),
  ]

  const roleLabel = ROLE_KEY_MAP[role] ? t(ROLE_KEY_MAP[role]) : role.replace('_', ' ')

  return (
    <header
      style={{
        borderBottom: '1px solid rgba(215,255,0,0.15)',
        background: 'rgba(0,0,0,0.95)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        fontFamily: "'Montserrat', sans-serif",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <a href="/dashboard" className="flex items-center">
            <img
              src="/tgl-logo-white.png"
              alt="TGL"
              className="h-7 w-auto"
              style={{ filter: 'brightness(1) drop-shadow(0 0 8px rgba(215,255,0,0.3))' }}
              onMouseEnter={e => ((e.target as HTMLImageElement).style.filter = 'brightness(1.1) drop-shadow(0 0 14px rgba(215,255,0,0.6))')}
              onMouseLeave={e => ((e.target as HTMLImageElement).style.filter = 'brightness(1) drop-shadow(0 0 8px rgba(215,255,0,0.3))')}
            />
          </a>

          <nav className="flex gap-1">
            {navLinks.map(({ href, label }) => {
              const isActive = pathname === href
              return (
                <a
                  key={href}
                  href={href}
                  className="text-xs font-semibold uppercase px-3 py-1.5 rounded-md transition-all"
                  style={{
                    color: isActive ? '#D7FF00' : 'rgba(255,255,255,0.45)',
                    background: isActive ? 'rgba(215,255,0,0.08)' : 'transparent',
                    letterSpacing: '0.08em',
                    fontFamily: "'Space Grotesk', sans-serif",
                    borderBottom: isActive ? '2px solid rgba(215,255,0,0.6)' : '2px solid transparent',
                    borderRadius: '6px 6px 0 0',
                  }}
                  onMouseEnter={e => {
                    if (isActive) return
                    const el = e.currentTarget
                    el.style.color = '#D7FF00'
                    el.style.background = 'rgba(215,255,0,0.08)'
                  }}
                  onMouseLeave={e => {
                    if (isActive) return
                    const el = e.currentTarget
                    el.style.color = 'rgba(255,255,255,0.45)'
                    el.style.background = 'transparent'
                  }}
                >
                  {label}
                </a>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* Language toggle */}
          <div className="flex items-center rounded-md overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            {(['ar', 'en'] as const).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 9px',
                  letterSpacing: '0.04em',
                  transition: 'all 0.15s',
                  background: lang === l ? 'rgba(215,255,0,0.12)' : 'transparent',
                  color: lang === l ? '#D7FF00' : 'rgba(255,255,255,0.3)',
                  border: 'none',
                  cursor: 'pointer',
                  outline: lang === l ? '1px solid rgba(215,255,0,0.25)' : 'none',
                }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: "'Montserrat', sans-serif" }}>
            {fullName}
            <span
              className="ml-1.5 px-1.5 py-0.5 rounded text-xs font-semibold"
              style={{
                background: 'rgba(215,255,0,0.1)',
                color: 'rgba(215,255,0,0.7)',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {roleLabel}
            </span>
          </span>
          {rightSlot}
        </div>
      </div>
    </header>
  )
}
