'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/language-context'
import type { ChatContact, ChatMessageRow } from './chatTypes'

const NEON = '#D7FF00'
const CARD = 'rgba(255,255,255,0.03)'
const BORDER = 'rgba(255,255,255,0.08)'
const MUTED = 'rgba(255,255,255,0.4)'

export default function ChatThread({
  currentUserId,
  companyId,
  contact,
  onBack,
  onMessagesRead,
}: {
  currentUserId: string
  companyId: string
  contact: ChatContact
  onBack: () => void
  onMessagesRead: (contactId: string, count: number) => void
}) {
  const t = useT()
  const supabase = createClient()
  const [messages, setMessages] = useState<ChatMessageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    async function loadThread() {
      setLoading(true)
      const { data } = await supabase
        .from('chat_messages')
        .select('id, sender_id, recipient_id, body, created_at, read_at')
        .or(
          `and(sender_id.eq.${currentUserId},recipient_id.eq.${contact.id}),and(sender_id.eq.${contact.id},recipient_id.eq.${currentUserId})`
        )
        .order('created_at', { ascending: true })

      if (cancelled) return
      const rows = (data ?? []) as ChatMessageRow[]
      setMessages(rows)
      setLoading(false)

      const unreadIds = rows
        .filter(m => m.recipient_id === currentUserId && m.read_at === null)
        .map(m => m.id)

      if (unreadIds.length > 0) {
        await supabase
          .from('chat_messages')
          .update({ read_at: new Date().toISOString() })
          .in('id', unreadIds)
        onMessagesRead(contact.id, unreadIds.length)
      }
    }

    loadThread()

    const channel = supabase
      .channel(`chat-thread-${currentUserId}-${contact.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `sender_id=eq.${contact.id}` },
        async payload => {
          const row = payload.new as ChatMessageRow
          if (row.recipient_id !== currentUserId) return
          setMessages(prev => [...prev, row])
          await supabase
            .from('chat_messages')
            .update({ read_at: new Date().toISOString() })
            .eq('id', row.id)
          onMessagesRead(contact.id, 1)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `recipient_id=eq.${contact.id}` },
        payload => {
          const row = payload.new as ChatMessageRow
          if (row.sender_id !== currentUserId) return
          setMessages(prev => prev.map(m => (m.id === row.id ? row : m)))
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact.id, currentUserId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  async function sendMessage() {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setDraft('')

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({ company_id: companyId, sender_id: currentUserId, recipient_id: contact.id, body })
      .select('id, sender_id, recipient_id, body, created_at, read_at')
      .single()

    if (!error && data) {
      setMessages(prev => [...prev, data as ChatMessageRow])
    }
    setSending(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        <button
          onClick={onBack}
          className="text-sm px-1.5 py-0.5 rounded"
          style={{ color: MUTED, fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {t('chatBackToContacts')}
        </button>
        <span
          className="text-sm font-semibold truncate"
          style={{ color: 'white', fontFamily: "'Montserrat', sans-serif" }}
        >
          {contact.full_name}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 flex flex-col gap-2">
        {loading ? (
          <div className="text-xs" style={{ color: MUTED }}>…</div>
        ) : messages.length === 0 ? (
          <div className="text-xs" style={{ color: MUTED }}>{t('chatEmptyThread')}</div>
        ) : (
          messages.map(m => {
            const mine = m.sender_id === currentUserId
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[80%] px-3 py-1.5 rounded-lg text-sm"
                  style={{
                    background: mine ? 'rgba(215,255,0,0.12)' : CARD,
                    color: mine ? NEON : 'rgba(255,255,255,0.85)',
                    border: `1px solid ${mine ? 'rgba(215,255,0,0.25)' : BORDER}`,
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                >
                  {m.body}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 px-3 py-2" style={{ borderTop: `1px solid ${BORDER}` }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendMessage()
            }
          }}
          placeholder={t('chatMessagePlaceholder')}
          className="flex-1 text-sm px-3 py-1.5 rounded-md outline-none"
          style={{
            background: CARD,
            border: `1px solid ${BORDER}`,
            color: 'white',
            fontFamily: "'Montserrat', sans-serif",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!draft.trim() || sending}
          className="text-xs font-semibold uppercase px-3 py-1.5 rounded-md"
          style={{
            background: 'rgba(215,255,0,0.12)',
            color: NEON,
            border: '1px solid rgba(215,255,0,0.25)',
            opacity: !draft.trim() || sending ? 0.5 : 1,
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {t('chatSendButton')}
        </button>
      </div>
    </div>
  )
}
