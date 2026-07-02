'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { parseExcelFile, type ParsedSheet, type RawRow } from '@/lib/excel-parser'
import * as XLSX from 'xlsx'

const NEON = '#D7FF00'
const NEON_DIM = 'rgba(215,255,0,0.12)'
const NEON_BORDER = 'rgba(215,255,0,0.25)'
const CARD = 'rgba(255,255,255,0.03)'
const BORDER = 'rgba(255,255,255,0.08)'
const MUTED = 'rgba(255,255,255,0.35)'
const font = { fontFamily: "'Montserrat', sans-serif" }
const fontDisplay = { fontFamily: "'Space Grotesk', sans-serif" }
const PAGE_SIZE = 20

interface SheetSummary {
  id: string
  name: string
  current_cycle: number
  created_at: string
  contactCount: number
}

interface Agent { id: string; full_name: string }

interface AgentSetting { id: string; full_name: string; team_name: string | null; whatsapp_active: boolean }

interface AssignmentRow {
  id: string
  contact_id: string
  cycle: number
  message_text: string | null
  sent_at: string | null
  response_status: 'pending' | 'answered' | 'not_answered'
  responded_at: string | null
  agent: Agent | Agent[] | null
}

interface ContactRow {
  id: string
  phone: string
  client_name: string | null
  first_response_at: string | null
  first_response_agent: Agent | Agent[] | null
}

interface SheetDetail {
  sheet: { id: string; name: string; current_cycle: number; created_at: string }
  contacts: ContactRow[]
  assignments: AssignmentRow[]
  assigned_agents: { id: string; full_name: string }[]
}

