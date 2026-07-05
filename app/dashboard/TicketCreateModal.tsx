'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/language-context'
import type { ChatRole, TicketPriority, TicketSummary } from './chatTypes'

const NEON = '#D7FF00'
const CARD = 'rgba(255,255,255,0.03)'
const BORDER = 'rgba(255,255,255,0.08)'
const MUTED = 'rgba(255,255,255,0.4)'

type Candidate = { id: string; full_name: string }

const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent']
const PRIORITY_LABEL_KEY = {
  low: 'ticketPriorityLow',
  medium: 'ticketPriorityMedium',
  high: 'ticketPriorityHigh',
  urgent: 'ticketPriorityUrgent',
} as const

export default function TicketCreateModal({
  currentUserId,
  companyId,
  role,
  onClose,
  onCreated,
}: {
  currentUserId: string
  companyId: string
  role: ChatRole
  onClose: () => void
  onCreated: (ticket: TicketSummary) => void
}) {
  const t = useT()
  const fileRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TicketPriority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [assigneeSearch, setAssigneeSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [photos, setPhotos] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const supabase = createClient()

    async function loadCandidates() {
      if (role === 'super_admin') {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('company_id', companyId)
          .in('role', ['agent', 'team_leader'])
          .neq('id', currentUserId)
          .order('full_name', { ascending: true })
        setCandidates((data ?? []) as Candidate[])
      } else if (role === 'team_leader') {
        const { data: me } = await supabase.from('profiles').select('team_name').eq('id', currentUserId).single()
        if (!me?.team_name) return
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('company_id', companyId)
          .eq('role', 'agent')
          .eq('team_name', me.team_name)
          .order('full_name', { ascending: true })
        setCandidates((data ?? []) as Candidate[])
      }
    }

    loadCandidates()
  }, [companyId, currentUserId, role])

  function toggleAssignee(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function addPhotos(files: FileList | null) {
    if (!files) return
    setPhotos(prev => [...prev, ...Array.from(files)])
  }

  function removePhoto(index: number) {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  const filteredCandidates = candidates.filter(c => c.full_name.toLowerCase().includes(assigneeSearch.toLowerCase()))
  const canSubmit = title.trim().length > 0 && selectedIds.size > 0 && !submitting

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/admin/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim(),
        priority,
        dueDate: dueDate || null,
        assigneeIds: Array.from(selectedIds),
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? t('ticketCreateError'))
      setSubmitting(false)
      return
    }

    if (photos.length > 0) {
      const supabase = createClient()
      let uploadFailed = false
      for (const file of photos) {
        const path = `${companyId}/${data.ticket.id}/${crypto.randomUUID()}-${file.name}`
        const { error: uploadError } = await supabase.storage.from('ticket-attachments').upload(path, file)
        if (uploadError) {
          uploadFailed = true
          continue
        }
        await supabase.from('ticket_attachments').insert({ ticket_id: data.ticket.id, storage_path: path, uploaded_by: currentUserId })
      }
      if (uploadFailed) setError(t('ticketAttachmentUploadError'))
    }

    onCreated({
      id: data.ticket.id,
      title: data.ticket.title,
      description: data.ticket.description,
      priority: data.ticket.priority,
      dueDate: data.ticket.dueDate,
      createdAt: data.ticket.createdAt,
      createdBy: currentUserId,
      mode: 'owner',
      assigneeCount: data.ticket.assigneeCount,
      doneCount: 0,
      attachmentCount: photos.length,
    })
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="flex flex-col"
        style={{
          width: 380,
          maxHeight: '80vh',
          background: 'rgba(10,10,10,0.98)',
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <span className="text-sm font-semibold" style={{ color: NEON, fontFamily: "'Space Grotesk', sans-serif" }}>
            {t('ticketModalTitle')}
          </span>
          <button onClick={onClose} className="text-lg leading-none" style={{ color: MUTED }}>
            ×
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-3">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={t('ticketTitlePlaceholder')}
            className="w-full text-sm px-3 py-1.5 rounded-md outline-none"
            style={{ background: CARD, border: `1px solid ${BORDER}`, color: 'white', fontFamily: "'Montserrat', sans-serif" }}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase" style={{ color: MUTED, letterSpacing: '0.06em', fontFamily: "'Space Grotesk', sans-serif" }}>
              {t('ticketDescriptionLabel')}
            </span>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('ticketDescriptionPlaceholder')}
              rows={3}
              className="w-full text-sm px-3 py-1.5 rounded-md outline-none resize-none"
              style={{ background: CARD, border: `1px solid ${BORDER}`, color: 'white', fontFamily: "'Montserrat', sans-serif" }}
            />
          </div>

          <div className="flex gap-2">
            <div className="flex flex-col gap-1.5 flex-1">
              <span className="text-xs font-semibold uppercase" style={{ color: MUTED, letterSpacing: '0.06em', fontFamily: "'Space Grotesk', sans-serif" }}>
                {t('ticketPriorityLabel')}
              </span>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as TicketPriority)}
                className="w-full text-sm px-3 py-1.5 rounded-md outline-none"
                style={{ background: CARD, border: `1px solid ${BORDER}`, color: 'white', fontFamily: "'Montserrat', sans-serif" }}
              >
                {PRIORITIES.map(p => (
                  <option key={p} value={p} style={{ background: '#111' }}>
                    {t(PRIORITY_LABEL_KEY[p])}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 flex-1">
              <span className="text-xs font-semibold uppercase" style={{ color: MUTED, letterSpacing: '0.06em', fontFamily: "'Space Grotesk', sans-serif" }}>
                {t('ticketDueDateLabel')}
              </span>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full text-sm px-3 py-1.5 rounded-md outline-none"
                style={{ background: CARD, border: `1px solid ${BORDER}`, color: 'white', fontFamily: "'Montserrat', sans-serif" }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase" style={{ color: MUTED, letterSpacing: '0.06em', fontFamily: "'Space Grotesk', sans-serif" }}>
              {t('ticketAssigneesLabel')}
            </span>
            <input
              value={assigneeSearch}
              onChange={e => setAssigneeSearch(e.target.value)}
              placeholder={t('ticketAssigneesSearchPlaceholder')}
              className="w-full text-sm px-3 py-1.5 rounded-md outline-none"
              style={{ background: CARD, border: `1px solid ${BORDER}`, color: 'white', fontFamily: "'Montserrat', sans-serif" }}
            />
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
              {filteredCandidates.map(c => (
                <label key={c.id} className="flex items-center gap-2 px-2 py-1 rounded-md text-sm" style={{ color: 'white', fontFamily: "'Montserrat', sans-serif" }}>
                  <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleAssignee(c.id)} />
                  <span className="truncate">{c.full_name}</span>
                </label>
              ))}
            </div>
            {selectedIds.size === 0 && (
              <span className="text-xs" style={{ color: MUTED }}>{t('ticketNoAssigneesSelected')}</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => {
                addPhotos(e.target.files)
                e.target.value = ''
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="text-xs font-semibold self-start px-2 py-1 rounded"
              style={{ background: 'rgba(215,255,0,0.1)', color: NEON, fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t('ticketAddPhotosButton')}
            </button>
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {photos.map((file, i) => (
                  <div key={i} className="relative" style={{ width: 48, height: 48 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="rounded-md object-cover w-full h-full"
                      style={{ border: `1px solid ${BORDER}` }}
                    />
                    <button
                      onClick={() => removePhoto(i)}
                      aria-label={t('ticketPhotoRemoveAria')}
                      className="absolute flex items-center justify-center"
                      style={{
                        top: -6,
                        right: -6,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: 'rgba(10,10,10,0.9)',
                        border: `1px solid ${BORDER}`,
                        color: MUTED,
                        fontSize: 11,
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <span className="text-xs" style={{ color: '#FF3B30' }}>{error}</span>}
        </div>

        <div className="flex items-center justify-end gap-2 px-3 py-2" style={{ borderTop: `1px solid ${BORDER}` }}>
          <button onClick={onClose} className="text-xs font-semibold px-3 py-1.5 rounded-md" style={{ color: MUTED, fontFamily: "'Space Grotesk', sans-serif" }}>
            {t('adminCancel')}
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="text-xs font-semibold uppercase px-3 py-1.5 rounded-md"
            style={{
              background: 'rgba(215,255,0,0.12)',
              color: NEON,
              border: '1px solid rgba(215,255,0,0.25)',
              opacity: canSubmit ? 1 : 0.5,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {submitting ? t('ticketSubmitting') : t('ticketSubmitButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
