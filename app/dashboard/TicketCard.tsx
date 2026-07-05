'use client'

import { useT } from '@/lib/language-context'
import type { TicketSummary } from './chatTypes'

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

function isOverdue(dueDate: string | null, status: 'open' | 'done' | undefined) {
  if (!dueDate || status === 'done') return false
  const due = new Date(dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

export default function TicketCard({
  ticket,
  onOpen,
  onToggleStatus,
}: {
  ticket: TicketSummary
  onOpen: () => void
  onToggleStatus?: () => void
}) {
  const t = useT()
  const priorityColor = PRIORITY_COLOR[ticket.priority]
  const overdue = isOverdue(ticket.dueDate, ticket.mode === 'assignee' ? ticket.myStatus : undefined)

  return (
    <div
      className="flex flex-col gap-1.5 rounded-lg px-3 py-2 text-sm"
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderLeft: `3px solid ${priorityColor}`,
      }}
    >
      <button onClick={onOpen} className="flex flex-col gap-1 text-left" style={{ fontFamily: "'Montserrat', sans-serif" }}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold truncate" style={{ color: 'white' }}>
            {ticket.title}
          </span>
          <span
            className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full shrink-0"
            style={{
              background: `${priorityColor}1F`,
              border: `1px solid ${priorityColor}40`,
              color: priorityColor,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {t(PRIORITY_LABEL_KEY[ticket.priority])}
          </span>
        </div>
        {ticket.description && (
          <span
            className="text-xs"
            style={{
              color: 'rgba(255,255,255,0.6)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {ticket.description}
          </span>
        )}
      </button>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {ticket.dueDate && (
            <span className="text-xs" style={{ color: overdue ? RED : MUTED, fontFamily: "'Space Grotesk', sans-serif" }}>
              {overdue ? `${t('ticketDueDateOverdueLabel')} · ` : ''}
              {ticket.dueDate}
            </span>
          )}
          {(ticket.attachmentCount ?? 0) > 0 && (
            <span className="text-xs flex items-center gap-0.5" style={{ color: MUTED }}>
              📎 {ticket.attachmentCount}
            </span>
          )}
        </div>

        {ticket.mode === 'assignee' ? (
          <button
            onClick={onToggleStatus}
            className="text-xs font-semibold uppercase px-2 py-1 rounded"
            style={{
              background: ticket.myStatus === 'done' ? 'rgba(255,255,255,0.06)' : 'rgba(215,255,0,0.12)',
              color: ticket.myStatus === 'done' ? MUTED : NEON,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {ticket.myStatus === 'done' ? t('ticketReopenButton') : t('ticketMarkDoneButton')}
          </button>
        ) : (
          <span className="text-xs font-semibold px-1.5 rounded-full" style={{ background: NEON, color: '#000' }}>
            {ticket.doneCount ?? 0}/{ticket.assigneeCount ?? 0}
          </span>
        )}
      </div>
    </div>
  )
}
