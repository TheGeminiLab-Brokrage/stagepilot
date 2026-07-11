'use client'

import { useEffect, useState } from 'react'
import { useT } from '@/lib/language-context'
import { isTicketDone } from './ticketUtils'
import type { TicketPriority, TicketSummary } from '../chatTypes'

type Props = {
  tickets: TicketSummary[]
  onFiltered: (filtered: TicketSummary[]) => void
}

const inputBase: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: 'rgba(255,255,255,0.7)',
  borderRadius: 8,
  fontSize: 12,
  padding: '5px 10px',
  outline: 'none',
  fontFamily: "'Montserrat', sans-serif",
}

const activeStyle: React.CSSProperties = {
  background: 'rgba(215,255,0,0.1)',
  border: '1px solid rgba(215,255,0,0.4)',
  color: '#D7FF00',
}

const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent']
const PRIORITY_LABEL_KEY = {
  low: 'ticketPriorityLow',
  medium: 'ticketPriorityMedium',
  high: 'ticketPriorityHigh',
  urgent: 'ticketPriorityUrgent',
} as const

export default function TaskFilterBar({ tickets, onFiltered }: Props) {
  const t = useT()
  const [priority, setPriority] = useState<TicketPriority | ''>('')
  const [status, setStatus] = useState<'' | 'open' | 'done'>('')
  const [agentSearch, setAgentSearch] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const teams = Array.from(
    new Set(tickets.flatMap(tk => (tk.assignees ?? []).map(a => a.teamName).filter(Boolean)))
  ) as string[]

  useEffect(() => {
    let result = tickets

    if (priority) {
      result = result.filter(tk => tk.priority === priority)
    }

    if (status) {
      result = result.filter(tk => (status === 'done' ? isTicketDone(tk) : !isTicketDone(tk)))
    }

    if (agentSearch.trim()) {
      const q = agentSearch.toLowerCase()
      result = result.filter(tk => (tk.assignees ?? []).some(a => a.fullName.toLowerCase().includes(q)))
    }

    if (teamFilter) {
      result = result.filter(tk => (tk.assignees ?? []).some(a => a.teamName === teamFilter))
    }

    if (dateFrom) {
      const from = new Date(dateFrom).getTime()
      result = result.filter(tk => tk.dueDate && new Date(tk.dueDate).getTime() >= from)
    }

    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000
      result = result.filter(tk => tk.dueDate && new Date(tk.dueDate).getTime() <= to)
    }

    onFiltered(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, priority, status, agentSearch, teamFilter, dateFrom, dateTo])

  const hasFilters = priority || status || agentSearch || teamFilter || dateFrom || dateTo

  function clearAll() {
    setPriority('')
    setStatus('')
    setAgentSearch('')
    setTeamFilter('')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: 16 }}>
      <select
        value={priority}
        onChange={e => setPriority(e.target.value as TicketPriority | '')}
        style={{ ...inputBase, cursor: 'pointer', ...(priority ? activeStyle : {}) }}
      >
        <option value="" style={{ color: '#000' }}>{t('ticketFilterAllPriorities')}</option>
        {PRIORITIES.map(p => (
          <option key={p} value={p} style={{ color: '#000' }}>{t(PRIORITY_LABEL_KEY[p])}</option>
        ))}
      </select>

      <select
        value={status}
        onChange={e => setStatus(e.target.value as '' | 'open' | 'done')}
        style={{ ...inputBase, cursor: 'pointer', ...(status ? activeStyle : {}) }}
      >
        <option value="" style={{ color: '#000' }}>{t('ticketFilterAllStatuses')}</option>
        <option value="open" style={{ color: '#000' }}>{t('ticketStatusOpen')}</option>
        <option value="done" style={{ color: '#000' }}>{t('ticketStatusDone')}</option>
      </select>

      <input
        type="text"
        placeholder={t('filterSearchAgent')}
        value={agentSearch}
        onChange={e => setAgentSearch(e.target.value)}
        style={{ ...inputBase, width: 140 }}
      />

      {teams.length > 0 && (
        <select
          value={teamFilter}
          onChange={e => setTeamFilter(e.target.value)}
          style={{ ...inputBase, cursor: 'pointer', ...(teamFilter ? activeStyle : {}) }}
        >
          <option value="" style={{ color: '#000' }}>{t('filterAllTeams')}</option>
          {teams.map(team => <option key={team} value={team} style={{ color: '#000' }}>{team}</option>)}
        </select>
      )}

      <input
        type="date"
        value={dateFrom}
        onChange={e => setDateFrom(e.target.value)}
        style={{ ...inputBase, cursor: 'pointer', colorScheme: 'dark' }}
      />
      <span style={{ color: 'rgba(215,255,0,0.4)', fontSize: 12 }}>→</span>
      <input
        type="date"
        value={dateTo}
        onChange={e => setDateTo(e.target.value)}
        style={{ ...inputBase, cursor: 'pointer', colorScheme: 'dark' }}
      />

      {hasFilters && (
        <button
          onClick={clearAll}
          style={{
            fontSize: 12, color: 'rgba(255,255,255,0.3)', background: 'none',
            border: 'none', cursor: 'pointer', padding: '2px 4px', transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.7)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
        >
          {t('filterClearAll')}
        </button>
      )}
    </div>
  )
}
