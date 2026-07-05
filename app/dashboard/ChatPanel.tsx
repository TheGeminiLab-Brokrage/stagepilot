'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/language-context'
import ChatThread from './ChatThread'
import type { ChatContact, ChatRole } from './chatTypes'

const NEON = '#D7FF00'
const CARD = 'rgba(255,255,255,0.03)'
const BORDER = 'rgba(255,255,255,0.08)'
const MUTED = 'rgba(255,255,255,0.4)'

function groupContacts(contacts: ChatContact[], myTeamName: string | null, myRole: ChatRole) {
  const leadership = contacts.filter(
    c => c.role === 'super_admin' || (c.role === 'team_leader' && !!myTeamName && c.full_name === myTeamName)
  )
  const team =
    myRole === 'agent' ? contacts.filter(c => c.role === 'agent' && c.team_name === myTeamName) : []
  const leadershipIds = new Set(leadership.map(c => c.id))
  const teamIds = new Set(team.map(c => c.id))
  const rest = contacts.filter(c => !leadershipIds.has(c.id) && !teamIds.has(c.id))
  return { leadership, team, rest }
}

export default function ChatPanel({
  currentUserId,
  companyId,
  role,
  teamName,
  unreadBySender,
  onThreadRead,
  onClose,
}: {
  currentUserId: string
  companyId: string
  role: ChatRole
  teamName: string | null
  unreadBySender: Record<string, number>
  onThreadRead: (contactId: string, count: number) => void
  onClose: () => void
}) {
  const t = useT()
  const [contacts, setContacts] = useState<ChatContact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ChatContact | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('id, full_name, role, team_name')
      .eq('company_id', companyId)
      .in('role', ['agent', 'team_leader', 'super_admin'])
      .neq('id', currentUserId)
      .order('full_name', { ascending: true })
      .then(({ data }) => {
        setContacts((data ?? []) as ChatContact[])
        setLoading(false)
      })
  }, [companyId, currentUserId])

  const filtered = contacts.filter(c => c.full_name.toLowerCase().includes(search.toLowerCase()))
  const { leadership, team, rest } = groupContacts(filtered, teamName, role)

  const sections: { label: string; items: ChatContact[] }[] = [
    { label: t('chatSectionLeadership'), items: leadership },
    { label: t('chatSectionTeam'), items: team },
    { label: t('chatSectionCompany'), items: rest },
  ].filter(s => s.items.length > 0)

  return (
    <div
      className="flex flex-col"
      style={{
        position: 'fixed',
        bottom: 88,
        right: 24,
        width: 360,
        height: 520,
        background: 'rgba(10,10,10,0.98)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        zIndex: 60,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        <span
          className="text-sm font-semibold"
          style={{ color: NEON, fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {t('chatPanelTitle')}
        </span>
        <button onClick={onClose} className="text-lg leading-none" style={{ color: MUTED }}>
          ×
        </button>
      </div>

      <div className="flex-1 min-h-0">
        {selected ? (
          <ChatThread
            currentUserId={currentUserId}
            companyId={companyId}
            contact={selected}
            onBack={() => setSelected(null)}
            onMessagesRead={onThreadRead}
          />
        ) : (
          <div className="flex flex-col h-full">
            <div className="px-3 py-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('chatSearchPlaceholder')}
                className="w-full text-sm px-3 py-1.5 rounded-md outline-none"
                style={{
                  background: CARD,
                  border: `1px solid ${BORDER}`,
                  color: 'white',
                  fontFamily: "'Montserrat', sans-serif",
                }}
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
              {loading ? (
                <div className="text-xs" style={{ color: MUTED }}>…</div>
              ) : sections.length === 0 ? (
                <div className="text-xs" style={{ color: MUTED }}>{t('chatEmptyContacts')}</div>
              ) : (
                sections.map(section => (
                  <div key={section.label} className="mb-3">
                    <div
                      className="text-xs font-semibold uppercase mb-1"
                      style={{ color: MUTED, letterSpacing: '0.06em', fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      {section.label}
                    </div>
                    {section.items.map(c => {
                      const unread = unreadBySender[c.id] ?? 0
                      return (
                        <button
                          key={c.id}
                          onClick={() => setSelected(c)}
                          className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm text-left"
                          style={{ color: 'white', fontFamily: "'Montserrat', sans-serif" }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span className="truncate">{c.full_name}</span>
                          {unread > 0 && (
                            <span
                              className="text-xs font-semibold px-1.5 rounded-full"
                              style={{ background: NEON, color: '#000' }}
                            >
                              {unread}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
