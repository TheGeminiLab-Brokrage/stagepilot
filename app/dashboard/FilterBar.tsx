'use client'

import { useState, useEffect, useRef } from 'react'
import { type Call } from './CallsTable'
import { useT } from '@/lib/language-context'
import { STAGE_KEY_MAP } from '@/lib/translations'

const ALL_STAGES = [
  'interested / follow up',
  'potential to close',
  'meeting scheduled',
  'meeting done',
  'done deal',
  'not interested',
  'low budget',
]

type Props = {
  calls: Call[]
  isLeader: boolean
  onFiltered: (filtered: Call[]) => void
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

export default function FilterBar({ calls, isLeader, onFiltered }: Props) {
  const t = useT()
  const [selectedStages, setSelectedStages] = useState<string[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [agentSearch, setAgentSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [stageOpen, setStageOpen] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)

  // Close stage dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (stageRef.current && !stageRef.current.contains(e.target as Node)) {
        setStageOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  // Unique teams from data
  const teams = Array.from(new Set(calls.map(c => c.team_name).filter(Boolean))) as string[]

  // Apply filters whenever any filter changes
  useEffect(() => {
    let result = calls

    if (selectedStages.length > 0) {
      result = result.filter(c => {
        const s = c.stage_corrected ?? c.stage ?? ''
        return selectedStages.includes(s)
      })
    }

    if (clientSearch.trim()) {
      const q = clientSearch.toLowerCase()
      result = result.filter(c => c.client_name?.toLowerCase().includes(q))
    }

    if (teamFilter) {
      result = result.filter(c => c.team_name === teamFilter)
    }

    if (agentSearch.trim()) {
      const q = agentSearch.toLowerCase()
      result = result.filter(c => c.agent_full_name?.toLowerCase().includes(q))
    }

    if (dateFrom) {
      const from = new Date(dateFrom).getTime()
      result = result.filter(c => new Date(c.uploaded_at).getTime() >= from)
    }

    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000 // include the full day
      result = result.filter(c => new Date(c.uploaded_at).getTime() <= to)
    }

    onFiltered(result)
  }, [calls, selectedStages, clientSearch, teamFilter, agentSearch, dateFrom, dateTo, onFiltered])

  const hasFilters = selectedStages.length > 0 || clientSearch || teamFilter || agentSearch || dateFrom || dateTo

  function clearAll() {
    setSelectedStages([])
    setClientSearch('')
    setTeamFilter('')
    setAgentSearch('')
    setDateFrom('')
    setDateTo('')
  }

  function toggleStage(s: string) {
    setSelectedStages(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {/* Stage multiselect */}
      <div className="relative" ref={stageRef}>
        <button
          onClick={() => setStageOpen(o => !o)}
          style={{
            ...inputBase,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            ...(selectedStages.length > 0 ? {
              background: 'rgba(215,255,0,0.1)',
              border: '1px solid rgba(215,255,0,0.4)',
              color: '#D7FF00',
            } : {}),
          }}
        >
          {t('filterStage')}
          {selectedStages.length > 0 && (
            <span style={{
              background: '#D7FF00', color: '#000', borderRadius: '50%',
              width: 16, height: 16, display: 'inline-flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0,
            }}>
              {selectedStages.length}
            </span>
          )}
          <span style={{ color: selectedStages.length > 0 ? 'rgba(215,255,0,0.5)' : 'rgba(255,255,255,0.25)', fontSize: 10 }}>▾</span>
        </button>
        {stageOpen && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 20,
            background: '#111', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
            padding: '4px 0', minWidth: 200,
          }}>
            {ALL_STAGES.map(s => {
              const stageKey = STAGE_KEY_MAP[s]
              const stageLabel = stageKey ? t(stageKey) : s
              const checked = selectedStages.includes(s)
              return (
                <label
                  key={s}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 12px', cursor: 'pointer', fontSize: 12,
                    color: checked ? '#D7FF00' : 'rgba(255,255,255,0.6)',
                    background: checked ? 'rgba(215,255,0,0.06)' : 'transparent',
                  }}
                  onMouseEnter={e => { if (!checked) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                  onMouseLeave={e => { if (!checked) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleStage(s)}
                    style={{ accentColor: '#D7FF00', cursor: 'pointer' }}
                  />
                  {stageLabel}
                </label>
              )
            })}
          </div>
        )}
      </div>

      {/* Client search */}
      <input
        type="text"
        placeholder={t('filterSearchClient')}
        value={clientSearch}
        onChange={e => setClientSearch(e.target.value)}
        style={{ ...inputBase, width: 144 }}
      />

      {/* Team filter — leaders/admin only */}
      {isLeader && teams.length > 0 && (
        <select
          value={teamFilter}
          onChange={e => setTeamFilter(e.target.value)}
          style={{
            ...inputBase,
            cursor: 'pointer',
            ...(teamFilter ? {
              background: 'rgba(215,255,0,0.1)',
              border: '1px solid rgba(215,255,0,0.4)',
              color: '#D7FF00',
            } : {}),
          }}
        >
          <option value="">{t('filterAllTeams')}</option>
          {teams.map(team => <option key={team} value={team}>{team}</option>)}
        </select>
      )}

      {/* Agent search — leaders/admin only */}
      {isLeader && (
        <input
          type="text"
          placeholder={t('filterSearchAgent')}
          value={agentSearch}
          onChange={e => setAgentSearch(e.target.value)}
          style={{ ...inputBase, width: 128 }}
        />
      )}

      {/* Date range */}
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

      {/* Clear */}
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
