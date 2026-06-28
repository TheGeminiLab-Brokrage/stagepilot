'use client'

import { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip } from 'recharts'
import CrmStatusChanges from '../admin/reports/CrmStatusChanges'

type Call = {
  id: string
  client_name: string | null
  campaign: string | null
  stage: string | null
  stage_corrected: string | null
  agent_stage: string | null
  uploaded_at: string
  agent_id: string
  team_name: string | null
  agent_full_name: string | null
}

type CrmRow = Record<string, unknown>
type CrmDataState = { data: CrmRow[]; dateFrom: string; dateTo: string } | null

const STAGE_COLORS: Record<string, string> = {
  'fresh leads':           '#4A90D9',
  'interested / follow up':'#2A9D8F',
  'potential to close':    '#8FD14F',
  'meeting scheduled':     '#E07B54',
  'meeting done':          '#1F6B75',
  'done deal':             '#D7FF00',
  'low budget':            '#9B72CF',
  'not reachable':         '#888888',
  'not interested':        '#444444',
}

const STAGE_LABELS: Record<string, string> = {
  'fresh leads':           'Fresh Leads',
  'interested / follow up':'Interested',
  'potential to close':    'Potential',
  'meeting scheduled':     'Meeting Sched.',
  'meeting done':          'Meeting Done',
  'done deal':             'Done Deal',
  'low budget':            'Low Budget',
  'not reachable':         'Not Reachable',
  'not interested':        'Not Interested',
}

// CRM "TO STATUS" text → chart stage key (case-insensitive)
const CRM_STATUS_MAP: Record<string, string> = {
  'fresh leads':           'fresh leads',
  'interested/follow up':  'interested / follow up',
  'interested / follow up':'interested / follow up',
  'potential to close':    'potential to close',
  'meeting scheduled':     'meeting scheduled',
  'meeting done':          'meeting done',
  'done deal':             'done deal',
  'low budget':            'low budget',
  'not reached':           'not reachable',
  'not reachable':         'not reachable',
  'not interested':        'not interested',
}

const ALL_STAGES = Object.keys(STAGE_COLORS)
const DROPPED_STAGES = ['not interested', 'low budget']

function effectiveStage(call: Call): string {
  return (call.stage_corrected ?? call.stage ?? '').toLowerCase()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomDonutLabel({ cx, cy, midAngle, outerRadius, value, percent }: any) {
  if (!percent || percent < 0.02) return null
  const RADIAN = Math.PI / 180
  const radius = (outerRadius ?? 0) + 36
  const x = (cx ?? 0) + radius * Math.cos(-(midAngle ?? 0) * RADIAN)
  const y = (cy ?? 0) + radius * Math.sin(-(midAngle ?? 0) * RADIAN)
  return (
    <text x={x} y={y} fill="rgba(255,255,255,0.65)" textAnchor={x > (cx ?? 0) ? 'start' : 'end'} dominantBaseline="central" fontSize={10} fontFamily="'Space Grotesk', sans-serif">
      {value} ({(percent * 100).toFixed(2)}%)
    </text>
  )
}

// Semi-circle gauge
function Gauge({ value, max }: { value: number; max: number }) {
  const size = 150, R = 52, cx = size / 2, cy = R + 10, height = cy + 22
  const pct = max > 0 ? Math.min(value / max, 1) : 0
  const endX = cx - R * Math.cos(pct * Math.PI)
  const endY = cy - R * Math.sin(pct * Math.PI)
  const largeArc = pct > 0.5 ? 1 : 0
  return (
    <svg width={size} height={height}>
      <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 1 0 ${cx + R} ${cy}`} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={10} strokeLinecap="round" />
      {pct > 0.01 && <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 ${largeArc} 0 ${endX} ${endY}`} fill="none" stroke="#D7FF00" strokeWidth={10} strokeLinecap="round" />}
      <text x={cx} y={cy + 5} fill="#ffffff" fontSize="22" fontWeight="700" textAnchor="middle" fontFamily="'Space Grotesk', sans-serif">{value}</text>
      <text x={cx - R} y={cy + 18} fill="rgba(255,255,255,0.35)" fontSize="9" textAnchor="middle">0</text>
      <text x={cx + R} y={cy + 18} fill="rgba(255,255,255,0.35)" fontSize="9" textAnchor="middle">{max}</text>
    </svg>
  )
}

