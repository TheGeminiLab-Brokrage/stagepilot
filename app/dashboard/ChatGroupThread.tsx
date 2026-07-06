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

const GROUP_MESSAGE_COLUMNS = 'id, group_id, sender_id, body, created_at, attachment_path, attachment_kind, attachment_duration_seconds'

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
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [showManageMembers, setShowManageMembers] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [pendingVoiceNote, setPendingVoiceNote] = useState<{ blob: Blob; url: string; seconds: number } | null>(null)
  const [voiceError, setVoiceError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
      .select(GROUP_MESSAGE_COLUMNS)
      .single()

    if (!error && data) {
      const row = data as ChatGroupMessageRow
      setMessages(prev => [...prev, row])
    }
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
        setPendingVoiceNote({ blob, url: URL.createObjectURL(blob), seconds: recordingSeconds })
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setVoiceError('')
      setIsRecording(true)
      setRecordingSeconds(0)
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
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
                  {m.attachment_kind === 'voice' ? (
                    attachmentUrls[m.id] ? (
                      <audio controls src={attachmentUrls[m.id]} aria-label={t('chatVoiceNoteAudioAria')} style={{ height: 32, maxWidth: 220 }} />
                    ) : (
                      <span style={{ color: MUTED }}>…</span>
                    )
                  ) : (
                    m.body
                  )}
                </div>
              </div>
            )
          })
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
              onClick={pendingVoiceNote ? sendVoiceNote : sendMessage}
              disabled={pendingVoiceNote ? sending : !draft.trim() || sending}
              className="text-xs font-semibold uppercase px-3 py-1.5 rounded-md"
              style={{
                background: 'rgba(215,255,0,0.12)',
                color: NEON,
                border: '1px solid rgba(215,255,0,0.25)',
                opacity: (pendingVoiceNote ? sending : !draft.trim() || sending) ? 0.5 : 1,
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {sending && pendingVoiceNote ? t('chatVoiceNoteUploading') : t('chatSendButton')}
            </button>
          )}
        </div>
        {voiceError && (
          <div className="px-3 pb-2 text-xs" style={{ color: '#FF3B30' }}>
            {voiceError}
          </div>
        )}
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
