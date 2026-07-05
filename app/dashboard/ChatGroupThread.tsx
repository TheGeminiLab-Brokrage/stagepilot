'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/language-context'
import ChatGroupManageMembersModal from './ChatGroupManageMembersModal'
import type { ChatGroupMessageRow, ChatGroupSummary } from './chatTypes'

const NEON = '#D7FF00'
const CARD = 'rgba(255,255,255,0.03)'
const BORDER = 'rgba(255,255,255,0.08)'
const MUTED = 'rgba(255,255,255,0.4)'

export default function ChatGroupThread({
  currentUserId,
  companyId,
  group,
  canManageMembers,
  onBack,
  onGroupRead,
}: {
  currentUserId: string
  companyId: string
  group: ChatGroupSummary
  canManageMembers: boolean
  onBack: () => void
  onGroupRead: (groupId: string) => void
}) {
  const t = useT()
  const supabase = createClient()
  const [messages, setMessages] = useState<ChatGroupMessageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [showManageMembers, setShowManageMembers] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    async function loadThread() {
      setLoading(true)
      const { data } = await supabase
        .from('chat_group_messages')
        .select('id, group_id, sender_id, body, created_at')
        .eq('group_id', group.id)
        .order('created_at', { ascending: true })

      if (cancelled) return
      setMessages((data ?? []) as ChatGroupMessageRow[])
      setLoading(false)

      await supabase
        .from('chat_group_read_state')
        .upsert({ group_id: group.id, member_id: currentUserId, last_read_at: new Date().toISOString() }, { onConflict: 'group_id,member_id' })
      onGroupRead(group.id)
    }

    loadThread()

    const channel = supabase
      .channel(`chat-group-thread-${currentUserId}-${group.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_group_messages', filter: `group_id=eq.${group.id}` },
        async payload => {
          const row = payload.new as ChatGroupMessageRow
          setMessages(prev => [...prev, row])
          if (row.sender_id !== currentUserId) {
            await supabase
              .from('chat_group_read_state')
              .upsert({ group_id: group.id, member_id: currentUserId, last_read_at: new Date().toISOString() }, { onConflict: 'group_id,member_id' })
            onGroupRead(group.id)
          }
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id, currentUserId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  async function sendMessage() {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setDraft('')

    const { data, error } = await supabase
      .from('chat_group_messages')
      .insert({ company_id: companyId, sender_id: currentUserId, group_id: group.id, body })
      .select('id, group_id, sender_id, body, created_at')
      .single()

    if (!error && data) {
      const row = data as ChatGroupMessageRow
      setMessages(prev => [...prev, row])
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
          className="text-sm font-semibold truncate flex-1"
          style={{ color: 'white', fontFamily: "'Montserrat', sans-serif" }}
        >
          {group.name}
        </span>
        {canManageMembers && (
          <button
            onClick={() => setShowManageMembers(true)}
            className="text-xs font-semibold px-2 py-1 rounded"
            style={{ background: 'rgba(215,255,0,0.1)', color: NEON, fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {t('chatManageMembersButton')}
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 flex flex-col gap-2">
        {loading ? (
          <div className="text-xs" style={{ color: MUTED }}>…</div>
        ) : messages.length === 0 ? (
          <div className="text-xs" style={{ color: MUTED }}>{t('chatGroupEmptyMessages')}</div>
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

      {showManageMembers && (
        <ChatGroupManageMembersModal
          currentUserId={currentUserId}
          companyId={companyId}
          group={group}
          onClose={() => setShowManageMembers(false)}
          onMembersChanged={() => setShowManageMembers(false)}
        />
      )}
    </div>
  )
}
