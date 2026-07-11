'use client'

import { useEffect, useMemo, useState } from 'react'

type RosterAgent = { id: string; full_name: string; team_name: string | null }
type SalesTarget = { id: string; agent_id: string; period: string; target_amount: number }
type SalesDeal = { id: string; agent_id: string; client_name: string; deal_value: number; deal_date: string; created_at: string }

const cardStyle = { background: 'rgba(215,255,0,0.03)', border: '1px solid rgba(215,255,0,0.12)', borderRadius: 12 }

const MILLION = 1_000_000

function formatMoney(n: number) {
  return `${n.toLocaleString('en-EG')} EGP`
}

function todayStr() {
  return new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().split('T')[0]
}

function currentPeriod() {
  const d = new Date(Date.now() + 2 * 60 * 60 * 1000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function periodToMonthInput(period: string) {
  return period.slice(0, 7)
}

function monthInputToPeriod(value: string) {
  return `${value}-01`
}

const inputStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6,
  color: '#fff',
  padding: '8px 10px',
  fontSize: 13,
  fontFamily: "'Montserrat', sans-serif",
  width: '100%',
}

const buttonStyle = {
  padding: '7px 14px',
  borderRadius: 6,
  border: '1px solid rgba(215,255,0,0.4)',
  background: 'rgba(215,255,0,0.08)',
  color: '#D7FF00',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: "'Space Grotesk', sans-serif",
  whiteSpace: 'nowrap' as const,
}

function compactMoney(n: number) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

// Semi-circle gauge showing the target amount remaining — shrinks toward
// empty as the admin logs deals against the agent (value = target - achieved).
function RemainingGauge({ achieved, target }: { achieved: number; target: number | null }) {
  const size = 168, R = 58, cx = size / 2, cy = R + 12, height = cy + 26
  const hasTarget = target !== null
  const remaining = hasTarget ? Math.max(target - achieved, 0) : 0
  const pct = hasTarget && target > 0 ? Math.min(remaining / target, 1) : 0
  const endX = cx - R * Math.cos(pct * Math.PI)
  const endY = cy - R * Math.sin(pct * Math.PI)
  const fillColor = remaining <= 0 && hasTarget ? '#4A90D9' : '#D7FF00'

  return (
    <svg width={size} height={height} style={{ flexShrink: 0 }}>
      <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 1 0 ${cx + R} ${cy}`} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={12} strokeLinecap="round" />
      {hasTarget && pct > 0.01 && (
        <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${endX} ${endY}`} fill="none" stroke={fillColor} strokeWidth={12} strokeLinecap="round" />
      )}
      <text x={cx} y={cy - 6} fill="#fff" fontSize="20" fontWeight="700" textAnchor="middle" fontFamily="'Space Grotesk', sans-serif">
        {hasTarget ? (remaining <= 0 ? 'Hit!' : compactMoney(remaining)) : '—'}
      </text>
      <text x={cx} y={cy + 14} fill="rgba(255,255,255,0.35)" fontSize="10" textAnchor="middle">
        {hasTarget ? (remaining <= 0 ? 'target reached' : 'remaining') : 'no target set'}
      </text>
    </svg>
  )
}