function oneOf<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function cellToString(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

const PHONE_HEADER_KEYWORDS = ['mobile', 'phone', 'whatsapp', 'tel', 'number', 'contact']
const NAME_HEADER_KEYWORDS = ['name']

function looksLikePhone(v: string | number | null): boolean {
  const digits = String(v ?? '').replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 16
}

// Header-keyword match first; falls back to sniffing which column's values
// actually look like phone numbers, so it still works on unusual headers.
function detectPhoneColumn(sheet: ParsedSheet): string {
  const byHeader = sheet.headers.find(h => PHONE_HEADER_KEYWORDS.some(k => h.toLowerCase().includes(k)))
  if (byHeader) return byHeader

  const sample = sheet.rows.slice(0, 30)
  let best = ''
  let bestScore = 0
  for (const h of sheet.headers) {
    const score = sample.filter(r => looksLikePhone(r[h])).length / Math.max(1, sample.length)
    if (score > bestScore) { bestScore = score; best = h }
  }
  return bestScore > 0.3 ? best : ''
}

function detectNameColumn(sheet: ParsedSheet, phoneCol: string): string {
  return sheet.headers.find(h => h !== phoneCol && NAME_HEADER_KEYWORDS.some(k => h.toLowerCase().includes(k))) ?? ''
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  answered: 'Answered',
  not_answered: 'No Answer',
}
const STATUS_COLOR: Record<string, string> = {
  pending: MUTED,
  answered: NEON,
  not_answered: 'rgba(255,120,120,0.8)',
}

export default function WhatsAppAdminClient({ initialSheets, initialAgents }: { initialSheets: SheetSummary[]; initialAgents: AgentSetting[] }) {
  const [sheets, setSheets] = useState<SheetSummary[]>(initialSheets)
  const [agents, setAgents] = useState<AgentSetting[]>(initialAgents)
  const [showAgents, setShowAgents] = useState(false)
  const [togglingAgent, setTogglingAgent] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(initialSheets[0]?.id ?? null)
  const [detail, setDetail] = useState<SheetDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [cycleFilter, setCycleFilter] = useState<number | null>(null)
  const [randomizing, setRandomizing] = useState(false)
  const [confirmRandomize, setConfirmRandomize] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [page, setPage] = useState(1)
  const [messageModalContact, setMessageModalContact] = useState<{ contact: ContactRow; assignment: AssignmentRow | null } | null>(null)

  const [sheetAgentList, setSheetAgentList] = useState<(AgentSetting & { assigned: boolean })[]>([])
  const [checkedAgentIds, setCheckedAgentIds] = useState<Set<string>>(new Set())
  const [savingAgents, setSavingAgents] = useState(false)
  const [agentAssignmentError, setAgentAssignmentError] = useState<string | null>(null)

  const loadDetail = useCallback(async (sheetId: string) => {
    setLoadingDetail(true)
    setError(null)
    try {
      const res = await fetch(`/api/whatsapp/admin/sheets/${sheetId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load sheet')
      setDetail(data)
      setCycleFilter(data.sheet.current_cycle || 1)

      const agentsRes = await fetch(`/api/whatsapp/admin/sheets/${sheetId}/agents`)
      const agentsData = await agentsRes.json()
      if (agentsRes.ok) {
        const list: (AgentSetting & { assigned: boolean })[] = agentsData.agents ?? []
        setSheetAgentList(list)
        setCheckedAgentIds(new Set(list.filter(a => a.assigned).map(a => a.id)))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sheet')
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
    else setDetail(null)
  }, [selectedId, loadDetail])

  function downloadByAgent() {
    if (!detail) return
    const filtered = cycleFilter
      ? detail.assignments.filter(a => a.cycle === cycleFilter)
      : detail.assignments

    const byAgent = new Map<string, typeof filtered>()
    for (const a of filtered) {
      const agent = oneOf(a.agent)
      const name = agent?.full_name ?? 'Unassigned'
      if (!byAgent.has(name)) byAgent.set(name, [])
      byAgent.get(name)!.push(a)
    }

    const wb = XLSX.utils.book_new()
    for (const [agentName, agentAssignments] of byAgent) {
      const rows = agentAssignments.map(a => {
        const contact = detail.contacts.find(c => c.id === a.contact_id)
        return {
          'Client Name': contact?.client_name ?? '',
          'Phone': contact?.phone ?? '',
          'Cycle': a.cycle,
          'Status': a.response_status === 'answered' ? 'Answered'
                  : a.response_status === 'not_answered' ? 'Not Answered'
                  : 'Pending',
          'Sent At': a.sent_at ? new Date(a.sent_at).toLocaleString() : '',
          'Responded At': a.responded_at ? new Date(a.responded_at).toLocaleString() : '',
        }
      })
      const safeName = agentName.slice(0, 31).replace(/[\\/*?:[\]]/g, '')
      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, safeName)
    }

    const label = cycleFilter ? `cycle${cycleFilter}` : 'all-cycles'
    XLSX.writeFile(wb, `${detail.sheet.name}-${label}-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  async function handleSaveAgentAssignment() {
    if (!selectedId) return
    setSavingAgents(true)
    setAgentAssignmentError(null)
    try {
      const res = await fetch(`/api/whatsapp/admin/sheets/${selectedId}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_ids: Array.from(checkedAgentIds) }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to save')
    } catch (err) {
      setAgentAssignmentError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingAgents(false)
    }
  }

  async function handleRandomize() {
    if (!selectedId) return
    setRandomizing(true)
    setError(null)
    try {
      const res = await fetch(`/api/whatsapp/admin/sheets/${selectedId}/randomize`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Randomize failed')
      setSheets(prev => prev.map(s => s.id === selectedId ? { ...s, current_cycle: data.cycle } : s))
      await loadDetail(selectedId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Randomize failed')
    } finally {
      setRandomizing(false)
      setConfirmRandomize(false)
    }
  }

  async function toggleAgentActive(agent: AgentSetting) {
    const next = !agent.whatsapp_active
    setTogglingAgent(agent.id)
    setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, whatsapp_active: next } : a))
    try {
      const res = await fetch('/api/whatsapp/admin/agents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: agent.id, whatsapp_active: next }),
      })
      if (!res.ok) throw new Error('Failed to update agent')
    } catch (err) {
      setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, whatsapp_active: agent.whatsapp_active } : a))
      setError(err instanceof Error ? err.message : 'Failed to update agent')
    } finally {
      setTogglingAgent(null)
    }
  }

  function handleUploaded(sheet: SheetSummary) {
    setSheets(prev => [sheet, ...prev])
    setSelectedId(sheet.id)
    setShowUpload(false)
  }

  async function handleDeleteSheet(sheetId: string) {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/whatsapp/admin/sheets/${sheetId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Delete failed')
      setSheets(prev => prev.filter(s => s.id !== sheetId))
      if (selectedId === sheetId) {
        setSelectedId(null)
        setDetail(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
      setConfirmDeleteId(null)
    }
  }

  const cycles = detail ? Array.from({ length: detail.sheet.current_cycle }, (_, i) => i + 1) : []

  const rows = useMemo(() => {
    if (!detail) return []
    return detail.contacts.map(contact => {
      const assignment = detail.assignments.find(a => a.contact_id === contact.id && a.cycle === cycleFilter) ?? null
      const agent = assignment ? oneOf(assignment.agent) : null
      const firstAgent = oneOf(contact.first_response_agent)
      return { contact, assignment, agent, firstAgent }
    })
  }, [detail, cycleFilter])

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const showStart = rows.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0
  const showEnd = Math.min(page * PAGE_SIZE, rows.length)

  useEffect(() => {
    setPage(1)
  }, [cycleFilter, detail?.sheet.id])

  return (
    <div style={{ minHeight: '100vh', background: '#000', ...font }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#fff', margin: 0, ...fontDisplay }}>
              WhatsApp <span style={{ color: NEON }}>Campaigns</span>
            </h1>
            <p style={{ color: MUTED, fontSize: 13, marginTop: 6 }}>
              Upload client sheets, rotate them across agents, and track responses.
            </p>
          </div>
          <button onClick={() => setShowUpload(true)} style={{
            padding: '11px 20px', borderRadius: 8, border: 'none', background: NEON,
            color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer', ...fontDisplay,
          }}>
            + Upload Sheet
          </button>
        </div>

        {error && (
          <div style={{ background: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#ff8080', fontSize: 13 }}>
            {error}
          </div>
        )}

        {showUpload && (
          <UploadPanel onClose={() => setShowUpload(false)} onUploaded={handleUploaded} />
        )}

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, marginBottom: 20, overflow: 'hidden' }}>
          <button
            onClick={() => setShowAgents(s => !s)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: MUTED, ...fontDisplay, letterSpacing: '0.05em' }}>
              AGENTS ({agents.filter(a => a.whatsapp_active).length}/{agents.length} active)
            </span>
            <span style={{ color: MUTED, fontSize: 12 }}>{showAgents ? '▾' : '▸'}</span>
          </button>
          {showAgents && (
            <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${BORDER}` }}>
              <p style={{ color: MUTED, fontSize: 11, margin: '12px 0' }}>
                Unchecked agents won&apos;t receive new clients on the next re-randomize. Existing assignments are unaffected.
              </p>
              {agents.length === 0 && <div style={{ color: MUTED, fontSize: 12, padding: '8px 0' }}>No agents found.</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {agents.map(a => (
                  <label key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8,
                    border: `1px solid ${BORDER}`, fontSize: 12, color: a.whatsapp_active ? '#fff' : MUTED, cursor: 'pointer',
                    opacity: togglingAgent === a.id ? 0.6 : 1,
                  }}>
                    <input
                      type="checkbox"
                      checked={a.whatsapp_active}
                      disabled={togglingAgent === a.id}
                      onChange={() => toggleAgentActive(a)}
                      style={{ accentColor: NEON }}
                    />
                    {a.full_name}
                    {a.team_name && <span style={{ color: MUTED, fontSize: 10 }}>· {a.team_name}</span>}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Sheet list */}
          <div style={{ width: 240, flexShrink: 0, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, fontSize: 12, fontWeight: 600, color: MUTED, ...fontDisplay, letterSpacing: '0.05em' }}>
              SHEETS ({sheets.length})
            </div>
            {sheets.length === 0 && (
              <div style={{ padding: 20, color: MUTED, fontSize: 12, textAlign: 'center' }}>No sheets yet</div>
            )}
            {sheets.map(s => (
              <div key={s.id} style={{
                padding: '12px 16px', borderBottom: `1px solid ${BORDER}`,
                background: s.id === selectedId ? NEON_DIM : 'transparent',
              }}>
                {confirmDeleteId === s.id ? (
                  <div>
                    <div style={{ color: '#fff', fontSize: 12, marginBottom: 8 }}>Delete &quot;{s.name}&quot;? This removes all contacts and assignments.</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleDeleteSheet(s.id)} disabled={deleting} style={{
                        padding: '6px 10px', borderRadius: 6, border: 'none', background: 'rgba(255,80,80,0.9)',
                        color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer', ...fontDisplay,
                      }}>
                        {deleting ? 'Deleting…' : 'Confirm'}
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} disabled={deleting} style={{
                        padding: '6px 10px', borderRadius: 6, border: `1px solid ${BORDER}`, background: 'transparent',
                        color: MUTED, fontSize: 11, cursor: 'pointer', ...fontDisplay,
                      }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => setSelectedId(s.id)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: s.id === selectedId ? NEON : '#fff', fontSize: 13, fontWeight: 600, ...fontDisplay, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                      <div style={{ color: MUTED, fontSize: 11, marginTop: 4 }}>{s.contactCount} contacts &middot; cycle {s.current_cycle}</div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDeleteId(s.id) }}
                      title="Remove sheet"
                      style={{
                        flexShrink: 0, background: 'none', border: 'none', color: MUTED, cursor: 'pointer',
                        fontSize: 13, padding: '2px 4px', lineHeight: 1,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,120,120,0.9)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = MUTED }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Sheet detail */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {!selectedId && (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 40, textAlign: 'center', color: MUTED, fontSize: 13 }}>
                Select or upload a sheet to get started.
              </div>
            )}

            {selectedId && loadingDetail && (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 40, textAlign: 'center', color: MUTED, fontSize: 13 }}>
                Loading…
              </div>
            )}

            {selectedId && !loadingDetail && detail && (
              <>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  <StatCard label="Contacts" value={detail.contacts.length} />
                  <StatCard label="Current Cycle" value={detail.sheet.current_cycle} />
                  <StatCard label="Answered (all cycles)" value={detail.assignments.filter(a => a.response_status === 'answered').length} />
                  <StatCard label="First Responses" value={detail.contacts.filter(c => c.first_response_at).length} />
                </div>

                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: MUTED, ...fontDisplay, letterSpacing: '0.05em', marginBottom: 12 }}>
                    ASSIGNED AGENTS
                    <span style={{ marginLeft: 8, fontWeight: 400, color: checkedAgentIds.size === 0 ? NEON : MUTED }}>
                      {checkedAgentIds.size === 0 ? '(All active agents)' : `(${checkedAgentIds.size} specific)`}
                    </span>
                  </div>
                  {agentAssignmentError && (
                    <div style={{ color: '#ff8080', fontSize: 12, marginBottom: 10 }}>{agentAssignmentError}</div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {sheetAgentList.map(a => (
                      <label key={a.id} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                        borderRadius: 6, border: `1px solid ${checkedAgentIds.has(a.id) ? NEON_BORDER : BORDER}`,
                        background: checkedAgentIds.has(a.id) ? NEON_DIM : 'transparent',
                        fontSize: 12, color: checkedAgentIds.has(a.id) ? '#fff' : MUTED, cursor: 'pointer',
                      }}>
                        <input
                          type="checkbox"
                          checked={checkedAgentIds.has(a.id)}
                          onChange={() => setCheckedAgentIds(prev => {
                            const next = new Set(prev)
                            if (next.has(a.id)) next.delete(a.id); else next.add(a.id)
                            return next
                          })}
                          style={{ accentColor: NEON }}
                        />
                        {a.full_name}
                        {!a.whatsapp_active && <span style={{ color: MUTED, fontSize: 10, marginLeft: 4 }}>(inactive)</span>}
                      </label>
                    ))}
                    {sheetAgentList.length === 0 && (
                      <span style={{ fontSize: 12, color: MUTED }}>No agents found.</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      onClick={handleSaveAgentAssignment}
                      disabled={savingAgents}
                      style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: NEON,
                               color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer', ...fontDisplay }}
                    >
                      {savingAgents ? 'Saving…' : 'Save Assignment'}
                    </button>
                    <span style={{ fontSize: 11, color: MUTED }}>
                      {checkedAgentIds.size === 0
                        ? 'No agents checked → all active agents receive contacts on randomize'
                        : `Only checked agents receive contacts from this sheet`}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: MUTED, ...fontDisplay }}>Viewing cycle</span>
                    <select value={cycleFilter ?? ''} onChange={e => setCycleFilter(Number(e.target.value))} disabled={cycles.length === 0} style={{
                      background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: 6,
                      padding: '6px 10px', color: '#fff', fontSize: 12, ...font,
                    }}>
                      {cycles.length === 0 && <option value="">—</option>}
                      {cycles.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {!confirmRandomize ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={downloadByAgent} style={{
                        padding: '9px 16px', borderRadius: 8, border: `1px solid ${NEON_BORDER}`,
                        background: NEON_DIM, color: NEON, fontWeight: 600, fontSize: 12, cursor: 'pointer', ...fontDisplay,
                      }}>
                        ↓ Download by Agent
                      </button>
                      <button onClick={() => setConfirmRandomize(true)} style={{
                        padding: '9px 16px', borderRadius: 8, border: `1px solid ${NEON_BORDER}`,
                        background: NEON_DIM, color: NEON, fontWeight: 600, fontSize: 12, cursor: 'pointer', ...fontDisplay,
                      }}>
                        ↻ Re-randomize
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: MUTED }}>Redistribute all contacts to a new agent for cycle {detail.sheet.current_cycle + 1}?</span>
                      <button onClick={handleRandomize} disabled={randomizing} style={{
                        padding: '7px 14px', borderRadius: 6, border: 'none', background: NEON,
                        color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer', ...fontDisplay,
                      }}>
                        {randomizing ? 'Working…' : 'Confirm'}
                      </button>
                      <button onClick={() => setConfirmRandomize(false)} style={{
                        padding: '7px 14px', borderRadius: 6, border: `1px solid ${BORDER}`, background: 'transparent',
                        color: MUTED, fontSize: 12, cursor: 'pointer', ...fontDisplay,
                      }}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <style>{`
                  tr.wa-row:nth-child(even) { background: rgba(255,255,255,0.015); }
                  tr.wa-row:hover { background: rgba(255,255,255,0.04); }
                  td.wa-msg:hover { color: rgba(255,255,255,0.65) !important; }
                `}</style>

                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto', maxHeight: 600, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                          {[
                            { label: 'Phone', width: 120 },
                            { label: 'Client', width: 140 },
                            { label: 'Agent (this cycle)', width: 130 },
                            { label: 'Sent At', width: 150 },
                            { label: 'Status', width: 90 },
                            { label: 'Message', width: undefined },
                            { label: 'First Response', width: 130 },
                          ].map(h => (
                            <th key={h.label} style={{
                              textAlign: 'left', padding: '12px 14px', color: MUTED, fontWeight: 600, ...fontDisplay,
                              whiteSpace: 'nowrap', width: h.width, position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 1,
                            }}>{h.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map(({ contact, assignment, agent, firstAgent }) => (
                          <tr key={contact.id} className="wa-row" style={{ borderBottom: `1px solid ${BORDER}` }}>
                            <td style={{ padding: '12px 14px', color: '#fff', ...fontDisplay, whiteSpace: 'nowrap', width: 120 }}>{contact.phone}</td>
                            <td style={{ padding: '12px 14px', color: MUTED, width: 140 }}>{contact.client_name ?? '—'}</td>
                            <td style={{ padding: '12px 14px', color: '#fff', width: 130 }}>{agent?.full_name ?? '—'}</td>
                            <td style={{ padding: '12px 14px', color: MUTED, whiteSpace: 'nowrap', width: 150 }}>{assignment?.sent_at ? new Date(assignment.sent_at).toLocaleString() : '—'}</td>
                            <td style={{ padding: '12px 14px', width: 90 }}>
                              <span style={{ color: assignment ? STATUS_COLOR[assignment.response_status] : MUTED, fontWeight: 600 }}>
                                {assignment ? STATUS_LABEL[assignment.response_status] : '—'}
                              </span>
                            </td>
                            <td
                              className="wa-msg"
                              style={{
                                padding: '12px 14px', color: MUTED, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap', cursor: assignment?.message_text ? 'pointer' : 'default',
                              }}
                              title={assignment?.message_text ?? ''}
                              onClick={() => assignment?.message_text && setMessageModalContact({ contact, assignment })}
                            >
                              {assignment?.message_text ?? '—'}
                            </td>
                            <td style={{ padding: '12px 14px', color: NEON, whiteSpace: 'nowrap', width: 130 }}>{firstAgent?.full_name ?? '—'}</td>
                          </tr>
                        ))}
                        {rows.length === 0 && (
                          <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: MUTED }}>No contacts.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap', gap: 10 }}>
                  <span style={{ fontSize: 12, color: MUTED }}>
                    {rows.length > 0 ? `Showing ${showStart}–${showEnd} of ${rows.length} contacts` : 'No contacts'}
                  </span>
                  {totalPages > 1 && (
                    <Pager page={page} totalPages={totalPages} onPageChange={setPage} />
                  )}
                </div>

                {messageModalContact && (
                  <MessageModal
                    contact={messageModalContact.contact}
                    assignment={messageModalContact.assignment}
                    onClose={() => setMessageModalContact(null)}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 18px', minWidth: 130 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: NEON, ...fontDisplay }}>{value}</div>
      <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function pageButtonStyle(active: boolean, disabled?: boolean): React.CSSProperties {
  return {
    minWidth: 32, padding: '6px 10px', borderRadius: 8, fontSize: 12, textAlign: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.3 : 1, ...font,
    background: active ? NEON_DIM : '#161616',
    border: `1px solid ${active ? NEON_BORDER : 'rgba(255,255,255,0.12)'}`,
    color: active ? NEON : '#fff', fontWeight: active ? 700 : 500,
  }
}

function Pager({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  const start = Math.max(1, Math.min(page - 3, totalPages - 6))
  const end = Math.min(totalPages, start + 6)
  const pages: number[] = []
  for (let p = start; p <= end; p++) pages.push(p)

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        style={pageButtonStyle(false, page === 1)}
      >
        ‹
      </button>
      {pages.map(p => (
        <button key={p} onClick={() => onPageChange(p)} style={pageButtonStyle(p === page)}>
          {p}
        </button>
      ))}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        style={pageButtonStyle(false, page === totalPages)}
      >
        ›
      </button>
    </div>
  )
}

function MessageModal({
  contact,
  assignment,
  onClose,
}: {
  contact: ContactRow
  assignment: AssignmentRow | null
  onClose: () => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0d0d0d', border: `1px solid ${NEON_BORDER}`, borderRadius: 18,
          width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, ...fontDisplay }}>{contact.phone}</div>
            <div style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>{contact.client_name ?? '—'}</div>
            {assignment && (
              <span style={{ display: 'inline-block', marginTop: 8, fontSize: 11, fontWeight: 600, color: STATUS_COLOR[assignment.response_status] }}>
                {STATUS_LABEL[assignment.response_status]}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              flexShrink: 0, width: 32, height: 32, borderRadius: '50%', border: 'none',
              background: 'rgba(255,255,255,0.07)', color: MUTED, cursor: 'pointer', fontSize: 14,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = NEON_DIM; e.currentTarget.style.color = NEON }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = MUTED }}
          >
            ✕
          </button>
        </div>
        <div style={{ color: '#fff', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', ...font }}>
          {assignment?.message_text ?? '—'}
        </div>
      </div>
    </div>
  )
}

function UploadPanel({ onClose, onUploaded }: { onClose: () => void; onUploaded: (sheet: SheetSummary) => void }) {
  const [dragOver, setDragOver] = useState(false)
  const [parsedSheets, setParsedSheets] = useState<ParsedSheet[]>([])
  const [sheetIdx, setSheetIdx] = useState(0)
  const [phoneCol, setPhoneCol] = useState('')
  const [nameCol, setNameCol] = useState('')
  const [sheetName, setSheetName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeSheet = parsedSheets[sheetIdx]

  const preview: RawRow[] = activeSheet?.rows ?? []
  const previewContacts = useMemo(() => {
    if (!activeSheet || !phoneCol) return []
    const seen = new Set<string>()
    const out: { phone: string; client_name: string | null }[] = []
    for (const row of activeSheet.rows) {
      const phone = cellToString(row[phoneCol])
      if (!phone) continue
      const key = phone.replace(/\D/g, '')
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push({ phone, client_name: nameCol ? (cellToString(row[nameCol]) || null) : null })
    }
    return out
  }, [activeSheet, phoneCol, nameCol])

  async function handleFile(file: File) {
    setError(null)
    try {
      const result = await parseExcelFile(file)
      if (result.length === 0) { setError('No data found in this file.'); return }
      setParsedSheets(result)
      setSheetIdx(0)
      const detectedPhone = detectPhoneColumn(result[0])
      setPhoneCol(detectedPhone)
      setNameCol(detectNameColumn(result[0], detectedPhone))
      setSheetName(file.name.replace(/\.[^.]+$/, ''))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]; if (f) handleFile(f)
  }

  async function handleConfirm() {
    if (!sheetName.trim() || previewContacts.length === 0) return
    setSubmitting(true); setError(null)
    try {
      const res = await fetch('/api/whatsapp/admin/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sheetName.trim(), contacts: previewContacts }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      onUploaded({ id: data.sheet.id, name: data.sheet.name, current_cycle: data.sheet.current_cycle, created_at: data.sheet.created_at, contactCount: data.contactCount })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ background: CARD, border: `1px solid ${NEON_BORDER}`, borderRadius: 12, padding: 24, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0, ...fontDisplay }}>Upload Sheet</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 14 }}>✕</button>
      </div>

      {error && (
        <div style={{ background: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#ff8080', fontSize: 13 }}>
          {error}
        </div>
      )}

      {parsedSheets.length === 0 && (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragOver ? NEON : BORDER}`, borderRadius: 10, padding: 32,
            textAlign: 'center', cursor: 'pointer', background: dragOver ? NEON_DIM : 'transparent', transition: 'all 0.2s',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, ...fontDisplay }}>Drop Excel file here</div>
          <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>or click to browse — .xlsx, .xls</div>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>
      )}

      {parsedSheets.length > 0 && activeSheet && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {parsedSheets.length > 1 && (
            <div>
              <label style={{ fontSize: 12, color: MUTED, display: 'block', marginBottom: 6 }}>Workbook sheet</label>
              <select value={sheetIdx} onChange={e => {
                const idx = Number(e.target.value)
                setSheetIdx(idx)
                const detectedPhone = detectPhoneColumn(parsedSheets[idx])
                setPhoneCol(detectedPhone)
                setNameCol(detectNameColumn(parsedSheets[idx], detectedPhone))
              }} style={{
                background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '7px 10px', color: '#fff', fontSize: 13, width: '100%', ...font,
              }}>
                {parsedSheets.map((s, i) => <option key={s.sheetName} value={i}>{s.sheetName} ({s.rows.length} rows)</option>)}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 12, color: MUTED, display: 'block', marginBottom: 6 }}>Phone number column * <span style={{ color: phoneCol ? NEON : 'rgba(255,120,120,0.8)' }}>{phoneCol ? '(auto-detected)' : '(not detected — pick one)'}</span></label>
              <select value={phoneCol} onChange={e => setPhoneCol(e.target.value)} style={{
                background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '7px 10px', color: '#fff', fontSize: 13, width: '100%', ...font,
              }}>
                <option value="">— select —</option>
                {activeSheet.headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 12, color: MUTED, display: 'block', marginBottom: 6 }}>Client name column (optional) {nameCol && <span style={{ color: NEON }}>(auto-detected)</span>}</label>
              <select value={nameCol} onChange={e => setNameCol(e.target.value)} style={{
                background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '7px 10px', color: '#fff', fontSize: 13, width: '100%', ...font,
              }}>
                <option value="">— none —</option>
                {activeSheet.headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, color: MUTED, display: 'block', marginBottom: 6 }}>Sheet name</label>
            <input value={sheetName} onChange={e => setSheetName(e.target.value)} style={{
              background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '8px 10px', color: '#fff', fontSize: 13, width: '100%', boxSizing: 'border-box', ...font,
            }} />
          </div>

          {phoneCol && (
            <div>
              <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>
                {previewContacts.length} unique numbers found {preview.length !== previewContacts.length ? `(from ${preview.length} rows)` : ''}
              </div>
              <div style={{ maxHeight: 180, overflowY: 'auto', border: `1px solid ${BORDER}`, borderRadius: 8 }}>
                {previewContacts.slice(0, 50).map((c, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', borderBottom: `1px solid ${BORDER}`, fontSize: 12 }}>
                    <span style={{ color: '#fff' }}>{c.phone}</span>
                    <span style={{ color: MUTED }}>{c.client_name ?? ''}</span>
                  </div>
                ))}
                {previewContacts.length > 50 && (
                  <div style={{ padding: '6px 12px', fontSize: 11, color: MUTED, textAlign: 'center' }}>…and {previewContacts.length - 50} more</div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setParsedSheets([])} style={{
              flex: 1, padding: '11px', borderRadius: 8, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, fontSize: 13, cursor: 'pointer', ...fontDisplay,
            }}>← Choose different file</button>
            <button onClick={handleConfirm} disabled={!phoneCol || !sheetName.trim() || previewContacts.length === 0 || submitting} style={{
              flex: 2, padding: '11px', borderRadius: 8, border: 'none',
              background: phoneCol && sheetName.trim() && previewContacts.length > 0 && !submitting ? NEON : 'rgba(215,255,0,0.25)',
              color: '#000', fontWeight: 700, fontSize: 14, cursor: phoneCol && sheetName.trim() ? 'pointer' : 'not-allowed', ...fontDisplay,
            }}>
              {submitting ? 'Uploading…' : `Create Sheet (${previewContacts.length} contacts)`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
