import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SHEET_ID = '1VkX4fDmV-jP8RDotUUX66QntZy760EdFixiOyXqXnk0'
const SHEET_GID = '858376122'
const COMPANY_ID = '99128fef-60d3-44d9-b213-d7909a3a7499'
const ALL_AGENTS = [
  'Mariam Ahmed', 'Mohamed Sayed', 'Nourhan Ayman',
  'Fady Fawzy', 'Mohamed Shabaan',
  'Yasmine', 'Hadeer', 'Shahd', 'Amira',
]
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function pad(n: number) { return String(n).padStart(2, '0') }
function int(s: string) { return parseInt(s, 10) || 0 }

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  for (const line of lines) {
    if (!line.trim()) continue
    rows.push(parseCSVLine(line))
  }
  return rows
}

function parseCSVLine(line: string): string[] {
  const cells: string[] = []
  let i = 0
  while (i <= line.length) {
    if (i === line.length) { cells.push(''); break }
    if (line[i] === '"') {
      i++
      let cell = ''
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { cell += '"'; i += 2 }
        else if (line[i] === '"') { i++; break }
        else { cell += line[i++] }
      }
      cells.push(cell)
      if (line[i] === ',') i++
    } else {
      const end = line.indexOf(',', i)
      if (end === -1) { cells.push(line.slice(i)); break }
      cells.push(line.slice(i, end))
      i = end + 1
    }
  }
  return cells
}

