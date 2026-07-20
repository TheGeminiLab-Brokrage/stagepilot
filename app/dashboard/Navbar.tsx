'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useLanguage, useT } from '@/lib/language-context'
import { createClient } from '@/lib/supabase/client'

interface NavbarProps {
  role: string
  fullName: string | null | undefined
  currentUserId: string
  rightSlot?: React.ReactNode
}

const NEON = '#D7FF00'

const ROLE_KEY_MAP: Record<string, 'roleAgent' | 'roleTeamLeader' | 'roleSuperAdmin' | 'roleTrainee' | 'roleExam' | 'rolePropertyViewer'> = {
  agent: 'roleAgent',
  team_leader: 'roleTeamLeader',
  super_admin: 'roleSuperAdmin',
  trainee: 'roleTrainee',
  exam: 'roleExam',
  property_viewer: 'rolePropertyViewer',
}

export default function Navbar({ role, fullName, currentUserId, rightSlot }: NavbarProps) {
  const { lang, setLang } = useLanguage()
  const t = useT()
  const pathname = usePathname()
  const [pendingTicketCount, setPendingTicketCount] = useState(0)

  useEffect(() => {
    if (role !== 'agent' && role !== 'team_leader') return
    const supabase = createClient()

    async function loadPendingTickets() {
      const { count } = await supabase
        .from('ticket_assignees')
        .select('id', { count: 'exact', head: true })
        .eq('assignee_id', currentUserId)
        .eq('status', 'open')

      setPendingTicketCount(count ?? 0)
    }

    loadPendingTickets()

    const channel = supabase
      .channel(`ticket-inbox-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_assignees', filter: `assignee_id=eq.${currentUserId}` },
        loadPendingTickets
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ticket_assignees', filter: `assignee_id=eq.${currentUserId}` },
        loadPendingTickets
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, role])

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
          { href: '/dashboard/assessment', label: t('navAssessment') },
          { href: '/dashboard/tasks', label: t('navTasks') },
          { href: '/dashboard/admin', label: t('navAdmin') },
          { href: '/dashboard/admin/knowledge-base', label: t('navKnowledgeBase') },
          { href: '/dashboard/admin/whatsapp', label: 'WhatsApp' },
          { href: '/dashboard/admin/properties', label: 'Property Data' },
        ]
      : [
          { href: '/dashboard/find-property', label: 'Find a Property' },
          ...(role === 'agent' ? [{ href: '/dashboard/daily-report', label: 'Daily Report' }] : []),
          ...(role === 'agent' ? [{ href: '/dashboard/whatsapp', label: 'WhatsApp' }] : []),
          ...(role === 'team_leader' ? [{ href: '/dashboard/admin/whatsapp', label: 'WhatsApp' }] : []),
          ...(role === 'agent' ? [
            { href: '/dashboard/practice', label: t('navAiPractice') },
            { href: '/dashboard/exam', label: t('navExam') },
          ] : []),
          { href: '/dashboard/assessment', label: t('navAssessment') },
          { href: '/dashboard/performance', label: 'Performance' },
          ...(role === 'team_leader' ? [{ href: '/dashboard/admin/reports', label: t('navReports') }] : []),
          { href: '/dashboard', label: role === 'agent' ? t('navMyCalls') : t('navTeamCalls') },
          { href: '/dashboard/tasks', label: t('navTasks') },
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
              const badgeCount = href === '/dashboard/tasks' ? pendingTicketCount : 0
              return (
                <a
                  key={href}
                  href={href}
                  className="relative text-xs font-semibold uppercase px-3 py-1.5 rounded-md transition-all"
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
                  {badgeCount > 0 && (
                    <span
                      title={t('ticketPendingTooltip')}
                      style={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        minWidth: 16,
                        height: 16,
                        padding: '0 4px',
                        borderRadius: 8,
                        background: NEON,
                        color: '#000',
                        fontSize: 10,
                        fontWeight: 700,
                        fontFamily: "'Space Grotesk', sans-serif",
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {badgeCount > 9 ? t('chatUnreadBadgeOverflow') : badgeCount}
                    </span>
                  )}
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
