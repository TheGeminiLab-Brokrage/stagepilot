'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/language-context'
import ChatThread from './ChatThread'
import TaskListView from './TaskListView'
import TaskListCreateModal from './TaskListCreateModal'
import type { ChatContact, ChatRole, TaskListSummary } from './chatTypes'

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
  onThreadRead,
  onTaskListCompleted,
  onClose,
}: {
  currentUserId: string
  companyId: string
  role: ChatRole
  unreadBySender: Record<string, number>
  onThreadRead: (contactId: string, count: number) => void
  onTaskListCompleted: () => void
  onClose: () => void
}) {
  const t = useT()
  const [contacts, setContacts] = useState<ChatContact[]>([])
  const [lastMessageAt, setLastMessageAt] = useState<Record<string, string>>({})
  const [taskLists, setTaskLists] = useState<TaskListSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ChatContact | null>(null)
  const [selectedTaskList, setSelectedTaskList] = useState<TaskListSummary | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const canCreateTaskList = role === 'super_admin' || role === 'team_leader'

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

    async function loadTaskLists() {
      const entries: TaskListSummary[] = []

      if (role === 'agent' || role === 'team_leader') {
        const { data: recipientRows } = await supabase
          .from('task_list_recipients')
          .select('task_list_id')
          .eq('recipient_id', currentUserId)

        const listIds = (recipientRows ?? []).map(r => r.task_list_id)
        if (listIds.length > 0) {
          const { data: lists } = await supabase
            .from('task_lists')
            .select('id, title, created_at')
            .in('id', listIds)

          const { data: items } = await supabase
            .from('task_list_items')
            .select('id, task_list_id')
            .in('task_list_id', listIds)

          const itemIds = (items ?? []).map(i => i.id)
          const { data: completions } = await supabase
            .from('task_list_item_completions')
            .select('task_list_item_id')
            .eq('recipient_id', currentUserId)
            .in('task_list_item_id', itemIds)

          const completedSet = new Set((completions ?? []).map(c => c.task_list_item_id))
          for (const list of lists ?? []) {
            const listItems = (items ?? []).filter(i => i.task_list_id === list.id)
            const remaining = listItems.filter(i => !completedSet.has(i.id)).length
            if (remaining > 0) {
              entries.push({
                id: list.id,
                title: list.title,
                createdAt: list.created_at,
                itemsTotal: listItems.length,
                itemsRemaining: remaining,
                mode: 'recipient',
              })
            }
          }
        }
      }

      if (role === 'super_admin' || role === 'team_leader') {
        const { data: lists } = await supabase
          .from('task_lists')
          .select('id, title, created_at')
          .eq('created_by', currentUserId)

        const listIds = (lists ?? []).map(l => l.id)
        const { data: items } = listIds.length > 0
          ? await supabase.from('task_list_items').select('id, task_list_id').in('task_list_id', listIds)
          : { data: [] }

        for (const list of lists ?? []) {
          const total = (items ?? []).filter(i => i.task_list_id === list.id).length
          entries.push({
            id: list.id,
            title: list.title,
            createdAt: list.created_at,
            itemsTotal: total,
            itemsRemaining: total,
            mode: 'owner',
          })
        }
      }

      setTaskLists(entries)
    }

    Promise.all([loadContacts(), loadLastMessageTimes(), loadTaskLists()]).then(() => setLoading(false))

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
  }, [companyId, currentUserId, role])

  function handleMessageSent(contactId: string, timestamp: string) {
    setLastMessageAt(prev => ({ ...prev, [contactId]: timestamp }))
  }

  function handleListCompleted(taskListId: string) {
    setTaskLists(prev => prev.filter(l => l.id !== taskListId))
    setSelectedTaskList(null)
    onTaskListCompleted()
  }

  function handleListCreated(newList: TaskListSummary) {
    setTaskLists(prev => [newList, ...prev])
    setShowCreateModal(false)
  }

  const filtered = contacts.filter(c => c.full_name.toLowerCase().includes(search.toLowerCase()))
  const orderedContacts = sortContacts(filtered, lastMessageAt)
  const pinnedAdmins = orderedContacts.filter(c => c.role === 'super_admin')
  const restContacts = orderedContacts.filter(c => c.role !== 'super_admin')
  const orderedTaskLists = [...taskLists].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

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
        <div className="flex items-center gap-2">
          {canCreateTaskList && !selected && !selectedTaskList && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-xs font-semibold px-2 py-1 rounded"
              style={{
                background: 'rgba(215,255,0,0.1)',
                color: NEON,
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {t('taskListCreateButton')}
            </button>
          )}
          <button onClick={onClose} className="text-lg leading-none" style={{ color: MUTED }}>
            ×
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {selectedTaskList ? (
          <TaskListView
            currentUserId={currentUserId}
            taskList={selectedTaskList}
            onBack={() => setSelectedTaskList(null)}
            onListCompleted={handleListCompleted}
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
              ) : pinnedAdmins.length === 0 && orderedTaskLists.length === 0 && restContacts.length === 0 ? (
                <div className="text-xs" style={{ color: MUTED }}>{t('chatEmptyContacts')}</div>
              ) : (
                <>
                  {pinnedAdmins.map(c => (
                    <ContactRow key={c.id} contact={c} unread={unreadBySender[c.id] ?? 0} onClick={() => setSelected(c)} />
                  ))}
                  {orderedTaskLists.map(list => (
                    <button
                      key={list.id}
                      onClick={() => setSelectedTaskList(list)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm text-left"
                      style={{ color: 'white', fontFamily: "'Montserrat', sans-serif" }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span style={{ color: NEON }}>☑</span>
                        <span className="truncate">{list.title}</span>
                      </span>
                      {list.mode === 'recipient' ? (
                        <span className="text-xs font-semibold px-1.5 rounded-full" style={{ background: NEON, color: '#000' }}>
                          {list.itemsRemaining}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: MUTED }}>
                          {list.itemsTotal} {t('taskListItemsLabel')}
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
        )}
      </div>

      {showCreateModal && (
        <TaskListCreateModal
          currentUserId={currentUserId}
          companyId={companyId}
          role={role}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleListCreated}
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