function extractDateStr(raw: string): string | null {
  const s = raw.trim()
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (us) {
    const y = parseInt(us[3])
    if (y < 2000 || y > 2100) return null
    return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`
  }
  return null
}

function csvToRow(r: string[]): unknown[] {
  return [
    r[0]  ?? '',  // timestamp
    r[1]  ?? '',  // name
    r[2]  ?? '',  // date
    int(r[3]),    // sheets
    int(r[4]),    // posts
    int(r[5]),    // requests
    int(r[6]),    // followups
    int(r[7]),    // totalLeads
    int(r[8]),    // reached
    int(r[9]),    // notReached
    int(r[10]),   // crmAct
    int(r[11]),   // uploaded
    int(r[12]),   // notUploaded
  ]
}

interface AgentStats {
  sheets: number; posts: number; requests: number; followups: number
  totalLeads: number; reached: number; notReached: number
  crmAct: number; uploaded: number; notUploaded: number
  submittedDays: Set<string>; score: number
}

export function buildWeeklyReport(
  thursdayStr: string,
  weekDates: string[],
  rows: unknown[][],
  todayStr: string,
) {
  // Deduplicate: keep latest submission per agent per day
  const latestPerDay = new Map<string, { ts: number; r: unknown[] }>()
  for (const r of rows) {
    const ts = new Date(r[0] as string).getTime()
    const name = r[1] as string
    const dateKey = extractDateStr(r[2] as string)
    if (!dateKey) continue
    const key = `${name}__${dateKey}`
    const existing = latestPerDay.get(key)
    if (!existing || ts > existing.ts) latestPerDay.set(key, { ts, r })
  }

  const deduped = Array.from(latestPerDay.values()).map(v => v.r)

  // Per-agent aggregation
  const stats: Record<string, AgentStats> = {}
  for (const agent of ALL_AGENTS) {
    stats[agent] = {
      sheets: 0, posts: 0, requests: 0, followups: 0,
      totalLeads: 0, reached: 0, notReached: 0,
      crmAct: 0, uploaded: 0, notUploaded: 0,
      submittedDays: new Set(), score: 0,
    }
  }

  for (const r of deduped) {
    const name = r[1] as string
    const s = stats[name]
    if (!s) continue
    const dateKey = extractDateStr(r[2] as string)
    if (dateKey) s.submittedDays.add(dateKey)
    s.sheets      += r[3]  as number
    s.posts       += r[4]  as number
    s.requests    += r[5]  as number
    s.followups   += r[6]  as number
    s.totalLeads  += r[7]  as number
    s.reached     += r[8]  as number
    s.notReached  += r[9]  as number
    s.crmAct      += r[10] as number
    s.uploaded    += r[11] as number
    s.notUploaded += r[12] as number
  }

  for (const agent of ALL_AGENTS) {
    const s = stats[agent]
    s.score = s.sheets + s.totalLeads + s.requests + s.followups
  }

  // Top performer
  let topAgent = ''
  let topScore = 0
  for (const agent of ALL_AGENTS) {
    if (stats[agent].score > topScore) { topScore = stats[agent].score; topAgent = agent }
  }

  // Sorted agents
  const sorted = [...ALL_AGENTS].sort((a, b) => stats[b].score - stats[a].score)

  // Agents who submitted at least one day vs. didn't submit at all
  const submittedAgents = ALL_AGENTS.filter(a => stats[a].submittedDays.size > 0)
  const missingAgents   = ALL_AGENTS.filter(a => stats[a].submittedDays.size === 0)

  // Attendance chips: perfect = submitted every required day (with grace for today)
  const perfect = ALL_AGENTS.filter(a => {
    const missed = weekDates.filter(d => !stats[a].submittedDays.has(d) && d !== todayStr)
    return missed.length === 0
  })
  const missed = ALL_AGENTS.filter(a => !perfect.includes(a))

  // Week label
  function fmtDay(key: string, withYear = false) {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC',
    })
  }
  const weekLabel = `${fmtDay(weekDates[0])} – ${fmtDay(thursdayStr, true)}`

  // Team totals
  let tSheets = 0, tPosts = 0, tRequests = 0, tFollowups = 0
  let tLeads = 0, tReached = 0, tCrm = 0, tNotUpl = 0
  for (const a of ALL_AGENTS) {
    const s = stats[a]
    tSheets    += s.sheets;    tPosts     += s.posts;    tRequests  += s.requests
    tFollowups += s.followups; tLeads     += s.totalLeads; tReached += s.reached
    tCrm       += s.crmAct;   tNotUpl    += s.notUploaded
  }

  // Agent cards
  let agentRows = ''
  for (const agent of sorted) {
    const s = stats[agent]
    const isTop = agent === topAgent && topScore > 0
    const missedDays = weekDates.filter(d => !s.submittedDays.has(d))
    const missedLabels = missedDays.map(d => DAY_NAMES[new Date(d + 'T00:00:00Z').getUTCDay()])
    const onlyMissingToday = missedDays.length === 1 && missedDays[0] === todayStr

    let attendanceHTML: string
    if (missedDays.length === 0) {
      attendanceHTML = `<div class="att-line ok-line">&#10003; Submitted all required days</div>`
    } else if (onlyMissingToday) {
      attendanceHTML = `<div class="att-line pend-line">&#9203; Pending today's submission (Thursday)</div>`
    } else {
      attendanceHTML = `<div class="att-line miss-line">&#10007; Missing: <strong>${missedLabels.join(', ')}</strong></div>`
    }

    const postStatus = s.posts >= 25
      ? '<span class="badge-ok">&#10003;</span>'
      : '<span class="badge-warn">!</span>'
    const uplStatus = s.notUploaded > 0
      ? '<span class="badge-warn">!</span>'
      : '<span class="badge-ok">&#10003;</span>'
    const topBadge = isTop ? `<span class="top-badge">&#127942; Top Performer</span>` : ''

    agentRows += `<div class="card agent-card${isTop ? ' top-card' : ''}">
      <div class="agent-header">
        <span class="agent-name">${agent}</span>
        ${topBadge}
      </div>
      <div class="days-line">&#128197; Days submitted: <strong class="accent">${s.submittedDays.size}/5</strong></div>
      ${attendanceHTML}
      <div class="stats-grid">
        <div class="stat-box"><div class="stat-lbl">Cold Call Sheets</div><div class="stat-val">${s.sheets}</div></div>
        <div class="stat-box"><div class="stat-lbl">Organic Posts ${postStatus}</div><div class="stat-val">${s.posts}</div></div>
        <div class="stat-box"><div class="stat-lbl">New Requests</div><div class="stat-val">${s.requests}</div></div>
        <div class="stat-box"><div class="stat-lbl">Follow-Ups</div><div class="stat-val">${s.followups}</div></div>
        <div class="stat-box"><div class="stat-lbl">Total New Leads</div><div class="stat-val">${s.totalLeads}</div></div>
        <div class="stat-box"><div class="stat-lbl">Reached</div><div class="stat-val">${s.reached}</div></div>
        <div class="stat-box"><div class="stat-lbl">Not Reached</div><div class="stat-val">${s.notReached}</div></div>
        <div class="stat-box"><div class="stat-lbl">CRM Activities</div><div class="stat-val">${s.crmAct}</div></div>
        <div class="stat-box"><div class="stat-lbl">Calls Uploaded ${uplStatus}</div><div class="stat-val">${s.uploaded}</div></div>
        <div class="stat-box"><div class="stat-lbl">Not Uploaded</div><div class="stat-val" style="color:${s.notUploaded > 0 ? '#ff4444' : 'inherit'}">${s.notUploaded}</div></div>
      </div>
    </div>`
  }

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Montserrat', Arial, sans-serif; background: #080808; color: #ffffff; padding: 28px; }
.accent { color: #D7FF00; }
.header { background: #0f0f0f; border: 1px solid rgba(215,255,0,0.18); border-radius: 14px; padding: 28px 32px; margin-bottom: 22px; text-align: center; }
.header h1 { font-size: 22px; font-weight: 800; color: #D7FF00; letter-spacing: 0.5px; }
.header p { font-size: 13px; color: rgba(255,255,255,0.5); margin-top: 6px; }
.card { background: #111111; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 20px; margin-bottom: 18px; }
.section-title { font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px; }
.team-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.team-stat { background: #191919; border-radius: 8px; padding: 14px 10px; text-align: center; border: 1px solid rgba(255,255,255,0.04); }
.team-stat .lbl { font-size: 10px; color: rgba(255,255,255,0.4); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
.team-stat .val { font-size: 26px; font-weight: 800; color: #D7FF00; }
.att-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.chip { padding: 5px 13px; border-radius: 20px; font-size: 11px; font-weight: 700; }
.chip-ok   { background: rgba(215,255,0,0.1);  color: #D7FF00;  border: 1px solid rgba(215,255,0,0.25); }
.chip-miss { background: rgba(255,68,68,0.1);  color: #ff6b6b;  border: 1px solid rgba(255,68,68,0.25); }
.agent-card { }
.top-card { border-color: rgba(215,255,0,0.35); }
.agent-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.07); }
.agent-name { font-size: 16px; font-weight: 700; color: #ffffff; }
.top-badge { background: rgba(215,255,0,0.12); color: #D7FF00; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(215,255,0,0.3); }
.days-line { font-size: 12px; color: rgba(255,255,255,0.5); margin-bottom: 5px; }
.att-line { font-size: 12px; margin-bottom: 13px; }
.ok-line   { color: #D7FF00; }
.pend-line { color: #ffcc44; }
.miss-line { color: #ff6b6b; }
.stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.stat-box { background: #191919; border-radius: 8px; padding: 10px 8px; text-align: center; border: 1px solid rgba(255,255,255,0.04); }
.stat-lbl { font-size: 9px; color: rgba(255,255,255,0.4); margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.4px; }
.stat-val { font-size: 20px; font-weight: 800; color: #ffffff; }
.badge-ok   { display: inline-block; width: 14px; height: 14px; background: rgba(215,255,0,0.15); color: #D7FF00; border-radius: 50%; font-size: 9px; line-height: 14px; text-align: center; font-weight: 700; }
.badge-warn { display: inline-block; width: 14px; height: 14px; background: rgba(255,68,68,0.15); color: #ff6b6b; border-radius: 50%; font-size: 9px; line-height: 14px; text-align: center; font-weight: 700; }
.footer { text-align: center; font-size: 10px; color: rgba(255,255,255,0.2); margin-top: 28px; }
</style>
</head>
<body>

<div class="header">
  <h1>&#128202; Weekly Sales Report &mdash; The Gemini Lab</h1>
  <p>Week of ${weekLabel}</p>
</div>

<div class="card">
  <div class="section-title">&#127970; Team Totals This Week</div>
  <div class="team-grid">
    <div class="team-stat"><div class="lbl">Cold Call Sheets</div><div class="val">${tSheets}</div></div>
    <div class="team-stat"><div class="lbl">Organic Posts</div><div class="val">${tPosts}</div></div>
    <div class="team-stat"><div class="lbl">New Requests</div><div class="val">${tRequests}</div></div>
    <div class="team-stat"><div class="lbl">Follow-Ups</div><div class="val">${tFollowups}</div></div>
    <div class="team-stat"><div class="lbl">Total New Leads</div><div class="val">${tLeads}</div></div>
    <div class="team-stat"><div class="lbl">Reached</div><div class="val">${tReached}</div></div>
    <div class="team-stat"><div class="lbl">CRM Activities</div><div class="val">${tCrm}</div></div>
    <div class="team-stat"><div class="lbl">Missed Uploads</div><div class="val" style="color:${tNotUpl > 0 ? '#ff4444' : '#D7FF00'}">${tNotUpl}</div></div>
  </div>
</div>

<div class="card">
  <div class="section-title">&#128197; Weekly Attendance</div>
  <div class="att-chips">
    ${perfect.map(a => `<span class="chip chip-ok">${a} &#10003;</span>`).join('')}
    ${missed.map(a => `<span class="chip chip-miss">${a} &#10007;</span>`).join('')}
  </div>
</div>

${agentRows}

<div class="footer">Generated automatically &mdash; The Gemini Lab Sales System</div>
</body>
</html>`

  return { html, weekLabel, topAgent, perfectCount: perfect.length, missedAgents: missed }
}

// week_number 1–4: which group-of-7 the Thursday falls in (capped at 4 for 5-Thursday months).
function weekNumberFromThursday(thursdayDayOfMonth: number): number {
  return Math.min(4, Math.ceil(thursdayDayOfMonth / 7))
}

// GET /api/cron/weekly-report
// Vercel Cron fires every Thursday at 11:30 PM Cairo time (21:30 UTC).
// Aggregates Sun–Thu submissions from the sheet and upserts a weekly report.
export async function GET(req: Request) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`
  const csvRes = await fetch(csvUrl)
  if (!csvRes.ok) {
    return NextResponse.json({ error: 'Sheet fetch failed', status: csvRes.status }, { status: 500 })
  }
  const csvText = await csvRes.text()
  const allRows = parseCSV(csvText).slice(1)

  // ?thursday=YYYY-MM-DD overrides the default (today in Cairo UTC+2) — used to regenerate past weeks
  const url = new URL(req.url)
  const thursdayParam = url.searchParams.get('thursday')
  let thursdayStr: string
  if (thursdayParam && /^\d{4}-\d{2}-\d{2}$/.test(thursdayParam)) {
    thursdayStr = thursdayParam
  } else {
    const now = new Date()
    const cairoNow = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    thursdayStr = `${cairoNow.getUTCFullYear()}-${pad(cairoNow.getUTCMonth() + 1)}-${pad(cairoNow.getUTCDate())}`
  }

  // Build Sun–Thu date set (Thursday − 4 days = Sunday)
  const [ty, tm, td] = thursdayStr.split('-').map(Number)
  const thursdayUTC = Date.UTC(ty, tm - 1, td)
  const weekDates: string[] = []
  for (let i = 4; i >= 0; i--) {
    const d = new Date(thursdayUTC - i * 86400000)
    weekDates.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`)
  }
  const weekSet = new Set(weekDates)

  // Filter rows for this week
  const weekRows = allRows
    .filter(r => r.length > 2 && weekSet.has(extractDateStr(r[2]) ?? ''))
    .map(csvToRow)

  if (weekRows.length === 0) {
    return NextResponse.json({ message: 'No submissions this week', week: weekDates })
  }

  const { html, weekLabel, topAgent, perfectCount, missedAgents } = buildWeeklyReport(
    thursdayStr, weekDates, weekRows, thursdayStr,
  )

  const weekNumber = weekNumberFromThursday(td)

  const admin = createAdminClient()
  const { error } = await admin.from('reports').upsert(
    {
      company_id: COMPANY_ID,
      type: 'weekly',
      report_date: thursdayStr,
      week_number: weekNumber,
      data: { html, weekLabel, topAgent, perfectCount, missedAgents },
    },
    { onConflict: 'company_id,type,report_date' },
  )

  if (error) {
    console.error('weekly-report cron upsert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, week: weekDates, weekLabel, topAgent, perfectCount, missing: missedAgents.length })
}
