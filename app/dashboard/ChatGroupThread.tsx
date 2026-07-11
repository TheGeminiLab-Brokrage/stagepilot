'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/language-context'
import ChatGroupManageMembersModal from './ChatGroupManageMembersModal'
import QuickReactPopover from './QuickReactPopover'
import { STICKER_CATALOG, type ChatGroupMessageRow, type ChatGroupSummary, type ChatReactionRow, type ReactionEmoji, type ReactionMap } from './chatTypes'

const NEON = '#D7FF00'
const CARD = 'rgba(255,255,255,0.03)'
const BORDER = 'rgba(255,255,255,0.08)'
const MUTED = 'rgba(255,255,255,0.4)'

const GROUP_MESSAGE_COLUMNS = 'id, group_id, sender_id, body, created_at, attachment_path, attachment_kind, attachment_duration_seconds'

export default function ChatGroupThread({
  currentUserId,
  companyId,
  group,
  canManageMembers,
  onBack,
  onGroupRead,
  hideBackButton = false,
}: {
  currentUserId: string
  companyId: string
  group: ChatGroupSummary
  canManageMembers: boolean
  onBack: () => void
  onGroupRead: (groupId: string) => void
  hideBackButton?: boolean
}) {
  const t = useT()
  const supabase = createClient()
  const [messages, setMessages] = useState<ChatGroupMessageRow[]>([])
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [showManageMembers, setShowManageMembers] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [pendingVoiceNote, setPendingVoiceNote] = useState<{ blob: Blob; url: string; seconds: number } | null>(null)
  const [voiceError, setVoiceError] = useState('')
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null)
  const [imageError, setImageError] = useState('')
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [memberNames, setMemberNames] = useState<Record<string, string>>({})
  const [readState, setReadState] = useState<Record<string, string>>({})
  const [reactions, setReactions] = useState<ReactionMap>({})
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null)
  const [reactionPicker, setReactionPicker] = useState<{ messageId: string; top: number; left: number } | null>(null)
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingSecondsRef = useRef(0)
  const imageFileRef = useRef<HTMLInputElement>(null)
  const messageIdsRef = useRef<Set<string>>(new Set())
  const stickerButtonRef = useRef<HTMLButtonElement>(null)
  const stickerPopoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messageIdsRef.current = new Set(messages.map(m => m.id))
  }, [messages])

  useEffect(() => {
    if (!stickerPickerOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (
        stickerPopoverRef.current && !stickerPopoverRef.current.contains(e.target as Node) &&
        stickerButtonRef.current && !stickerButtonRef.current.contains(e.target as Node)
      ) {
        setStickerPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [stickerPickerOpen])

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop())
    }
  }, [])

  async function resolveAttachmentUrls(rows: ChatGroupMessageRow[]) {
    const paths = rows.filter(m => m.attachment_path).map(m => m.attachment_path as string)
    if (paths.length === 0) return
    const { data } = await supabase.storage.from('chat-attachments').createSignedUrls(paths, 3600)
    if (!data) return
    setAttachmentUrls(prev => {
      const next = { ...prev }
      for (const row of rows) {
        if (!row.attachment_path) continue
        const signed = data.find(d => d.path === row.attachment_path)
        if (signed?.signedUrl) next[row.id] = signed.signedUrl
      }
      return next
    })
  }

  async function loadReactions(messageIds: string[]) {
    if (messageIds.length === 0) return
    const { data } = await supabase
      .from('chat_group_message_reactions')
      .select('message_id, user_id, emoji')
      .in('message_id', messageIds)
    if (!data) return
    setReactions(prev => {
      const next = { ...prev }
      for (const r of data as { message_id: string; user_id: string; emoji: ReactionEmoji }[]) {
        next[r.message_id] = { ...(next[r.message_id] ?? {}) }
        next[r.message_id][r.emoji] = [...(next[r.message_id][r.emoji] ?? []), r.user_id]
      }
      return next
    })
  }

  function applyReactionEvent(payload: { eventType: string; new: ChatReactionRow | null; old: ChatReactionRow | null }) {
    const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as ChatReactionRow | null
    if (!row || !messageIdsRef.current.has(row.message_id)) return
    setReactions(prev => {
      const next = { ...prev }
      const forMessage = { ...(next[row.message_id] ?? {}) }
      for (const emoji of Object.keys(forMessage) as ReactionEmoji[]) {
        forMessage[emoji] = forMessage[emoji]!.filter(uid => uid !== row.user_id)
        if (forMessage[emoji]!.length === 0) delete forMessage[emoji]
      }
      if (payload.eventType !== 'DELETE') {
        forMessage[row.emoji] = [...(forMessage[row.emoji] ?? []), row.user_id]
      }
      next[row.message_id] = forMessage
      return next
    })
  }

  useEffect(() => {
    let cancelled = false

    async function loadThread() {
      setLoading(true)
      const { data } = await supabase
        .from('chat_group_messages')
        .select(GROUP_MESSAGE_COLUMNS)
        .eq('group_id', group.id)
        .order('created_at', { ascending: true })

      if (cancelled) return
      const rows = (data ?? []) as ChatGroupMessageRow[]
      setMessages(rows)
      setLoading(false)
      resolveAttachmentUrls(rows)
      loadReactions(rows.map(m => m.id))

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
          if (row.sender_id === currentUserId) return
          setMessages(prev => [...prev, row])
          resolveAttachmentUrls([row])
          await supabase
            .from('chat_group_read_state')
            .upsert({ group_id: group.id, member_id: currentUserId, last_read_at: new Date().toISOString() }, { onConflict: 'group_id,member_id' })
          onGroupRead(group.id)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_group_message_reactions' },
        payload => applyReactionEvent(payload as unknown as { eventType: string; new: ChatReactionRow | null; old: ChatReactionRow | null })
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id, currentUserId])

  useEffect(() => {
    let cancelled = false

    async function loadRosterAndReadState() {
      const { data: memberRows } = await supabase
        .from('chat_group_members')
        .select('member_id')
        .eq('group_id', group.id)

      const memberIds = (memberRows ?? []).map(r => r.member_id)
      if (memberIds.length > 0) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', memberIds)

        if (!cancelled && profileRows) {
          const names: Record<string, string> = {}
          for (const p of profileRows) names[p.id] = p.full_name
          setMemberNames(names)
        }
      }

      const { data: readRows } = await supabase
        .from('chat_group_read_state')
        .select('member_id, last_read_at')
        .eq('group_id', group.id)

      if (!cancelled) {
        const map: Record<string, string> = {}
        for (const r of readRows ?? []) map[r.member_id] = r.last_read_at
        setReadState(map)
      }
    }

    loadRosterAndReadState()

    const channel = supabase
      .channel(`chat-group-read-state-${group.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_group_read_state', filter: `group_id=eq.${group.id}` },
        payload => {
          const row = payload.new as { member_id: string; last_read_at: string }
          setReadState(prev => ({ ...prev, [row.member_id]: row.last_read_at }))
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_group_read_state', filter: `group_id=eq.${group.id}` },
        payload => {
          const row = payload.new as { member_id: string; last_read_at: string }
          setReadState(prev => ({ ...prev, [row.member_id]: row.last_read_at }))
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id])

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
      .select(GROUP_MESSAGE_COLUMNS)
      .single()

    if (!error && data) {
      const row = data as ChatGroupMessageRow
      setMessages(prev => [...prev, row])
    }
    setSending(false)
  }

  async function toggleReaction(messageId: string, emoji: ReactionEmoji) {
    const mine = reactions[messageId]?.[emoji]?.includes(currentUserId)
    if (mine) {
      await supabase
        .from('chat_group_message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', currentUserId)
    } else {
      await supabase
        .from('chat_group_message_reactions')
        .upsert({ message_id: messageId, user_id: currentUserId, emoji }, { onConflict: 'message_id,user_id' })
    }
  }

  async function sendSticker(slug: string) {
    if (sending) return
    setSending(true)

    const { data, error } = await supabase
      .from('chat_group_messages')
      .insert({
        company_id: companyId,
        sender_id: currentUserId,
        group_id: group.id,
        body: '',
        attachment_path: slug,
        attachment_kind: 'sticker',
        attachment_duration_seconds: null,
      })
      .select(GROUP_MESSAGE_COLUMNS)
      .single()

    if (!error && data) {
      const row = data as ChatGroupMessageRow
      setMessages(prev => [...prev, row])
    }
    setStickerPickerOpen(false)
    setSending(false)
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recordingChunksRef.current = []

      recorder.ondataavailable = e => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        setPendingVoiceNote({ blob, url: URL.createObjectURL(blob), seconds: recordingSecondsRef.current })
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setVoiceError('')
      setIsRecording(true)
      recordingSecondsRef.current = 0
      setRecordingSeconds(0)
      recordingTimerRef.current = setInterval(() => {
        recordingSecondsRef.current += 1
        setRecordingSeconds(s => s + 1)
      }, 1000)
    } catch {
      setVoiceError(t('chatMicPermissionError'))
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }

  function discardVoiceNote() {
    if (pendingVoiceNote) URL.revokeObjectURL(pendingVoiceNote.url)
    setPendingVoiceNote(null)
  }

  function formatSeconds(total: number) {
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  async function sendVoiceNote() {
    if (!pendingVoiceNote || sending) return
    setSending(true)
    setVoiceError('')

    const path = `${companyId}/group/${group.id}/${crypto.randomUUID()}.webm`
    const { error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(path, pendingVoiceNote.blob, { contentType: pendingVoiceNote.blob.type || 'audio/webm' })

    if (uploadError) {
      console.error('Voice note upload failed:', uploadError.message)
      setVoiceError(t('chatVoiceNoteUploadError'))
      setSending(false)
      return
    }

    const { data, error } = await supabase
      .from('chat_group_messages')
      .insert({
        company_id: companyId,
        sender_id: currentUserId,
        group_id: group.id,
        body: '',
        attachment_path: path,
        attachment_kind: 'voice',
        attachment_duration_seconds: pendingVoiceNote.seconds,
      })
      .select(GROUP_MESSAGE_COLUMNS)
      .single()

    if (error || !data) {
      console.error('Voice note message insert failed:', error?.message)
      setVoiceError(t('chatVoiceNoteUploadError'))
      setSending(false)
      return
    }

    const row = data as ChatGroupMessageRow
    const { data: signed } = await supabase.storage.from('chat-attachments').createSignedUrl(path, 3600)
    if (signed?.signedUrl) setAttachmentUrls(prev => ({ ...prev, [row.id]: signed.signedUrl }))

    setMessages(prev => [...prev, row])
    URL.revokeObjectURL(pendingVoiceNote.url)
    setPendingVoiceNote(null)
    setSending(false)
  }

  function fileExtension(file: File) {
    const fromName = file.name.includes('.') ? file.name.split('.').pop() : undefined
    if (fromName && fromName.length <= 5) return fromName.toLowerCase()
    if (file.type === 'image/png') return 'png'
    if (file.type === 'image/webp') return 'webp'
    if (file.type === 'image/gif') return 'gif'
    return 'jpg'
  }

  function pickImage(file: File | null) {
    if (!file) return
    setImageError('')
    setPendingImage({ file, previewUrl: URL.createObjectURL(file) })
  }

  function discardPendingImage() {
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl)
    setPendingImage(null)
  }

  async function sendImage() {
    if (!pendingImage || sending) return
    setSending(true)
    setImageError('')

    const path = `${companyId}/group/${group.id}/${crypto.randomUUID()}.${fileExtension(pendingImage.file)}`
    const { error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(path, pendingImage.file, { contentType: pendingImage.file.type || 'application/octet-stream' })

    if (uploadError) {
      setImageError(t('chatImageUploadError'))
      setSending(false)
      return
    }

    const { data, error } = await supabase
      .from('chat_group_messages')
      .insert({
        company_id: companyId,
        sender_id: currentUserId,
        group_id: group.id,
        body: '',
        attachment_path: path,
        attachment_kind: 'image',
        attachment_duration_seconds: null,
      })
      .select(GROUP_MESSAGE_COLUMNS)
      .single()

    if (error || !data) {
      setImageError(t('chatImageUploadError'))
      setSending(false)
      return
    }

    const row = data as ChatGroupMessageRow
    const { data: signed } = await supabase.storage.from('chat-attachments').createSignedUrl(path, 3600)
    if (signed?.signedUrl) setAttachmentUrls(prev => ({ ...prev, [row.id]: signed.signedUrl }))

    setMessages(prev => [...prev, row])
    URL.revokeObjectURL(pendingImage.previewUrl)
    setPendingImage(null)
    setSending(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        {!hideBackButton && (
          <button
            onClick={onBack}
            className="text-sm px-1.5 py-0.5 rounded"
            style={{ color: MUTED, fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {t('chatBackToContacts')}
          </button>
        )}
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
          (() => {
            const lastMineMessage = [...messages].reverse().find(m => m.sender_id === currentUserId)
            const seenByNames = lastMineMessage
              ? Object.entries(readState)
                  .filter(([memberId, lastReadAt]) => memberId !== currentUserId && new Date(lastReadAt) >= new Date(lastMineMessage.created_at))
                  .map(([memberId]) => memberNames[memberId])
                  .filter((name): name is string => Boolean(name))
              : []

            return messages.map(m => {
              const mine = m.sender_id === currentUserId
              const isSticker = m.attachment_kind === 'sticker'
              const messageReactions = Object.entries(reactions[m.id] ?? {}) as [ReactionEmoji, string[]][]
              return (
                <div
                  key={m.id}
                  className="flex flex-col relative"
                  style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}
                  onMouseEnter={() => setHoveredMessageId(m.id)}
                  onMouseLeave={() => setHoveredMessageId(prev => (prev === m.id ? null : prev))}
                >
                  <div className="flex items-center gap-1" style={{ flexDirection: mine ? 'row-reverse' : 'row' }}>
                    <div
                      className={isSticker ? '' : 'max-w-[80%] px-3 py-1.5 rounded-lg text-sm'}
                      style={
                        isSticker
                          ? { background: 'transparent' }
                          : {
                              background: mine ? 'rgba(215,255,0,0.12)' : CARD,
                              color: mine ? NEON : 'rgba(255,255,255,0.85)',
                              border: `1px solid ${mine ? 'rgba(215,255,0,0.25)' : BORDER}`,
                              fontFamily: "'Montserrat', sans-serif",
                            }
                      }
                    >
                      {m.attachment_kind === 'voice' ? (
                        attachmentUrls[m.id] ? (
                          <audio controls src={attachmentUrls[m.id]} aria-label={t('chatVoiceNoteAudioAria')} style={{ height: 32, maxWidth: 220 }} />
                        ) : (
                          <span style={{ color: MUTED }}>…</span>
                        )
                      ) : m.attachment_kind === 'sticker' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/stickers/${m.attachment_path}.png`} alt={t('chatStickerAria')} style={{ width: 96, height: 96, display: 'block' }} />
                      ) : m.attachment_kind === 'image' ? (
                        attachmentUrls[m.id] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={attachmentUrls[m.id]}
                            alt={t('chatImageAttachmentAria')}
                            onClick={() => setLightbox(attachmentUrls[m.id])}
                            className="rounded-md cursor-pointer object-cover"
                            style={{ maxWidth: 200, maxHeight: 200, border: `1px solid ${BORDER}` }}
                          />
                        ) : (
                          <span style={{ color: MUTED }}>…</span>
                        )
                      ) : (
                        m.body
                      )}
                    </div>
                    {hoveredMessageId === m.id && (
                      <button
                        onClick={e => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          setReactionPicker({ messageId: m.id, top: rect.top - 44, left: rect.left })
                        }}
                        aria-label={t('chatReactAria')}
                        className="text-xs px-1 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${BORDER}`, color: MUTED }}
                      >
                        🙂+
                      </button>
                    )}
                  </div>

                  {messageReactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5" style={{ flexDirection: mine ? 'row-reverse' : 'row' }}>
                      {messageReactions.map(([emoji, userIds]) => {
                        const mineReacted = userIds.includes(currentUserId)
                        return (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction(m.id, emoji)}
                            className="text-[11px] px-1.5 py-0.5 rounded-full flex items-center gap-1"
                            style={{
                              background: mineReacted ? 'rgba(215,255,0,0.15)' : CARD,
                              border: `1px solid ${mineReacted ? 'rgba(215,255,0,0.4)' : BORDER}`,
                              color: mineReacted ? NEON : 'rgba(255,255,255,0.7)',
                            }}
                          >
                            <span>{emoji}</span>
                            <span>{userIds.length}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {mine && m.id === lastMineMessage?.id && seenByNames.length > 0 && (
                    <span className="text-[11px] px-1" style={{ color: MUTED, fontFamily: "'Space Grotesk', sans-serif" }}>
                      {t('chatSeenByLabel')}: {seenByNames.slice(0, 3).join(', ')}
                      {seenByNames.length > 3 ? ` +${seenByNames.length - 3}` : ''}
                    </span>
                  )}
                </div>
              )
            })
          })()
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ borderTop: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-2 px-3 py-2">
          {isRecording ? (
            <button
              onClick={stopRecording}
              className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-md text-left"
              style={{ background: 'rgba(255,59,48,0.15)', color: '#FF3B30', fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {`${t('chatStopRecordingAria')} (${formatSeconds(recordingSeconds)})`}
            </button>
          ) : pendingVoiceNote ? (
            <>
              <audio controls src={pendingVoiceNote.url} style={{ height: 32, flex: 1 }} />
              <button
                onClick={discardVoiceNote}
                aria-label={t('chatVoiceNoteRemoveAria')}
                className="text-sm px-1"
                style={{ color: MUTED }}
              >
                ×
              </button>
            </>
          ) : pendingImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingImage.previewUrl} alt="" style={{ height: 40, width: 40, objectFit: 'cover', borderRadius: 6 }} />
              <span className="flex-1 text-xs truncate" style={{ color: MUTED }}>{pendingImage.file.name}</span>
              <button
                onClick={discardPendingImage}
                aria-label={t('chatImageRemoveAria')}
                className="text-sm px-1"
                style={{ color: MUTED }}
              >
                ×
              </button>
            </>
          ) : (
            <>
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
              <input
                ref={imageFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0] ?? null
                  e.target.value = ''
                  pickImage(file)
                }}
              />
              <button
                onClick={() => imageFileRef.current?.click()}
                aria-label={t('chatAttachImageAria')}
                className="text-sm px-2 py-1.5 rounded-md"
                style={{ background: 'rgba(215,255,0,0.1)', color: NEON }}
              >
                📷
              </button>
              <button
                ref={stickerButtonRef}
                onClick={() => setStickerPickerOpen(v => !v)}
                aria-label={t('chatOpenStickerPickerAria')}
                className="text-sm px-2 py-1.5 rounded-md"
                style={{ background: 'rgba(215,255,0,0.1)', color: NEON }}
              >
                🏷️
              </button>
              <button
                onClick={startRecording}
                aria-label={t('chatRecordVoiceNoteAria')}
                className="text-sm px-2 py-1.5 rounded-md"
                style={{ background: 'rgba(215,255,0,0.1)', color: NEON }}
              >
                🎤
              </button>
            </>
          )}
          {!isRecording && (
            <button
              onClick={pendingVoiceNote ? sendVoiceNote : pendingImage ? sendImage : sendMessage}
              disabled={pendingVoiceNote || pendingImage ? sending : !draft.trim() || sending}
              className="text-xs font-semibold uppercase px-3 py-1.5 rounded-md"
              style={{
                background: 'rgba(215,255,0,0.12)',
                color: NEON,
                border: '1px solid rgba(215,255,0,0.25)',
                opacity: (pendingVoiceNote || pendingImage ? sending : !draft.trim() || sending) ? 0.5 : 1,
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {sending && pendingVoiceNote
                ? t('chatVoiceNoteUploading')
                : sending && pendingImage
                  ? t('chatImageUploading')
                  : t('chatSendButton')}
            </button>
          )}
        </div>
        {(voiceError || imageError) && (
          <div className="px-3 pb-2 text-xs" style={{ color: '#FF3B30' }}>
            {voiceError || imageError}
          </div>
        )}
      </div>

      {lightbox && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 70,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt={t('chatImageAttachmentAria')} style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 8 }} />
        </div>,
        document.body
      )}

      {reactionPicker && (
        <QuickReactPopover
          position={{ top: reactionPicker.top, left: reactionPicker.left }}
          onPick={emoji => { toggleReaction(reactionPicker.messageId, emoji); setReactionPicker(null) }}
          onClose={() => setReactionPicker(null)}
        />
      )}

      {stickerPickerOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={stickerPopoverRef}
          style={{
            position: 'fixed',
            top: (stickerButtonRef.current?.getBoundingClientRect().top ?? 0) - 216,
            left: stickerButtonRef.current?.getBoundingClientRect().left ?? 0,
            background: '#111',
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            padding: 8,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
            zIndex: 80,
          }}
        >
          {STICKER_CATALOG.map(slug => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={slug}
              src={`/stickers/${slug}.png`}
              alt={slug}
              onClick={() => sendSticker(slug)}
              className="cursor-pointer"
              style={{ width: 56, height: 56 }}
            />
          ))}
        </div>,
        document.body
      )}

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