export default function SalesTargets({ role }: { role: string }) {
  const [period, setPeriod] = useState(currentPeriod)
  const [roster, setRoster] = useState<RosterAgent[]>([])
  const [targets, setTargets] = useState<SalesTarget[]>([])
  const [deals, setDeals] = useState<SalesDeal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [targetModalAgent, setTargetModalAgent] = useState<RosterAgent | null>(null)
  const [targetInput, setTargetInput] = useState('')
  const [dealModalAgent, setDealModalAgent] = useState<RosterAgent | null>(null)
  const [dealClient, setDealClient] = useState('')
  const [dealValue, setDealValue] = useState('')
  const [dealDate, setDealDate] = useState(todayStr)
  const [drawerAgent, setDrawerAgent] = useState<RosterAgent | null>(null)
  const [saving, setSaving] = useState(false)

  const [excluded, setExcluded] = useState<RosterAgent[]>([])
  const [showRemoved, setShowRemoved] = useState(false)

  const isAdmin = role === 'super_admin'

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [targetsRes, dealsRes] = await Promise.all([
        fetch(`/api/sales-targets?period=${period}`).then(r => r.json()),
        fetch(`/api/sales-deals?period=${period}`).then(r => r.json()),
      ])
      if (!targetsRes.ok) throw new Error(targetsRes.error ?? 'Failed to load targets')
      if (!dealsRes.ok) throw new Error(dealsRes.error ?? 'Failed to load deals')
      setRoster(targetsRes.roster ?? [])
      setTargets(targetsRes.targets ?? [])
      setDeals(dealsRes.deals ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [period]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadExcluded() {
    if (!isAdmin) return
    const res = await fetch('/api/sales-targets/exclusions').then(r => r.json())
    if (res.ok) setExcluded(res.excluded ?? [])
  }

  useEffect(() => { loadExcluded() }, [isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    return roster.map(agent => {
      const target = targets.find(t => t.agent_id === agent.id)
      const agentDeals = deals.filter(d => d.agent_id === agent.id)
      const achieved = agentDeals.reduce((sum, d) => sum + d.deal_value, 0)
      return {
        agent,
        targetAmount: target ? target.target_amount : null,
        achieved,
        dealCount: agentDeals.length,
        deals: agentDeals,
      }
    })
  }, [roster, targets, deals])

  const totals = useMemo(() => {
    const targetSum = rows.reduce((sum, r) => sum + (r.targetAmount ?? 0), 0)
    const achievedSum = rows.reduce((sum, r) => sum + r.achieved, 0)
    return { targetSum, achievedSum }
  }, [rows])

  async function submitTarget() {
    if (!targetModalAgent) return
    const millions = Number(targetInput)
    if (!Number.isFinite(millions) || millions < 0) return
    const amount = millions * MILLION
    setSaving(true)
    try {
      const res = await fetch('/api/sales-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: targetModalAgent.id, period, targetAmount: amount }),
      }).then(r => r.json())
      if (!res.ok) throw new Error(res.error ?? 'Failed to save target')
      setTargetModalAgent(null)
      setTargetInput('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save target')
    } finally {
      setSaving(false)
    }
  }

  async function submitDeal() {
    if (!dealModalAgent) return
    const millions = Number(dealValue)
    if (!dealClient.trim() || !Number.isFinite(millions) || millions <= 0 || !dealDate) return
    const value = millions * MILLION
    setSaving(true)
    try {
      const res = await fetch('/api/sales-deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: dealModalAgent.id, clientName: dealClient.trim(), dealValue: value, dealDate }),
      }).then(r => r.json())
      if (!res.ok) throw new Error(res.error ?? 'Failed to log deal')
      setDealModalAgent(null)
      setDealClient('')
      setDealValue('')
      setDealDate(todayStr())
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to log deal')
    } finally {
      setSaving(false)
    }
  }

  async function deleteDeal(id: string) {
    setSaving(true)
    try {
      const res = await fetch('/api/sales-deals', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }).then(r => r.json())
      if (!res.ok) throw new Error(res.error ?? 'Failed to delete deal')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete deal')
    } finally {
      setSaving(false)
    }
  }

  async function removeAgent(agentId: string) {
    setSaving(true)
    try {
      const res = await fetch('/api/sales-targets/exclusions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      }).then(r => r.json())
      if (!res.ok) throw new Error(res.error ?? 'Failed to remove agent')
      await Promise.all([load(), loadExcluded()])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove agent')
    } finally {
      setSaving(false)
    }
  }

  async function addBackAgent(agentId: string) {
    setSaving(true)
    try {
      const res = await fetch('/api/sales-targets/exclusions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      }).then(r => r.json())
      if (!res.ok) throw new Error(res.error ?? 'Failed to add agent back')
      await Promise.all([load(), loadExcluded()])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add agent back')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ color: '#fff', fontFamily: "'Montserrat', sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
          Sales <span style={{ color: '#D7FF00' }}>Targets</span>
        </h1>
        <input
          type="month"
          value={periodToMonthInput(period)}
          onChange={e => e.target.value && setPeriod(monthInputToPeriod(e.target.value))}
          style={{ ...inputStyle, width: 'auto', colorScheme: 'dark' }}
        />
      </div>

      {error && (
        <div style={{ ...cardStyle, padding: '12px 16px', marginBottom: 16, borderColor: 'rgba(192,57,43,0.4)', color: '#e57373' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>No agents found.</p>
      ) : (
        <>
          {/* Summary KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            <div style={{ ...cardStyle, padding: '14px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6, fontWeight: 600 }}>Total Target</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#D7FF00', fontFamily: "'Space Grotesk', sans-serif" }}>{formatMoney(totals.targetSum)}</p>
            </div>
            <div style={{ ...cardStyle, padding: '14px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6, fontWeight: 600 }}>Total Achieved</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#fff', fontFamily: "'Space Grotesk', sans-serif" }}>{formatMoney(totals.achievedSum)}</p>
            </div>
            <div style={{ ...cardStyle, padding: '14px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6, fontWeight: 600 }}>Deals Closed</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#fff', fontFamily: "'Space Grotesk', sans-serif" }}>{deals.length}</p>
            </div>
          </div>

          {/* Agent rows / single "Your Progress" card for agent role */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {rows.map(({ agent, targetAmount, achieved, dealCount }) => (
              <div key={agent.id} style={{ ...cardStyle, padding: '16px 20px', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <RemainingGauge achieved={achieved} target={targetAmount} />

                <div style={{ flex: 1, minWidth: 220 }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: "'Space Grotesk', sans-serif" }}>
                        {role === 'agent' ? `Your Progress — ${agent.full_name}` : agent.full_name}
                      </p>
                      {agent.team_name && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{agent.team_name}</p>}
                    </div>
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={buttonStyle} onClick={() => { setTargetModalAgent(agent); setTargetInput(targetAmount !== null ? String(targetAmount / MILLION) : '') }}>Set Target</button>
                        <button style={buttonStyle} onClick={() => setDealModalAgent(agent)}>Log Deal</button>
                        <button
                          style={{ ...buttonStyle, background: 'transparent', color: 'rgba(192,57,43,0.8)', borderColor: 'rgba(192,57,43,0.3)' }}
                          disabled={saving}
                          onClick={() => removeAgent(agent.id)}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    <div>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Target</p>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#D7FF00', fontFamily: "'Space Grotesk', sans-serif" }}>
                        {targetAmount !== null ? formatMoney(targetAmount) : '—'}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Achieved</p>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: "'Space Grotesk', sans-serif" }}>
                        {formatMoney(achieved)} <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>({dealCount})</span>
                      </p>
                    </div>
                  </div>
                  {dealCount > 0 && (
                    <button
                      onClick={() => setDrawerAgent(agent)}
                      style={{ marginTop: 10, background: 'none', border: 'none', color: 'rgba(215,255,0,0.7)', fontSize: 11, cursor: 'pointer', padding: 0, fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      View {dealCount} deal{dealCount !== 1 ? 's' : ''} →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Removed agents — reversible: admin can add them back to the roster.
          Rendered outside the roster check above so it's still reachable
          even if every agent has been removed. */}
      {isAdmin && excluded.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => setShowRemoved(s => !s)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer', padding: 0, fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {showRemoved ? '▾' : '▸'} Removed Agents ({excluded.length})
          </button>
          {showRemoved && (
            <div style={{ ...cardStyle, marginTop: 10, padding: '8px 16px' }}>
              {excluded.map(agent => (
                <div key={agent.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <span style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{agent.full_name}</span>
                    {agent.team_name && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginLeft: 8 }}>{agent.team_name}</span>}
                  </div>
                  <button style={buttonStyle} disabled={saving} onClick={() => addBackAgent(agent.id)}>Add Back</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Set Target modal */}
      {targetModalAgent && (
        <>
          <div onClick={() => setTargetModalAgent(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 360, background: '#0e0e0e', border: '1px solid rgba(215,255,0,0.15)', borderRadius: 12, padding: 24, zIndex: 61 }}>
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, fontFamily: "'Space Grotesk', sans-serif" }}>Set Target</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>{targetModalAgent.full_name} — {periodToMonthInput(period)}</p>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Target in millions, e.g. 1.5"
                value={targetInput}
                onChange={e => setTargetInput(e.target.value)}
                style={{ ...inputStyle, paddingRight: 30 }}
                autoFocus
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(215,255,0,0.6)', fontSize: 13, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", pointerEvents: 'none' }}>
                M
              </span>
            </div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 6, marginBottom: 16 }}>
              {Number.isFinite(Number(targetInput)) && targetInput !== ''
                ? `= ${formatMoney(Number(targetInput) * MILLION)}`
                : 'Enter the target in millions (e.g. 1.5 = 1,500,000 EGP)'}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={{ ...buttonStyle, background: 'transparent', color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.15)' }} onClick={() => setTargetModalAgent(null)}>Cancel</button>
              <button style={buttonStyle} disabled={saving} onClick={submitTarget}>Save</button>
            </div>
          </div>
        </>
      )}

      {/* Log Deal modal */}
      {dealModalAgent && (
        <>
          <div onClick={() => setDealModalAgent(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 360, background: '#0e0e0e', border: '1px solid rgba(215,255,0,0.15)', borderRadius: 12, padding: 24, zIndex: 61 }}>
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, fontFamily: "'Space Grotesk', sans-serif" }}>Log Deal</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>{dealModalAgent.full_name}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 6 }}>
              <input type="text" placeholder="Client name" value={dealClient} onChange={e => setDealClient(e.target.value)} style={inputStyle} autoFocus />
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  placeholder="Deal value in millions, e.g. 1.3"
                  value={dealValue}
                  onChange={e => setDealValue(e.target.value)}
                  style={{ ...inputStyle, paddingRight: 30 }}
                />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(215,255,0,0.6)', fontSize: 13, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", pointerEvents: 'none' }}>
                  M
                </span>
              </div>
              <input type="date" value={dealDate} onChange={e => setDealDate(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>
              {Number.isFinite(Number(dealValue)) && dealValue !== ''
                ? `= ${formatMoney(Number(dealValue) * MILLION)}`
                : 'Enter the deal value in millions (e.g. 1.3 = 1,300,000 EGP)'}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={{ ...buttonStyle, background: 'transparent', color: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.15)' }} onClick={() => setDealModalAgent(null)}>Cancel</button>
              <button style={buttonStyle} disabled={saving} onClick={submitDeal}>Save</button>
            </div>
          </div>
        </>
      )}

      {/* Per-agent deal drawer */}
      {drawerAgent && (
        <>
          <div onClick={() => setDrawerAgent(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60 }} />
          <div style={{ position: 'fixed', right: 0, top: 0, height: '100%', width: 440, background: '#0e0e0e', borderLeft: '1px solid rgba(215,255,0,0.15)', zIndex: 61, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: "'Space Grotesk', sans-serif", marginBottom: 4 }}>{drawerAgent.full_name}</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{periodToMonthInput(period)}</p>
              </div>
              <button onClick={() => setDrawerAgent(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
              {deals.filter(d => d.agent_id === drawerAgent.id).length === 0 ? (
                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13, marginTop: 40 }}>No deals logged this month</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <th style={{ padding: '8px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.35)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>Client</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.35)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>Value</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.35)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>Date</th>
                      {isAdmin && <th style={{ padding: '8px 12px' }} />}
                    </tr>
                  </thead>
                  <tbody>
                    {deals.filter(d => d.agent_id === drawerAgent.id).map(d => (
                      <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '10px 16px', color: '#fff', fontWeight: 600 }}>{d.client_name}</td>
                        <td style={{ padding: '10px 12px', color: '#D7FF00' }}>{formatMoney(d.deal_value)}</td>
                        <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.6)' }}>{d.deal_date}</td>
                        {isAdmin && (
                          <td style={{ padding: '10px 12px' }}>
                            <button onClick={() => deleteDeal(d.id)} disabled={saving} style={{ background: 'none', border: 'none', color: 'rgba(192,57,43,0.8)', cursor: 'pointer', fontSize: 11 }}>Delete</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
