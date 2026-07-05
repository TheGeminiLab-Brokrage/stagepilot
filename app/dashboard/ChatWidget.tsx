'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/language-context'
import ChatPanel from './ChatPanel'
import type { ChatRole } from './chatTypes'

const NEON = '#D7FF00'

export default function ChatWidget({
  currentUserId,
  companyId,
  role,
}: {
  currentUserId: string
  companyId: string
  role: ChatRole
}) {
  const t = useT()
  const [isOpen, setIsOpen] = useState(false)
  const [unreadTotal, setUnreadTotal] = useState(0)
  const [unreadBySender, setUnreadBySender] = useState<Record<string, number>>({})
  const [pendingTaskListCount, setPendingTaskListCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()

    async function loadUnread() {
      const { data } = await supabase
        .from('chat_messages')
        .select('sender_id')
        .eq('recipient_id', currentUserId)
        .is('read_at', null)

      const bySender: Record<string, number> = {}
      for (const row of data ?? []) {
        bySender[row.sender_id] = (bySender[row.sender_id] ?? 0) + 1
      }
      setUnreadBySender(bySender)
      setUnreadTotal((data ?? []).length)
    }

    loadUnread()

    const channel = supabase
      .channel(`chat-inbox-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `recipient_id=eq.${currentUserId}` },
        payload => {
          const senderId = (payload.new as { sender_id: string }).sender_id
          setUnreadTotal(t => t + 1)
          setUnreadBySender(prev => ({ ...prev, [senderId]: (prev[senderId] ?? 0) + 1 }))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId])

  useEffect(() => {
    if (role === 'super_admin') return
    const supabase = createClient()

    async function loadPendingTaskLists() {
      const { data: recipientRows } = await supabase
        .from('task_list_recipients')
        .select('task_list_id')
        .eq('recipient_id', currentUserId)

      const listIds = (recipientRows ?? []).map(r => r.task_list_id)
      if (listIds.length === 0) {
        setPendingTaskListCount(0)
        return
      }

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
      const listsWithRemaining = new Set(
        (items ?? []).filter(i => !completedSet.has(i.id)).map(i => i.task_list_id)
      )
      setPendingTaskListCount(listsWithRemaining.size)
    }

    loadPendingTaskLists()

    const channel = supabase
      .channel(`task-inbox-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'task_list_recipients', filter: `recipient_id=eq.${currentUserId}` },
        loadPendingTaskLists
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'task_list_item_completions', filter: `recipient_id=eq.${currentUserId}` },
        loadPendingTaskLists
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, role])

  function handleThreadRead(contactId: string, count: number) {
    setUnreadTotal(t => Math.max(0, t - count))
    setUnreadBySender(prev => {
      const next = { ...prev }
      const remaining = (next[contactId] ?? 0) - count
      if (remaining <= 0) delete next[contactId]
      else next[contactId] = remaining
      return next
    })
  }

  function handleTaskListCompleted() {
    setPendingTaskListCount(n => Math.max(0, n - 1))
  }

  const badgeText = unreadTotal > 9 ? t('chatUnreadBadgeOverflow') : String(unreadTotal)
  const taskBadgeText = pendingTaskListCount > 9 ? t('chatUnreadBadgeOverflow') : String(pendingTaskListCount)

  return (
    <>
      <button
        onClick={() => setIsOpen(v => !v)}
        title={t('chatIconTooltip')}
        aria-label={t('chatIconTooltip')}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'rgba(10,10,10,0.95)',
          border: `1px solid ${isOpen ? NEON : 'rgba(215,255,0,0.3)'}`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 60,
          cursor: 'pointer',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M4 4h16v12H7l-3 3V4z"
            stroke={NEON}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {unreadTotal > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 20,
              height: 20,
              padding: '0 5px',
              borderRadius: 10,
              background: '#FF3B30',
              color: 'white',
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "'Space Grotesk', sans-serif",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {badgeText}
          </span>
        )}

        {pendingTaskListCount > 0 && (
          <span
            title={t('taskListPendingTooltip')}
            style={{
              position: 'absolute',
              top: -4,
              left: -4,
              minWidth: 20,
              height: 20,
              padding: '0 5px',
              borderRadius: 10,
              background: NEON,
              color: '#000',
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "'Space Grotesk', sans-serif",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {taskBadgeText}
          </span>
        )}
      </button>

      {isOpen && (
        <ChatPanel
          currentUserId={currentUserId}
          companyId={companyId}
          role={role}
          unreadBySender={unreadBySender}
          onThreadRead={handleThreadRead}
          onTaskListCompleted={handleTaskListCompleted}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
