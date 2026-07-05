'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/language-context'
import ChatPanel from './ChatPanel'

const NEON = '#D7FF00'

export default function ChatWidget({
  currentUserId,
  companyId,
}: {
  currentUserId: string
  companyId: string
}) {
  const t = useT()
  const [isOpen, setIsOpen] = useState(false)
  const [unreadTotal, setUnreadTotal] = useState(0)
  const [unreadBySender, setUnreadBySender] = useState<Record<string, number>>({})

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

  const badgeText = unreadTotal > 9 ? t('chatUnreadBadgeOverflow') : String(unreadTotal)

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
      </button>

      {isOpen && (
        <ChatPanel
          currentUserId={currentUserId}
          companyId={companyId}
          unreadBySender={unreadBySender}
          onThreadRead={handleThreadRead}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
