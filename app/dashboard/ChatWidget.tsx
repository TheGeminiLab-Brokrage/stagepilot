'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/language-context'
import ChatPanel from './ChatPanel'
import type { ChatRole } from './chatTypes'

const NEON = '#D7FF00'

let sharedAudioContext: AudioContext | null = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!sharedAudioContext) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    sharedAudioContext = new Ctor()
  }
  return sharedAudioContext
}

function playChime() {
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  ;[880, 1320].forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const start = now + i * 0.09
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.2, start + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(start)
    osc.stop(start + 0.2)
  })
}

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
  const [unreadByGroup, setUnreadByGroup] = useState<Record<string, number>>({})
  const myGroupIdsRef = useRef<Set<string>>(new Set())
  const nameCacheRef = useRef<Record<string, string>>({})
  const groupNameCacheRef = useRef<Record<string, string>>({})

  async function resolveSenderName(senderId: string) {
    const cached = nameCacheRef.current[senderId]
    if (cached) return cached
    const supabase = createClient()
    const { data } = await supabase.from('profiles').select('full_name').eq('id', senderId).single()
    const name = data?.full_name ?? 'Someone'
    nameCacheRef.current[senderId] = name
    return name
  }

  async function resolveGroupName(groupId: string) {
    const cached = groupNameCacheRef.current[groupId]
    if (cached) return cached
    const supabase = createClient()
    const { data } = await supabase.from('chat_groups').select('name').eq('id', groupId).single()
    const name = data?.name ?? 'Group'
    groupNameCacheRef.current[groupId] = name
    return name
  }

  function attachmentPreview(body: string, attachmentKind: string | null) {
    if (attachmentKind === 'voice') return t('chatNotificationVoiceNoteLabel')
    if (attachmentKind === 'image') return t('chatNotificationImageLabel')
    if (attachmentKind === 'sticker') return t('chatNotificationStickerLabel')
    return body.length > 80 ? `${body.slice(0, 80)}…` : body
  }

  function notify(title: string, body: string) {
    playChime()
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return
    if (document.hasFocus()) return
    new Notification(title, { body, icon: '/favicon.ico' })
  }

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
          const row = payload.new as { sender_id: string; body: string; attachment_kind: string | null }
          setUnreadTotal(t => t + 1)
          setUnreadBySender(prev => ({ ...prev, [row.sender_id]: (prev[row.sender_id] ?? 0) + 1 }))
          resolveSenderName(row.sender_id).then(name => notify(name, attachmentPreview(row.body, row.attachment_kind)))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId])

  useEffect(() => {
    const supabase = createClient()

    async function loadGroupUnread() {
      const { data: memberRows } = await supabase
        .from('chat_group_members')
        .select('group_id')
        .eq('member_id', currentUserId)

      const groupIds = (memberRows ?? []).map(r => r.group_id)
      myGroupIdsRef.current = new Set(groupIds)
      if (groupIds.length === 0) {
        setUnreadByGroup({})
        return
      }

      const { data: readRows } = await supabase
        .from('chat_group_read_state')
        .select('group_id, last_read_at')
        .eq('member_id', currentUserId)
        .in('group_id', groupIds)
      const readMap: Record<string, string> = {}
      for (const r of readRows ?? []) readMap[r.group_id] = r.last_read_at

      const { data: msgRows } = await supabase
        .from('chat_group_messages')
        .select('group_id, sender_id, created_at')
        .in('group_id', groupIds)

      const counts: Record<string, number> = {}
      for (const m of msgRows ?? []) {
        if (m.sender_id === currentUserId) continue
        const readAt = readMap[m.group_id]
        if (!readAt || new Date(m.created_at) > new Date(readAt)) {
          counts[m.group_id] = (counts[m.group_id] ?? 0) + 1
        }
      }
      setUnreadByGroup(counts)
    }

    loadGroupUnread()

    // Postgres realtime filters only support simple equality, so an
    // "is this group_id in my membership set" check can't be expressed
    // server-side — subscribe unfiltered and check client-side instead
    // (same workaround ChatThread.tsx uses for the 1:1 recipient case).
    const messagesChannel = supabase
      .channel(`chat-group-inbox-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_group_messages' },
        payload => {
          const row = payload.new as { group_id: string; sender_id: string; body: string; attachment_kind: string | null }
          if (row.sender_id === currentUserId) return
          if (!myGroupIdsRef.current.has(row.group_id)) return
          setUnreadByGroup(prev => ({ ...prev, [row.group_id]: (prev[row.group_id] ?? 0) + 1 }))
          Promise.all([resolveSenderName(row.sender_id), resolveGroupName(row.group_id)]).then(([senderName, groupName]) => {
            notify(`${senderName} · ${groupName}`, attachmentPreview(row.body, row.attachment_kind))
          })
        }
      )
      .subscribe()

    const membersChannel = supabase
      .channel(`chat-group-membership-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_group_members', filter: `member_id=eq.${currentUserId}` },
        payload => {
          const row = payload.new as { group_id: string }
          myGroupIdsRef.current.add(row.group_id)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(messagesChannel)
      supabase.removeChannel(membersChannel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function handleGroupRead(groupId: string) {
    setUnreadByGroup(prev => {
      if (!(groupId in prev)) return prev
      const next = { ...prev }
      delete next[groupId]
      return next
    })
  }

  const groupUnreadTotal = Object.values(unreadByGroup).reduce((a, b) => a + b, 0)
  const combinedUnreadTotal = unreadTotal + groupUnreadTotal
  const badgeText = combinedUnreadTotal > 9 ? t('chatUnreadBadgeOverflow') : String(combinedUnreadTotal)

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(v => !v)
          getAudioContext()?.resume()
          if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission()
          }
        }}
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

        {combinedUnreadTotal > 0 && (
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
          role={role}
          unreadBySender={unreadBySender}
          unreadByGroup={unreadByGroup}
          onThreadRead={handleThreadRead}
          onGroupRead={handleGroupRead}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
