import type { TicketPriority, TicketSummary } from '../chatTypes'

export const PRIORITY_RANK: Record<TicketPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

export function isTicketDone(ticket: TicketSummary) {
  return ticket.mode === 'assignee'
    ? ticket.myStatus === 'done'
    : (ticket.assigneeCount ?? 0) > 0 && ticket.doneCount === ticket.assigneeCount
}

export function sortOpenTickets(tickets: TicketSummary[]) {
  return [...tickets].sort((a, b) => {
    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
    if (aDue !== bDue) return aDue - bDue
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  })
}

export function isOverdue(ticket: TicketSummary) {
  if (!ticket.dueDate || isTicketDone(ticket)) return false
  return new Date(ticket.dueDate) < new Date()
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}
