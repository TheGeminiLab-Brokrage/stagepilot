'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/language-context'
import TicketCard from './TicketCard'
import TicketDetailView from './TicketDetailView'
import TicketCreateModal from './TicketCreateModal'
import TaskFilterBar from './TaskFilterBar'
import { isOverdue, isTicketDone, sortOpenTickets } from './ticketUtils'
import type { ChatRole, TicketSummary } from '../chatTypes'

const NEON = '#D7FF00'
const CARD = 'rgba(255,255,255,0.03)'
const BORDER = 'rgba(255,255,255,0.08)'
const MUTED = 'rgba(255,255,255,0.4)'
const RED = '#FF3B30'

export default function TasksClient({
  currentUserId,
  companyId,
  role,
}: {
  currentUserId: string
  companyId: string
  role: ChatRole
}) {
  const t = useT()
  const [tickets, setTickets] = useState<TicketSummary[]>([])
  const [filteredTickets, setFilteredTickets] = useState<TicketSummary[]>([])
  const [showDone, setShowDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<TicketSummary | null>(null)
  const [showCreateTicketModal, setShowCreateTicketModal] = useState(false)
  const myOwnedTicketIdsRef = useRef<Set<string>>(new Set())

  const canManageTickets = role === 'super_admin' || role === 'team_leader'

  async function loadTickets() {
    const supabase = createClient()
    const entries: TicketSummary[] = []

    if (role === 'agent' || role === 'team_leader') {
      const { data: assigneeRows } = await supabase
        .from('ticket_assignees')
        .select('id, ticket_id, status')
        .eq('assignee_id', currentUserId)

      const ticketIds = (assigneeRows ?? []).map(r => r.ticket_id)
      if (ticketIds.length > 0) {
        const { data: ticketRows } = await supabase
          .from('tickets')
          .select('id, title, description, priority, due_date, created_at, created_by')
          .in('id', ticketIds)

        const { data: attachmentRows } = await supabase
          .from('ticket_attachments')
          .select('ticket_id')
          .in('ticket_id', ticketIds)

        const attachmentCounts: Record<string, number> = {}
        for (const a of attachmentRows ?? []) attachmentCounts[a.ticket_id] = (attachmentCounts[a.ticket_id] ?? 0) + 1

        for (const assigneeRow of assigneeRows ?? []) {
          const ticketRow = (ticketRows ?? []).find(tk => tk.id === assigneeRow.ticket_id)
          if (!ticketRow) continue
          entries.push({
            id: ticketRow.id,
            title: ticketRow.title,
            description: ticketRow.description,
            priority: ticketRow.priority,
            dueDate: ticketRow.due_date,
            createdAt: ticketRow.created_at,
            createdBy: ticketRow.created_by,
            mode: 'assignee',
            myAssigneeRowId: assigneeRow.id,
            myStatus: assigneeRow.status,
            attachmentCount: attachmentCounts[ticketRow.id] ?? 0,
          })
        }
      }
    }

    if (role === 'super_admin' || role === 'team_leader') {
      let ticketQuery = supabase
        .from('tickets')
        .select('id, title, description, priority, due_date, created_at, created_by, creator:profiles!tickets_created_by_fkey(full_name)')

      ticketQuery = role === 'super_admin'
        ? ticketQuery.eq('company_id', companyId)
        : ticketQuery.eq('created_by', currentUserId)

      const { data: ticketRows } = await ticketQuery

      const ticketIds = (ticketRows ?? []).map(tk => tk.id)
      myOwnedTicketIdsRef.current = new Set(ticketIds)

      const [{ data: assigneeRows }, { data: attachmentRows }] = ticketIds.length > 0
        ? await Promise.all([
            supabase.from('ticket_assignees').select('ticket_id, status, assignee_id, profiles(full_name, team_name)').in('ticket_id', ticketIds),
            supabase.from('ticket_attachments').select('ticket_id').in('ticket_id', ticketIds),
          ])
        : [{ data: [] }, { data: [] }]

      const attachmentCounts: Record<string, number> = {}
      for (const a of attachmentRows ?? []) attachmentCounts[a.ticket_id] = (attachmentCounts[a.ticket_id] ?? 0) + 1

      for (const ticketRow of ticketRows ?? []) {
        const ticketAssignees = (assigneeRows ?? []).filter(a => a.ticket_id === ticketRow.id)
        const creator = Array.isArray(ticketRow.creator) ? ticketRow.creator[0] : ticketRow.creator
        entries.push({
          id: ticketRow.id,
          title: ticketRow.title,
          description: ticketRow.description,
          priority: ticketRow.priority,
          dueDate: ticketRow.due_date,
          createdAt: ticketRow.created_at,
          createdBy: ticketRow.created_by,
          mode: 'owner',
          assigneeCount: ticketAssignees.length,
          doneCount: ticketAssignees.filter(a => a.status === 'done').length,
          attachmentCount: attachmentCounts[ticketRow.id] ?? 0,
          assignees: ticketAssignees.map(a => {
            const profile = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles
            return { id: a.assignee_id, fullName: profile?.full_name ?? '', teamName: profile?.team_name ?? null }
          }),
          creatorName: role === 'super_admin' ? (creator?.full_name ?? '') : undefined,
        })
      }
    }

    setTickets(entries)
    setFilteredTickets(entries)
  }

  useEffect(() => {
    loadTickets().then(() => setLoading(false))

    const supabase = createClient()
    const channel = supabase
      .channel(`tasks-page-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_assignees' },
        payload => {
          const row = payload.new as { assignee_id: string; ticket_id: string }
          if (row.assignee_id === currentUserId || myOwnedTicketIdsRef.current.has(row.ticket_id)) loadTickets()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ticket_assignees' },
        payload => {
          const row = payload.new as { assignee_id: string; ticket_id: string }
          if (row.assignee_id === currentUserId || myOwnedTicketIdsRef.current.has(row.ticket_id)) loadTickets()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, role])

  async function handleToggleTicketStatus(ticket: TicketSummary) {
    if (ticket.mode !== 'assignee' || !ticket.myAssigneeRowId) return
    const nextStatus = ticket.myStatus === 'done' ? 'open' : 'done'

    setTickets(prev => prev.map(tk => (tk.id === ticket.id ? { ...tk, myStatus: nextStatus } : tk)))
    setSelectedTicket(prev => (prev && prev.id === ticket.id ? { ...prev, myStatus: nextStatus } : prev))

    const supabase = createClient()
    await supabase.from('ticket_assignees').update({ status: nextStatus }).eq('id', ticket.myAssigneeRowId)
  }

  function handleTicketCreated(newTicket: TicketSummary) {
    setTickets(prev => [newTicket, ...prev])
    setFilteredTickets(prev => [newTicket, ...prev])
    setShowCreateTicketModal(false)
  }

  const openTickets = sortOpenTickets(filteredTickets.filter(tk => !isTicketDone(tk)))
  const doneTickets = filteredTickets.filter(isTicketDone)

  const totalCount = tickets.length
  const openCount = tickets.filter(tk => !isTicketDone(tk)).length
  const doneCount = tickets.filter(isTicketDone).length
  const overdueCount = tickets.filter(isOverdue).length

  return (
    <div style={{ fontFamily: "'Montserrat', sans-serif" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
            {t('navTasks')}
          </h1>
        </div>
        {canManageTickets && !selectedTicket && (
          <button
            onClick={() => setShowCreateTicketModal(true)}
            className="text-sm font-semibold px-3 py-1.5 rounded-md"
            style={{ background: 'rgba(215,255,0,0.1)', color: NEON, fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {t('ticketCreateButton')}
          </button>
        )}
      </div>

      {!selectedTicket && !loading && totalCount > 0 && (
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', marginBottom: 16 }}>
          <StatTile label={t('ticketStatTotalLabel')} value={totalCount} color={NEON} />
          <StatTile label={t('ticketOpenSectionLabel')} value={openCount} color={NEON} />
          <StatTile label={t('ticketStatOverdue')} value={overdueCount} color={RED} />
          <StatTile label={t('ticketDoneSectionLabel')} value={doneCount} color={MUTED} />
        </div>
      )}

      {!selectedTicket && !loading && canManageTickets && totalCount > 0 && (
        <TaskFilterBar tickets={tickets} onFiltered={setFilteredTickets} />
      )}

      {selectedTicket ? (
        <div
          style={{
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.02)',
            maxWidth: 640,
            minHeight: 480,
          }}
        >
          <TicketDetailView
            ticket={selectedTicket}
            onBack={() => setSelectedTicket(null)}
            onToggleStatus={() => handleToggleTicketStatus(selectedTicket)}
          />
        </div>
      ) : loading ? (
        <div
          className="flex items-center justify-center text-sm"
          style={{ color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '32px 0' }}
        >
          {t('modalLoading')}
        </div>
      ) : totalCount === 0 ? (
        <div className="text-sm" style={{ color: MUTED }}>
          {role === 'agent' ? t('ticketEmptyState') : t('ticketOwnerEmptyState')}
        </div>
      ) : openTickets.length === 0 && doneTickets.length === 0 ? (
        <div className="text-sm" style={{ color: MUTED }}>{t('ticketFilterEmptyState')}</div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {openTickets.map(ticket => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onOpen={() => setSelectedTicket(ticket)}
                onToggleStatus={() => handleToggleTicketStatus(ticket)}
              />
            ))}
          </div>
          {doneTickets.length > 0 && (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setShowDone(v => !v)}
                className="text-xs font-semibold uppercase self-start"
                style={{ color: MUTED, letterSpacing: '0.06em', fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {t('ticketDoneSectionLabel')} ({doneTickets.length}) {showDone ? '▲' : '▼'}
              </button>
              {showDone && (
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                  {doneTickets.map(ticket => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      onOpen={() => setSelectedTicket(ticket)}
                      onToggleStatus={() => handleToggleTicketStatus(ticket)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showCreateTicketModal && (
        <TicketCreateModal
          currentUserId={currentUserId}
          companyId={companyId}
          role={role}
          onClose={() => setShowCreateTicketModal(false)}
          onCreated={handleTicketCreated}
        />
      )}
    </div>
  )
}

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="flex flex-col gap-0.5 rounded-lg px-3 py-2"
      style={{ background: CARD, border: `1px solid ${BORDER}` }}
    >
      <span className="text-xl font-bold" style={{ color, fontFamily: "'Space Grotesk', sans-serif" }}>
        {value}
      </span>
      <span className="text-xs uppercase" style={{ color: MUTED, letterSpacing: '0.06em', fontFamily: "'Space Grotesk', sans-serif" }}>
        {label}
      </span>
    </div>
  )
}
