'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/language-context'
import ChatThread from './ChatThread'
import ChatGroupThread from './ChatGroupThread'
import ChatGroupCreateModal from './ChatGroupCreateModal'
import type { ChatContact, ChatGroupSummary, ChatRole } from './chatTypes'

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
  role,
  unreadBySender,
  unreadByGroup,
  onThreadRead,
  onGroupRead,
  onClose,
}: {
  currentUserId: string
  companyId: string
  role: ChatRole
  unreadBySender: Record<string, number>
  unreadByGroup: Record<string, number>
  onThreadRead: (contactId: string, count: number) => void
  onGroupRead: (groupId: string) => void
  onClose: () => void
}) {
  const t = useT()
  const [contacts, setContacts] = useState<ChatContact[]>([])
  const [lastMessageAt, setLastMessageAt] = useState<Record<string, string>>({})
  const [groups, setGroups] = useState<ChatGroupSummary[]>([])
  const [groupLastMessageAt, setGroupLastMessageAt] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ChatContact | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<ChatGroupSummary | null>(null)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)

  const canCreateGroup = role === 'super_admin' || role === 'team_leader'

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

    async function loadGroups() {
      const { data: groupRows } = await supabase
        .from('chat_groups')
        .select('id, name, created_by, created_at')
        .order('created_at', { ascending: false })

      const groupIds = (groupRows ?? []).map(g => g.id)
      if (groupIds.length === 0) {
        setGroups([])
        setGroupLastMessageAt({})
        return
      }

      const { data: memberRows } = await supabase
        .from('chat_group_members')
        .select('group_id')
        .in('group_id', groupIds)

      const memberCounts: Record<string, number> = {}
      for (const r of memberRows ?? []) memberCounts[r.group_id] = (memberCounts[r.group_id] ?? 0) + 1

      const { data: msgRows } = await supabase
        .from('chat_group_messages')
        .select('group_id, created_at')
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })

      const lastMessage: Record<string, string> = {}
      for (const m of msgRows ?? []) {
        if (!(m.group_id in lastMessage)) lastMessage[m.group_id] = m.created_at
      }

      setGroups(
        (groupRows ?? []).map(g => ({
          id: g.id,
          name: g.name,
          createdBy: g.created_by,
          createdAt: g.created_at,
          memberCount: memberCounts[g.id] ?? 0,
        }))
      )
      setGroupLastMessageAt(lastMessage)
    }

    Promise.all([loadContacts(), loadLastMessageTimes(), loadGroups()]).then(() => setLoading(false))

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
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_group_messages' },
        payload => {
          const row = payload.new as { group_id: string; created_at: string }
          setGroupLastMessageAt(prev => ({ ...prev, [row.group_id]: row.created_at }))
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

  function handleGroupCreated(newGroup: ChatGroupSummary) {
    setGroups(prev => [newGroup, ...prev])
    setShowCreateGroupModal(false)
  }

  const filtered = contacts.filter(c => c.full_name.toLowerCase().includes(search.toLowerCase()))
  const orderedContacts = sortContacts(filtered, lastMessageAt)
  const pinnedAdmins = orderedContacts.filter(c => c.role === 'super_admin')
  const restContacts = orderedContacts.filter(c => c.role !== 'super_admin')
  const orderedGroups = [...groups].sort((a, b) => {
    const aTime = groupLastMessageAt[a.id] ?? a.createdAt
    const bTime = groupLastMessageAt[b.id] ?? b.createdAt
    return new Date(bTime).getTime() - new Date(aTime).getTime()
  })

  return (
    <div
      className="flex flex-col"
      style={{
        position: 'fixed',
        bottom: 88,
        right: 24,
        width: 760,
        height: 560,
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
        <span className="text-sm font-semibold" style={{ color: NEON, fontFamily: "'Space Grotesk', sans-serif" }}>
          {t('messagesTabLabel')}
        </span>
        <div className="flex items-center gap-2">
          {canCreateGroup && (
            <button
              onClick={() => setShowCreateGroupModal(true)}
              className="text-xs font-semibold px-2 py-1 rounded"
              style={{
                background: 'rgba(215,255,0,0.1)',
                color: NEON,
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {t('chatCreateGroupButton')}
            </button>
          )}
          <button onClick={onClose} className="text-lg leading-none" style={{ color: MUTED }}>
            ×
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
        <div
          className="flex flex-col h-full"
          style={{ width: 280, flexShrink: 0, borderRight: `1px solid ${BORDER}` }}
        >
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
            ) : pinnedAdmins.length === 0 && orderedGroups.length === 0 && restContacts.length === 0 ? (
              <div className="text-xs" style={{ color: MUTED }}>{t('chatEmptyContacts')}</div>
            ) : (
              <>
                {pinnedAdmins.map(c => (
                  <ContactRow
                    key={c.id}
                    contact={c}
                    unread={unreadBySender[c.id] ?? 0}
                    active={selected?.id === c.id}
                    onClick={() => { setSelected(c); setSelectedGroup(null) }}
                  />
                ))}
                {orderedGroups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => { setSelectedGroup(group); setSelected(null) }}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm text-left"
                    style={{
                      color: 'white',
                      fontFamily: "'Montserrat', sans-serif",
                      background: selectedGroup?.id === group.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                    }}
                    onMouseEnter={e => {
                      if (selectedGroup?.id !== group.id) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = selectedGroup?.id === group.id ? 'rgba(255,255,255,0.06)' : 'transparent'
                    }}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span style={{ color: NEON }}>◈</span>
                      <span className="truncate">{group.name}</span>
                    </span>
                    {(unreadByGroup[group.id] ?? 0) > 0 && (
                      <span className="text-xs font-semibold px-1.5 rounded-full" style={{ background: NEON, color: '#000' }}>
                        {unreadByGroup[group.id]}
                      </span>
                    )}
                  </button>
                ))}
                {restContacts.map(c => (
                  <ContactRow
                    key={c.id}
                    contact={c}
                    unread={unreadBySender[c.id] ?? 0}
                    active={selected?.id === c.id}
                    onClick={() => { setSelected(c); setSelectedGroup(null) }}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 h-full">
          {selectedGroup ? (
            <ChatGroupThread
              currentUserId={currentUserId}
              companyId={companyId}
              group={selectedGroup}
              canManageMembers={role === 'super_admin' || selectedGroup.createdBy === currentUserId}
              onBack={() => setSelectedGroup(null)}
              onGroupRead={onGroupRead}
              hideBackButton
            />
          ) : selected ? (
            <ChatThread
              currentUserId={currentUserId}
              companyId={companyId}
              contact={selected}
              onBack={() => setSelected(null)}
              onMessagesRead={onThreadRead}
              onMessageSent={handleMessageSent}
              hideBackButton
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
              <span className="text-sm" style={{ color: MUTED, fontFamily: "'Montserrat', sans-serif" }}>
                {t('chatSelectConversationEmptyState')}
              </span>
            </div>
          )}
        </div>
      </div>

      {showCreateGroupModal && (
        <ChatGroupCreateModal
          currentUserId={currentUserId}
          companyId={companyId}
          onClose={() => setShowCreateGroupModal(false)}
          onCreated={handleGroupCreated}
        />
      )}
    </div>
  )
}

function ContactRow({
  contact,
  unread,
  active,
  onClick,
}: {
  contact: ChatContact
  unread: number
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm text-left"
      style={{
        color: 'white',
        fontFamily: "'Montserrat', sans-serif",
        background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
      onMouseLeave={e => { e.currentTarget.style.background = active ? 'rgba(255,255,255,0.06)' : 'transparent' }}
    >
      <span className="truncate">{contact.full_name}</span>
      {unread > 0 && (
        <span className="text-xs font-semibold px-1.5 rounded-full" style={{ background: NEON, color: '#000' }}>
          {unread}
        </span>
      )}
    </button>
  )
}
