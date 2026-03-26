'use client'

import { useState, useEffect, useRef } from 'react'
import { type Call } from './CallsTable'

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

export default function FilterBar({ calls, isLeader, onFiltered }: Props) {
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
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
            selectedStages.length > 0
              ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
          }`}
        >
          Stage {selectedStages.length > 0 && <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">{selectedStages.length}</span>}
          <span className="text-gray-600">▾</span>
        </button>
        {stageOpen && (
          <div className="absolute top-full left-0 mt-1 z-20 bg-gray-900 border border-gray-700 rounded-xl shadow-xl py-1 min-w-[200px]">
            {ALL_STAGES.map(s => (
              <label key={s} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800 cursor-pointer text-xs text-gray-300 capitalize">
                <input
                  type="checkbox"
                  checked={selectedStages.includes(s)}
                  onChange={() => toggleStage(s)}
                  className="accent-blue-500"
                />
                {s}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Client search */}
      <input
        type="text"
        placeholder="Search client…"
        value={clientSearch}
        onChange={e => setClientSearch(e.target.value)}
        className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600 w-36"
      />

      {/* Team filter — leaders/admin only */}
      {isLeader && teams.length > 0 && (
        <select
          value={teamFilter}
          onChange={e => setTeamFilter(e.target.value)}
          className={`text-xs rounded-lg px-3 py-1.5 border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
            teamFilter
              ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
              : 'bg-gray-800 border-gray-700 text-gray-400'
          }`}
        >
          <option value="">All teams</option>
          {teams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      )}

      {/* Agent search — leaders/admin only */}
      {isLeader && (
        <input
          type="text"
          placeholder="Search agent…"
          value={agentSearch}
          onChange={e => setAgentSearch(e.target.value)}
          className="text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600 w-32"
        />
      )}

      {/* Date range */}
      <input
        type="date"
        value={dateFrom}
        onChange={e => setDateFrom(e.target.value)}
        className="text-xs bg-gray-800 border border-gray-700 text-gray-400 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <span className="text-gray-600 text-xs">→</span>
      <input
        type="date"
        value={dateTo}
        onChange={e => setDateTo(e.target.value)}
        className="text-xs bg-gray-800 border border-gray-700 text-gray-400 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={clearAll}
          className="text-xs text-gray-600 hover:text-red-400 transition-colors px-1"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
