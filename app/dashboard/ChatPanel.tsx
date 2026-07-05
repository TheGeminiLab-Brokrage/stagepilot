'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/language-context'
import ChatThread from './ChatThread'
import TicketDetailView from './TicketDetailView'
import TicketCreateModal from './TicketCreateModal'
import TicketCard from './TicketCard'
import ChatGroupThread from './ChatGroupThread'
import ChatGroupCreateModal from './ChatGroupCreateModal'
import type { ChatContact, ChatGroupSummary, ChatRole, TicketPriority, TicketSummary } from './chatTypes'

const NEON = '#D7FF00'
const CARD = 'rgba(255,255,255,0.03)'
const BORDER = 'rgba(255,255,255,0.08)'
const MUTED = 'rgba(255,255,255,0.4)'

const PRIORITY_RANK: Record<TicketPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

function isTicketDone(ticket: TicketSummary) {
  return ticket.mode === 'assignee'
    ? ticket.myStatus === 'done'
    : (ticket.assigneeCount ?? 0) > 0 && ticket.doneCount === ticket.assigneeCount
}

function sortOpenTickets(tickets: TicketSummary[]) {
  return [...tickets].sort((a, b) => {
    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
    if (aDue !== bDue) return aDue - bDue
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  })
}

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
  onTicketStatusChanged,
  onClose,
}: {
  currentUserId: string
  companyId: string
  role: ChatRole
  unreadBySender: Record<string, number>
  unreadByGroup: Record<string, number>
  onThreadRead: (contactId: string, count: number) => void
  onGroupRead: (groupId: string) => void
  onTicketStatusChanged: (delta: number) => void
  onClose: () => void
}) {
  const t = useT()
  const [activeTab, setActiveTab] = useState<'messages' | 'tasks'>('messages')
  const [contacts, setContacts] = useState<ChatContact[]>([])
  const [lastMessageAt, setLastMessageAt] = useState<Record<string, string>>({})
  const [tickets, setTickets] = useState<TicketSummary[]>([])
  const [showDone, setShowDone] = useState(false)
  const [groups, setGroups] = useState<ChatGroupSummary[]>([])
  const [groupLastMessageAt, setGroupLastMessageAt] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ChatContact | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<TicketSummary | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<ChatGroupSummary | null>(null)
  const [showCreateTicketModal, setShowCreateTicketModal] = useState(false)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const myOwnedTicketIdsRef = useRef<Set<string>>(new Set())

  const canCreateTicket = role === 'super_admin' || role === 'team_leader'
  const canCreateGroup = role === 'super_admin' || role === 'team_leader'

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function loadTickets() {
    const supabase = createClient()
    const entries: TicketSummary[] = []

    if (role === 'agent' || role === 'team_leader') {
      const { data: assigneeRows } = await supabase
        .from('ticket_assignees')
        .select('id, ticket_id, status')
        .eq('assignee_id', currentUserId)

      const ticketIds = (assigneeRows ?? []).map(r => r.ticket_id)
      if (ticketIds.length > 0) {
        const { data: ticketRows } = await supabase
          .from('tickets')
          .select('id, title, description, priority, due_date, created_at, created_by')
          .in('id', ticketIds)

        const { data: attachmentRows } = await supabase
          .from('ticket_attachments')
          .select('ticket_id')
          .in('ticket_id', ticketIds)

        const attachmentCounts: Record<string, number> = {}
        for (const a of attachmentRows ?? []) attachmentCounts[a.ticket_id] = (attachmentCounts[a.ticket_id] ?? 0) + 1

        for (const assigneeRow of assigneeRows ?? []) {
          const ticketRow = (ticketRows ?? []).find(tk => tk.id === assigneeRow.ticket_id)
          if (!ticketRow) continue
          entries.push({
            id: ticketRow.id,
            title: ticketRow.title,
            description: ticketRow.description,
            priority: ticketRow.priority,
            dueDate: ticketRow.due_date,
            createdAt: ticketRow.created_at,
            createdBy: ticketRow.created_by,
            mode: 'assignee',
            myAssigneeRowId: assigneeRow.id,
            myStatus: assigneeRow.status,
            attachmentCount: attachmentCounts[ticketRow.id] ?? 0,
          })
        }
      }
    }

    if (role === 'super_admin' || role === 'team_leader') {
      const { data: ticketRows } = await supabase
        .from('tickets')
        .select('id, title, description, priority, due_date, created_at, created_by')
        .eq('created_by', currentUserId)

      const ticketIds = (ticketRows ?? []).map(tk => tk.id)
      myOwnedTicketIdsRef.current = new Set(ticketIds)

      const [{ data: assigneeRows }, { data: attachmentRows }] = ticketIds.length > 0
        ? await Promise.all([
            supabase.from('ticket_assignees').select('ticket_id, status').in('ticket_id', ticketIds),
            supabase.from('ticket_attachments').select('ticket_id').in('ticket_id', ticketIds),
          ])
        : [{ data: [] }, { data: [] }]

      const attachmentCounts: Record<string, number> = {}
      for (const a of attachmentRows ?? []) attachmentCounts[a.ticket_id] = (attachmentCounts[a.ticket_id] ?? 0) + 1

      for (const ticketRow of ticketRows ?? []) {
        const ticketAssignees = (assigneeRows ?? []).filter(a => a.ticket_id === ticketRow.id)
        entries.push({
          id: ticketRow.id,
          title: ticketRow.title,
          description: ticketRow.description,
          priority: ticketRow.priority,
          dueDate: ticketRow.due_date,
          createdAt: ticketRow.created_at,
          createdBy: ticketRow.created_by,
          mode: 'owner',
          assigneeCount: ticketAssignees.length,
          doneCount: ticketAssignees.filter(a => a.status === 'done').length,
          attachmentCount: attachmentCounts[ticketRow.id] ?? 0,
        })
      }
    }

    setTickets(entries)
  }

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

    Promise.all([loadContacts(), loadLastMessageTimes(), loadTickets(), loadGroups()]).then(() => setLoading(false))

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
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_assignees' },
        payload => {
          const row = payload.new as { assignee_id: string; ticket_id: string }
          if (row.assignee_id === currentUserId || myOwnedTicketIdsRef.current.has(row.ticket_id)) loadTickets()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ticket_assignees' },
        payload => {
          const row = payload.new as { assignee_id: string; ticket_id: string }
          if (row.assignee_id === currentUserId || myOwnedTicketIdsRef.current.has(row.ticket_id)) loadTickets()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, currentUserId, role])

  function handleMessageSent(contactId: string, timestamp: string) {
    setLastMessageAt(prev => ({ ...prev, [contactId]: timestamp }))
  }

  async function handleToggleTicketStatus(ticket: TicketSummary) {
    if (ticket.mode !== 'assignee' || !ticket.myAssigneeRowId) return
    const nextStatus = ticket.myStatus === 'done' ? 'open' : 'done'
    const delta = nextStatus === 'done' ? -1 : 1

    setTickets(prev => prev.map(tk => (tk.id === ticket.id ? { ...tk, myStatus: nextStatus } : tk)))
    setSelectedTicket(prev => (prev && prev.id === ticket.id ? { ...prev, myStatus: nextStatus } : prev))
    onTicketStatusChanged(delta)

    const supabase = createClient()
    await supabase.from('ticket_assignees').update({ status: nextStatus }).eq('id', ticket.myAssigneeRowId)
  }

  function handleTicketCreated(newTicket: TicketSummary) {
    setTickets(prev => [newTicket, ...prev])
    setShowCreateTicketModal(false)
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

  const openTickets = sortOpenTickets(tickets.filter(tk => !isTicketDone(tk)))
  const doneTickets = tickets.filter(isTicketDone)

  const noDetailOpen = !selected && !selectedTicket && !selectedGroup

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
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('messages')}
            className="text-sm font-semibold"
            style={{ color: activeTab === 'messages' ? NEON : MUTED, fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {t('messagesTabLabel')}
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className="text-sm font-semibold"
            style={{ color: activeTab === 'tasks' ? NEON : MUTED, fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {t('tasksTabLabel')}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'messages' && canCreateGroup && noDetailOpen && (
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
          {activeTab === 'tasks' && canCreateTicket && noDetailOpen && (
            <button
              onClick={() => setShowCreateTicketModal(true)}
              className="text-xs font-semibold px-2 py-1 rounded"
              style={{
                background: 'rgba(215,255,0,0.1)',
                color: NEON,
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {t('ticketCreateButton')}
            </button>
          )}
          <button onClick={onClose} className="text-lg leading-none" style={{ color: MUTED }}>
            ×
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {selectedGroup ? (
          <ChatGroupThread
            currentUserId={currentUserId}
            companyId={companyId}
            group={selectedGroup}
            canManageMembers={role === 'super_admin' || selectedGroup.createdBy === currentUserId}
            onBack={() => setSelectedGroup(null)}
            onGroupRead={onGroupRead}
          />
        ) : selectedTicket ? (
          <TicketDetailView
            ticket={selectedTicket}
            onBack={() => setSelectedTicket(null)}
            onToggleStatus={() => handleToggleTicketStatus(selectedTicket)}
          />
        ) : selected ? (
          <ChatThread
            currentUserId={currentUserId}
            companyId={companyId}
            contact={selected}
            onBack={() => setSelected(null)}
            onMessagesRead={onThreadRead}
            onMessageSent={handleMessageSent}
          />
        ) : activeTab === 'messages' ? (
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
              ) : pinnedAdmins.length === 0 && orderedGroups.length === 0 && restContacts.length === 0 ? (
                <div className="text-xs" style={{ color: MUTED }}>{t('chatEmptyContacts')}</div>
              ) : (
                <>
                  {pinnedAdmins.map(c => (
                    <ContactRow key={c.id} contact={c} unread={unreadBySender[c.id] ?? 0} onClick={() => setSelected(c)} />
                  ))}
                  {orderedGroups.map(group => (
                    <button
                      key={group.id}
                      onClick={() => setSelectedGroup(group)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm text-left"
                      style={{ color: 'white', fontFamily: "'Montserrat', sans-serif" }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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
                    <ContactRow key={c.id} contact={c} unread={unreadBySender[c.id] ?? 0} onClick={() => setSelected(c)} />
                  ))}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 flex flex-col gap-2">
            {loading ? (
              <div className="text-xs" style={{ color: MUTED }}>…</div>
            ) : openTickets.length === 0 && doneTickets.length === 0 ? (
              <div className="text-xs" style={{ color: MUTED }}>
                {role === 'agent' ? t('ticketEmptyState') : t('ticketOwnerEmptyState')}
              </div>
            ) : (
              <>
                {openTickets.map(ticket => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onOpen={() => setSelectedTicket(ticket)}
                    onToggleStatus={() => handleToggleTicketStatus(ticket)}
                  />
                ))}
                {doneTickets.length > 0 && (
                  <div className="flex flex-col gap-2 mt-2">
                    <button
                      onClick={() => setShowDone(v => !v)}
                      className="text-xs font-semibold uppercase self-start"
                      style={{ color: MUTED, letterSpacing: '0.06em', fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      {t('ticketDoneSectionLabel')} ({doneTickets.length}) {showDone ? '▲' : '▼'}
                    </button>
                    {showDone &&
                      doneTickets.map(ticket => (
                        <TicketCard
                          key={ticket.id}
                          ticket={ticket}
                          onOpen={() => setSelectedTicket(ticket)}
                          onToggleStatus={() => handleToggleTicketStatus(ticket)}
                        />
                      ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {showCreateTicketModal && (
        <TicketCreateModal
          currentUserId={currentUserId}
          companyId={companyId}
          role={role}
          onClose={() => setShowCreateTicketModal(false)}
          onCreated={handleTicketCreated}
        />
      )}

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

function ContactRow({ contact, unread, onClick }: { contact: ChatContact; unread: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm text-left"
      style={{ color: 'white', fontFamily: "'Montserrat', sans-serif" }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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
