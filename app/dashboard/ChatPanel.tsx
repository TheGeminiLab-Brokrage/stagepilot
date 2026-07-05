'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/language-context'
import ChatThread from './ChatThread'
import type { ChatContact } from './chatTypes'

const NEON = '#D7FF00'
const CARD = 'rgba(255,255,255,0.03)'
const BORDER = 'rgba(255,255,255,0.08)'
const MUTED = 'rgba(255,255,255,0.4)'

function sortContacts(contacts: ChatContact[], lastMessageAt: Record<string, string>) {
  const pinned = contacts
    .filter(c => c.role === 'super_admin')
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  const rest = contacts.filter(c => c.role !== 'super_admin')
  const withHistory = rest
    .filter(c => lastMessageAt[c.id])
    .sort((a, b) => new Date(lastMessageAt[b.id]).getTime() - new Date(lastMessageAt[a.id]).getTime())
  const withoutHistory = rest
    .filter(c => !lastMessageAt[c.id])
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  return [...pinned, ...withHistory, ...withoutHistory]
}

export default function ChatPanel({
  currentUserId,
  companyId,
  unreadBySender,
  onThreadRead,
  onClose,
}: {
  currentUserId: string
  companyId: string
  unreadBySender: Record<string, number>
  onThreadRead: (contactId: string, count: number) => void
  onClose: () => void
}) {
  const t = useT()
  const [contacts, setContacts] = useState<ChatContact[]>([])
  const [lastMessageAt, setLastMessageAt] = useState<Record<string, string>>({})
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

    async function loadContacts() {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role, team_name')
        .eq('company_id', companyId)
        .in('role', ['agent', 'team_leader', 'super_admin'])
        .neq('id', currentUserId)
        .order('full_name', { ascending: true })
      setContacts((data ?? []) as ChatContact[])
      setLoading(false)
    }

    async function loadLastMessageTimes() {
      const { data } = await supabase
        .from('chat_messages')
        .select('sender_id, recipient_id, created_at')
        .or(`sender_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`)
        .order('created_at', { ascending: false })

      const map: Record<string, string> = {}
      for (const row of data ?? []) {
        const counterpartId = row.sender_id === currentUserId ? row.recipient_id : row.sender_id
        if (!(counterpartId in map)) map[counterpartId] = row.created_at
      }
      setLastMessageAt(map)
    }

    loadContacts()
    loadLastMessageTimes()

    const channel = supabase
      .channel(`chat-panel-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `recipient_id=eq.${currentUserId}` },
        payload => {
          const row = payload.new as { sender_id: string; created_at: string }
          setLastMessageAt(prev => ({ ...prev, [row.sender_id]: row.created_at }))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [companyId, currentUserId])

  function handleMessageSent(contactId: string, timestamp: string) {
    setLastMessageAt(prev => ({ ...prev, [contactId]: timestamp }))
  }

  const filtered = contacts.filter(c => c.full_name.toLowerCase().includes(search.toLowerCase()))
  const ordered = sortContacts(filtered, lastMessageAt)

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
            onMessageSent={handleMessageSent}
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
              ) : ordered.length === 0 ? (
                <div className="text-xs" style={{ color: MUTED }}>{t('chatEmptyContacts')}</div>
              ) : (
                ordered.map(c => {
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
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
