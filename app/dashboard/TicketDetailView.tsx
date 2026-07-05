'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/language-context'
import type { TicketAssigneeRow, TicketAttachment, TicketSummary } from './chatTypes'

const NEON = '#D7FF00'
const CARD = 'rgba(255,255,255,0.03)'
const BORDER = 'rgba(255,255,255,0.08)'
const MUTED = 'rgba(255,255,255,0.4)'
const RED = '#FF3B30'
const AMBER = '#FF9F0A'

const PRIORITY_COLOR: Record<TicketSummary['priority'], string> = {
  low: 'rgba(255,255,255,0.35)',
  medium: NEON,
  high: AMBER,
  urgent: RED,
}

const PRIORITY_LABEL_KEY = {
  low: 'ticketPriorityLow',
  medium: 'ticketPriorityMedium',
  high: 'ticketPriorityHigh',
  urgent: 'ticketPriorityUrgent',
} as const

export default function TicketDetailView({
  ticket,
  onBack,
  onToggleStatus,
}: {
  ticket: TicketSummary
  onBack: () => void
  onToggleStatus: () => void
}) {
  const t = useT()
  const [assignees, setAssignees] = useState<TicketAssigneeRow[]>([])
  const [attachments, setAttachments] = useState<TicketAttachment[]>([])
  const [lightbox, setLightbox] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadAssignees() {
      if (ticket.mode !== 'owner') return
      const supabase = createClient()
      const { data } = await supabase
        .from('ticket_assignees')
        .select('id, assignee_id, status, profiles(full_name)')
        .eq('ticket_id', ticket.id)

      if (cancelled || !data) return
      setAssignees(
        data.map((row: { id: string; assignee_id: string; status: 'open' | 'done'; profiles: { full_name: string } | { full_name: string }[] | null }) => {
          const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
          return {
            id: row.id,
            assigneeId: row.assignee_id,
            fullName: profile?.full_name ?? '',
            status: row.status,
          }
        })
      )
    }

    async function loadAttachments() {
      if (!ticket.attachmentCount) return
      const res = await fetch(`/api/ticket-attachment-url?ticketId=${ticket.id}`)
      if (!res.ok || cancelled) return
      const data = await res.json()
      if (!cancelled) setAttachments(data.attachments ?? [])
    }

    loadAssignees()
    loadAttachments()

    return () => {
      cancelled = true
    }
  }, [ticket.id, ticket.mode, ticket.attachmentCount])

  const priorityColor = PRIORITY_COLOR[ticket.priority]

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <button onClick={onBack} className="text-sm px-1.5 py-0.5 rounded" style={{ color: MUTED, fontFamily: "'Space Grotesk', sans-serif" }}>
          {t('chatBackToContacts')}
        </button>
        <span className="text-sm font-semibold truncate" style={{ color: 'white', fontFamily: "'Montserrat', sans-serif" }}>
          {ticket.title}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full"
            style={{
              background: `${priorityColor}1F`,
              border: `1px solid ${priorityColor}40`,
              color: priorityColor,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {t(PRIORITY_LABEL_KEY[ticket.priority])}
          </span>
          {ticket.dueDate && (
            <span className="text-xs" style={{ color: MUTED, fontFamily: "'Space Grotesk', sans-serif" }}>
              {ticket.dueDate}
            </span>
          )}
        </div>

        {ticket.description && (
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.85)', fontFamily: "'Montserrat', sans-serif" }}>
            {ticket.description}
          </p>
        )}

        {attachments.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span
              className="text-xs font-semibold uppercase"
              style={{ color: MUTED, letterSpacing: '0.06em', fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t('ticketAttachmentsLabel')}
            </span>
            <div className="flex flex-wrap gap-2">
              {attachments.map(a => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={a.id}
                  src={a.url}
                  alt={t('ticketViewAttachmentAria')}
                  onClick={() => setLightbox(a.url)}
                  className="rounded-md cursor-pointer object-cover"
                  style={{ width: 64, height: 64, border: `1px solid ${BORDER}` }}
                />
              ))}
            </div>
          </div>
        )}

        {ticket.mode === 'assignee' ? (
          <button
            onClick={onToggleStatus}
            className="text-xs font-semibold uppercase px-3 py-1.5 rounded-md self-start"
            style={{
              background: ticket.myStatus === 'done' ? 'rgba(255,255,255,0.06)' : 'rgba(215,255,0,0.12)',
              color: ticket.myStatus === 'done' ? MUTED : NEON,
              border: `1px solid ${ticket.myStatus === 'done' ? BORDER : 'rgba(215,255,0,0.25)'}`,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {ticket.myStatus === 'done' ? t('ticketReopenButton') : t('ticketMarkDoneButton')}
          </button>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span
              className="text-xs font-semibold uppercase"
              style={{ color: MUTED, letterSpacing: '0.06em', fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t('ticketAssigneesLabel')}
            </span>
            {assignees.length === 0 ? (
              <span className="text-xs" style={{ color: MUTED }}>{t('ticketOwnerEmptyAssignees')}</span>
            ) : (
              assignees.map(a => (
                <div
                  key={a.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-sm"
                  style={{ background: CARD, border: `1px solid ${BORDER}`, color: 'white', fontFamily: "'Montserrat', sans-serif" }}
                >
                  <span className="truncate">{a.fullName}</span>
                  <span
                    className="text-xs font-semibold px-1.5 rounded-full"
                    style={{
                      background: a.status === 'done' ? NEON : 'rgba(255,255,255,0.1)',
                      color: a.status === 'done' ? '#000' : MUTED,
                    }}
                  >
                    {a.status === 'done' ? t('ticketStatusDone') : t('ticketStatusOpen')}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {lightbox && (
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
          <img src={lightbox} alt={t('ticketViewAttachmentAria')} style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 8 }} />
        </div>
      )}
    </div>
  )
}