const cardStyle = { background: 'rgba(215,255,0,0.03)', border: '1px solid rgba(215,255,0,0.12)', borderRadius: 12 }
const chipStyle = (active: boolean) => ({ padding: '5px 14px', borderRadius: 6, border: active ? '1px solid rgba(215,255,0,0.6)' : '1px solid rgba(255,255,255,0.12)', background: active ? 'rgba(215,255,0,0.1)' : 'transparent', color: active ? '#D7FF00' : 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", transition: 'all 0.15s' })

type PerfTab = 'leads' | 'crm'

export default function PerformanceDashboard({
  calls,
  role,
  crmExport,
}: {
  calls: Call[]
  role: string
  crmExport?: CrmDataState
}) {
  const [activeTab, setActiveTab]             = useState<PerfTab>('leads')
  const [activeChip, setActiveChip]           = useState<string | null>(null)
  const [activeCampaign, setActiveCampaign]   = useState<string | null>(null)
  const [hiddenStages, setHiddenStages]       = useState<Set<string>>(new Set())
  const [stageDropdownOpen, setStageDropdownOpen] = useState(false)
  const [crmData, setCrmData]                 = useState<CrmDataState>(crmExport ?? null)

  // Called by CrmStatusChanges whenever data is parsed (drop, upload, or loaded from DB)
  function handleCrmDataChange(data: CrmRow[], dateFrom: string, dateTo: string) {
    setCrmData({ data, dateFrom, dateTo })
  }

  // Derive current stage per lead from CRM data (latest TO STATUS per ENTITY ID)
  const crmDerivedCalls = useMemo((): Call[] | null => {
    if (!crmData?.data?.length) return null

    const latest = new Map<string, { status: string; createdAt: number; changedBy: string }>()
    for (const row of crmData.data) {
      const entityId  = String(row['ENTITY ID'] ?? row['ENTITY_ID'] ?? row['entity_id'] ?? row['ID'] ?? '').trim()
      const toStatus  = String(row['TO STATUS']  ?? row['TO_STATUS']  ?? row['to_status']  ?? '').trim()
      const createdAt = new Date(String(row['CREATED AT'] ?? row['CREATED_AT'] ?? row['created_at'] ?? '')).getTime()
      const changedBy = String(row['CHANGED BY'] ?? row['CHANGED_BY'] ?? row['changed_by'] ?? '')

      if (!entityId || !toStatus) continue
      const existing = latest.get(entityId)
      if (!existing || (!isNaN(createdAt) && createdAt > existing.createdAt)) {
        latest.set(entityId, { status: toStatus, createdAt, changedBy })
      }
    }

    if (latest.size === 0 && crmData.data.length > 0) {
      console.log('[CRM debug] 0 leads derived — first row keys:', Object.keys(crmData.data[0]))
    }

    return [...latest.entries()].map(([entityId, { status, changedBy }]) => ({
      id:             entityId,
      client_name:    null,
      campaign:       null,
      stage:          CRM_STATUS_MAP[status.toLowerCase()] ?? status.toLowerCase(),
      stage_corrected:null,
      agent_stage:    null,
      uploaded_at:    crmData.dateFrom,
      agent_id:       changedBy,
      team_name:      null,
      agent_full_name:changedBy || null,
    }))
  }, [crmData])

  const isUsingCrm  = crmDerivedCalls !== null
  const effectiveCalls = isUsingCrm ? crmDerivedCalls! : calls

  const chips = useMemo(() => {
    if (role === 'agent') return []
    if (isUsingCrm) {
      const seen = new Map<string, string>()
      for (const c of crmDerivedCalls ?? []) {
        if (c.agent_id && !seen.has(c.agent_id) && !c.agent_id.toLowerCase().startsWith('omnia')) {
          seen.set(c.agent_id, c.agent_full_name ?? c.agent_id)
        }
      }
      return [...seen.entries()].map(([id, name]) => ({ key: id, label: name }))
    }
    if (role === 'team_leader') {
      const seen = new Map<string, string>()
      for (const c of calls) {
        if (c.agent_id && !seen.has(c.agent_id)) seen.set(c.agent_id, c.agent_full_name ?? c.agent_id)
      }
      return [...seen.entries()].map(([id, name]) => ({ key: id, label: name }))
    }
    const teams = [...new Set(calls.map(c => c.team_name).filter(Boolean))] as string[]
    return teams.map(t => ({ key: t, label: t }))
  }, [calls, role, isUsingCrm, crmDerivedCalls])

  const filtered = useMemo(() => {
    let result = effectiveCalls
    if (activeChip) {
      result = (isUsingCrm || role === 'team_leader')
        ? result.filter(c => c.agent_id === activeChip)
        : result.filter(c => c.team_name === activeChip)
    }
    if (!isUsingCrm && activeCampaign) result = result.filter(c => c.campaign === activeCampaign)
    return result
  }, [effectiveCalls, activeChip, activeCampaign, role, isUsingCrm])

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of filtered) {
      const s = effectiveStage(c)
      if (s) counts[s] = (counts[s] ?? 0) + 1
    }
    return counts
  }, [filtered])

  const total = filtered.length

  const metrics = useMemo(() => {
    const inStage = (stages: string[]) => stages.reduce((sum, s) => sum + (stageCounts[s] ?? 0), 0)
    const dropped            = inStage(DROPPED_STAGES)
    const totalActive        = total - dropped
    const atPotentialOrBeyond = inStage(['potential to close', 'meeting scheduled', 'meeting done', 'done deal'])
    const atMeetingOrBeyond  = inStage(['meeting scheduled', 'meeting done', 'done deal'])
    const atMeetingDoneOrDeal= inStage(['meeting done', 'done deal'])
    const atDoneDeal         = inStage(['done deal'])
    const lostLeads          = inStage(['not reachable'])
    const gapA = totalActive > 0        ? Math.round(atPotentialOrBeyond  / totalActive        * 100) : 0
    const gapB = atPotentialOrBeyond > 0 ? Math.round(atMeetingOrBeyond   / atPotentialOrBeyond * 100) : 0
    const gapC = atMeetingOrBeyond > 0  ? Math.round(atMeetingDoneOrDeal  / atMeetingOrBeyond  * 100) : 0
    const gapD = atMeetingDoneOrDeal > 0 ? Math.round(atDoneDeal          / atMeetingDoneOrDeal* 100) : 0

    const directToMeeting = isUsingCrm ? 0 : filtered.filter(c => {
      const agSt  = (c.agent_stage ?? '').toLowerCase()
      const effSt = effectiveStage(c)
      return ['meeting scheduled', 'meeting done'].includes(agSt) && ['meeting scheduled', 'meeting done'].includes(effSt)
    }).length

    return { gapA, gapB, gapC, gapD, directToMeeting, lostLeads, dropped }
  }, [stageCounts, total, filtered, isUsingCrm])

  const donutData = useMemo(() =>
    ALL_STAGES
      .filter(s => !hiddenStages.has(s) && (stageCounts[s] ?? 0) > 0)
      .map(s => ({
        name: s,
        value: stageCounts[s] ?? 0,
        color: STAGE_COLORS[s],
        pct: total > 0 ? ((stageCounts[s] ?? 0) / total * 100).toFixed(2) : '0',
      })),
    [stageCounts, hiddenStages, total]
  )

  const campaigns = useMemo(() =>
    isUsingCrm ? [] : [...new Set(calls.map(c => c.campaign).filter(Boolean))] as string[],
    [calls, isUsingCrm]
  )

  const lastUpdate = useMemo(() => {
    if (isUsingCrm && crmData) return `CRM export ${crmData.dateFrom} → ${crmData.dateTo}`
    const dates = filtered.map(c => c.uploaded_at).filter(Boolean)
    if (!dates.length) return null
    const latest = new Date(Math.max(...dates.map(d => new Date(d).getTime())))
    return latest.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }, [filtered, isUsingCrm, crmData])

  const toggleStage = (stage: string) => setHiddenStages(prev => { const next = new Set(prev); next.has(stage) ? next.delete(stage) : next.add(stage); return next })

  const kpiCards = [
    { label: 'GAP(A)%',        value: `${metrics.gapA}%`, note: 'Interested → beyond' },
    { label: 'GAP(B)%',        value: `${metrics.gapB}%`, note: 'Potential → Meeting' },
    { label: 'GAP(C)%',        value: `${metrics.gapC}%`, note: 'Meeting Sched → Done' },
    { label: 'GAP(D)%',        value: `${metrics.gapD}%`, note: 'Done → Closed Deal' },
    { label: 'Direct to Meeting', value: String(metrics.directToMeeting), note: 'no prior follow-up' },
  ]

  const tabs: { key: PerfTab; label: string }[] = [
    { key: 'leads', label: 'Leads Over Stages' },
    ...(role === 'super_admin' ? [{ key: 'crm' as PerfTab, label: 'Status Changes' }] : []),
  ]

  return (
    <div style={{ color: '#fff', fontFamily: "'Montserrat', sans-serif" }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{ padding: '11px 28px', borderRadius: '8px 8px 0 0', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', background: activeTab === key ? 'rgba(215,255,0,0.08)' : 'transparent', color: activeTab === key ? '#D7FF00' : 'rgba(255,255,255,0.4)', borderBottom: activeTab === key ? '2px solid #D7FF00' : '2px solid transparent', transition: 'all 0.15s', fontFamily: "'Montserrat', sans-serif" }}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'crm' && (
        <CrmStatusChanges onDataChange={handleCrmDataChange} />
      )}

      {activeTab === 'leads' && <>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Leads Over Stages <span style={{ color: '#D7FF00' }}>Report</span>
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isUsingCrm && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#4A90D9', textTransform: 'uppercase', letterSpacing: '0.08em', background: 'rgba(74,144,217,0.1)', border: '1px solid rgba(74,144,217,0.3)', borderRadius: 6, padding: '3px 10px' }}>
                From CRM Export
              </span>
            )}
            {lastUpdate && (
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                {isUsingCrm ? lastUpdate : `Last Update: ${lastUpdate}`}
              </span>
            )}
          </div>
        </div>

        {/* Chips row */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5" style={{ borderBottom: '1px solid rgba(215,255,0,0.08)', paddingBottom: 16 }}>
            <button style={chipStyle(activeChip === null)} onClick={() => setActiveChip(null)}>All</button>
            {chips.map(({ key, label }) => (
              <button key={key} style={chipStyle(activeChip === key)} onClick={() => setActiveChip(activeChip === key ? null : key)}>{label}</button>
            ))}
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
          {kpiCards.map(({ label, value, note }) => (
            <div key={label} style={{ ...cardStyle, padding: '14px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>{label}</p>
              <p style={{ fontSize: label === 'Direct to Meeting' ? 32 : 28, fontWeight: 700, color: label === 'Direct to Meeting' ? '#fff' : '#D7FF00', lineHeight: 1, fontFamily: "'Space Grotesk', sans-serif" }}>{value}</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 5 }}>{note}</p>
            </div>
          ))}
        </div>

        {/* Main 3-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 260px', gap: 16 }}>
          {/* Left: Lost Leads */}
          <div style={{ ...cardStyle, padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 1.3 }}>Lost<br />Leads</p>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', minHeight: 140 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{metrics.lostLeads}</span>
              <div style={{ width: 26, height: total > 0 && metrics.lostLeads > 0 ? Math.max(Math.round(metrics.lostLeads / total * 130), 8) : 0, background: '#d32f2f', borderRadius: '3px 3px 0 0' }} />
            </div>
            <div style={{ width: 26, height: 2, background: 'rgba(255,255,255,0.15)', borderRadius: 1 }} />
          </div>

          {/* Center: Donut chart */}
          <div style={{ ...cardStyle, padding: '18px 20px' }}>
            <div className="flex items-center justify-between mb-3">
              <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: "'Space Grotesk', sans-serif" }}>Total Number of Stages</p>
              <div style={{ position: 'relative' }}>
                <button onClick={() => setStageDropdownOpen(o => !o)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(215,255,0,0.25)', background: 'rgba(215,255,0,0.05)', color: '#D7FF00', fontSize: 11, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                  Filter by Stages ▾
                </button>
                {stageDropdownOpen && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setStageDropdownOpen(false)} />
                    <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 6, background: '#0e0e0e', border: '1px solid rgba(215,255,0,0.2)', borderRadius: 10, padding: '8px 4px', zIndex: 50, minWidth: 190, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
                      {ALL_STAGES.map(stage => (
                        <label key={stage} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', cursor: 'pointer', borderRadius: 6 }}>
                          <input type="checkbox" checked={!hiddenStages.has(stage)} onChange={() => toggleStage(stage)} style={{ accentColor: '#D7FF00', width: 13, height: 13 }} />
                          <span style={{ width: 10, height: 10, borderRadius: 2, background: STAGE_COLORS[stage], display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{STAGE_LABELS[stage] ?? stage}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Legend pills */}
            <div className="flex flex-wrap gap-2 mb-4">
              {donutData.map(d => (
                <span key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, display: 'inline-block', flexShrink: 0 }} />
                  {STAGE_LABELS[d.name] ?? d.name}
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <PieChart width={340} height={340}>
                  <Pie
                    data={donutData.length > 0 ? donutData : [{ name: 'empty', value: 1, color: 'rgba(255,255,255,0.06)', pct: '0' }]}
                    cx={170} cy={170} innerRadius={90} outerRadius={128} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}
                    label={donutData.length > 0 ? CustomDonutLabel : undefined}
                    labelLine={donutData.length > 0 ? { stroke: 'rgba(255,255,255,0.18)', strokeWidth: 1 } : false}
                  >
                    {(donutData.length > 0 ? donutData : [{ color: 'rgba(255,255,255,0.06)' }]).map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  {donutData.length > 0 && (
                    <Tooltip
                      contentStyle={{ background: '#111', border: '1px solid rgba(215,255,0,0.2)', borderRadius: 8, fontSize: 12, color: '#fff' }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any, name: any) => [`${value} (${donutData.find((d: { name: string }) => d.name === name)?.pct ?? 0}%)`, STAGE_LABELS[name] ?? name]}
                    />
                  )}
                </PieChart>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: 36, fontWeight: 700, color: '#fff', fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>{total}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>
                    {isUsingCrm ? 'unique leads' : 'total leads'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Leads Dropped */}
          <div style={{ ...cardStyle, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: "'Space Grotesk', sans-serif" }}>Leads Dropped</p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Gauge value={metrics.dropped} max={total} />
            </div>
            {campaigns.length > 0 && (
              <div style={{ borderTop: '1px solid rgba(215,255,0,0.08)', paddingTop: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
                  {campaigns.map(camp => (
                    <button key={camp} onClick={() => setActiveCampaign(activeCampaign === camp ? null : camp)}
                      style={{ padding: '10px 8px', borderRadius: 8, border: activeCampaign === camp ? '1px solid rgba(215,255,0,0.6)' : '1px solid rgba(255,255,255,0.09)', background: activeCampaign === camp ? 'rgba(215,255,0,0.08)' : 'rgba(255,255,255,0.02)', color: activeCampaign === camp ? '#D7FF00' : 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, cursor: 'pointer', textAlign: 'left', lineHeight: 1.35, transition: 'all 0.15s' }}>
                      {camp}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {total === 0 && (
          <div style={{ marginTop: 32, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14, padding: '40px 0' }}>
            {isUsingCrm ? 'No leads found in the CRM export.' : 'No processed calls found. Upload calls or drop a CRM export in the Status Changes tab.'}
          </div>
        )}
      </>}
    </div>
  )
}
