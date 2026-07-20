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

// Parse a date string → YYYY-MM-DD. Returns null for unparseable or bad-year values.
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

// Returns the effective report date for a CSV row.
// Uses التاريخ (col 2) when valid; falls back to the submission timestamp (col 0)
// when the agent entered a bad year (e.g. Shabaan's recurring "0026"/"0027" typo).
function getEffectiveDate(r: string[]): string | null {
  return extractDateStr(r[2]) ?? extractDateStr(r[0].split(' ')[0])
}

// Map a raw CSV row (26 cols) → the 23-col format buildReport expects.
//
// CSV layout:
//   0  timestamp          → keep
//   1  name               → keep
//   2  date (التاريخ)     → keep
//   3  sheets             → int
//   4  posts              → int
//   5  requests           → int
//   6  followups          → int
//   7  totalLeads         → int
//   8  reached            → int
//   9  notReached         → int
//   10 crmAct             → int
//   11 uploaded           → int
//   12 notUploaded        → int
//   13 CRM confirm text   → SKIP
//   14 missed yes/no      → SKIP
//   15 m1 name            → keep
//   16 m1 phone           → keep
//   17 m1 reason          → keep
//   18 m2 name            → keep
//   19 m2 phone           → keep
//   20 m2 reason          → keep
//   21 m3 name            → keep
//   22 m3 phone           → keep
//   23 m3 reason          → keep
//   24 summary            → keep (this is ملخص اليوم)
//   25 unused             → SKIP
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
    r[24] ?? '',  // summary (col 24, skipping CRM-confirm col13 + missed-yn col14)
    r[15] ?? '', r[16] ?? '', r[17] ?? '',  // missed call 1
    r[18] ?? '', r[19] ?? '', r[20] ?? '',  // missed call 2
    r[21] ?? '', r[22] ?? '', r[23] ?? '',  // missed call 3
  ]
}

function buildReport(dateStr: string, rows: unknown[][]) {
  const latest: Record<string, { ts: number; r: unknown[] }> = {}
  for (const r of rows) {
    const ts = new Date(r[0] as string).getTime()
    const name = r[1] as string
    if (!latest[name] || ts > latest[name].ts) latest[name] = { ts, r }
  }
  const unique = Object.values(latest).map(v => v.r)
  const submittedNames = new Set(unique.map(r => r[1] as string))
  const missingAgents = ALL_AGENTS.filter(a => !submittedNames.has(a))

  const dateObj = new Date(dateStr + 'T00:00:00')
  const formattedDate = dateObj.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })

  let agentRows = ''
  for (const r of unique) {
    const [
      _ts, name, _date,
      sheets, posts, requests, followups, totalLeads, reached, notReached,
      crmAct, uploaded, notUploaded, summary,
      ...missedRaw
    ] = r as [string, string, string, number, number, number, number, number, number, number, number, number, number, string, ...string[]]

    const postsOk = posts >= 5
      ? '<span class="badge-ok">&#10003;</span>'
      : '<span class="badge-warn">!</span>'
    const uplOk = notUploaded > 0
      ? '<span class="badge-warn">!</span>'
      : '<span class="badge-ok">&#10003;</span>'

    let missedHTML = ''
    if (notUploaded > 0 && missedRaw.length >= 3) {
      let list = ''
      for (let i = 0; i + 2 < missedRaw.length; i += 3) {
        const mn = missedRaw[i], mp = missedRaw[i + 1], mr = missedRaw[i + 2]
        if (mn && mn.trim()) {
          list += `<li><strong>${mn}</strong> &mdash; ${mp || 'N/A'}<br><span class="miss-reason">Reason: ${mr || 'Not specified'}</span></li>`
        }
      }
      if (list) missedHTML = `<div class="missed-calls"><p class="missed-title">&#9888; Missed Uploads (${notUploaded})</p><ul>${list}</ul></div>`
    }

    agentRows += `<div class="card agent-card">
      <div class="agent-header"><span class="agent-name">${name}</span></div>
      <div class="stats-grid">
        <div class="stat-box"><div class="stat-lbl">Cold Call Sheets</div><div class="stat-val">${sheets}</div></div>
        <div class="stat-box"><div class="stat-lbl">Organic Posts ${postsOk}</div><div class="stat-val">${posts}</div></div>
        <div class="stat-box"><div class="stat-lbl">New Requests</div><div class="stat-val">${requests}</div></div>
        <div class="stat-box"><div class="stat-lbl">Follow-Ups</div><div class="stat-val">${followups}</div></div>
        <div class="stat-box"><div class="stat-lbl">Total New Leads</div><div class="stat-val">${totalLeads}</div></div>
        <div class="stat-box"><div class="stat-lbl">Reached</div><div class="stat-val">${reached}</div></div>
        <div class="stat-box"><div class="stat-lbl">Not Reached</div><div class="stat-val">${notReached}</div></div>
        <div class="stat-box"><div class="stat-lbl">CRM Activities</div><div class="stat-val">${crmAct}</div></div>
        <div class="stat-box"><div class="stat-lbl">Calls Uploaded ${uplOk}</div><div class="stat-val">${uploaded}</div></div>
        <div class="stat-box"><div class="stat-lbl">Not Uploaded</div><div class="stat-val" style="color:${notUploaded > 0 ? '#ff4444' : 'inherit'}">${notUploaded}</div></div>
        <div class="stat-box"><div class="stat-lbl">CRM Updated <span class="badge-ok">&#10003;</span></div><div class="stat-val">Yes</div></div>
      </div>
      ${missedHTML}
      <div class="summary-box"><p class="summary-lbl">&#128221; Daily Summary</p><p class="summary-text">${summary}</p></div>
    </div>`
  }

  const missingHTML = missingAgents.length > 0
    ? `<div class="card missing-section"><p class="missing-title">&#10007; Did Not Submit Today (${missingAgents.length})</p><ul>${missingAgents.map(a => `<li>${a}</li>`).join('')}</ul></div>`
    : ''

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Montserrat', Arial, sans-serif; background: #080808; color: #ffffff; padding: 28px; }
.header { background: #0f0f0f; border: 1px solid rgba(215,255,0,0.18); border-radius: 14px; padding: 28px 32px; margin-bottom: 22px; text-align: center; }
.header h1 { font-size: 22px; font-weight: 800; color: #D7FF00; letter-spacing: 0.5px; }
.header p { font-size: 13px; color: rgba(255,255,255,0.5); margin-top: 6px; }
.banner { display: flex; gap: 12px; margin-bottom: 22px; }
.banner-box { flex: 1; background: #111111; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 16px; text-align: center; }
.banner-box .num { font-size: 32px; font-weight: 800; color: #D7FF00; }
.banner-box .lbl { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
.card { background: #111111; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 20px; margin-bottom: 18px; }
.agent-card { }
.agent-header { display: flex; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.07); }
.agent-name { font-size: 16px; font-weight: 700; color: #ffffff; }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
.stat-box { background: #191919; border-radius: 8px; padding: 12px 8px; text-align: center; border: 1px solid rgba(255,255,255,0.04); }
.stat-lbl { font-size: 9px; color: rgba(255,255,255,0.4); margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.4px; }
.stat-val { font-size: 22px; font-weight: 800; color: #ffffff; }
.badge-ok   { display: inline-block; width: 14px; height: 14px; background: rgba(215,255,0,0.15); color: #D7FF00; border-radius: 50%; font-size: 9px; line-height: 14px; text-align: center; font-weight: 700; }
.badge-warn { display: inline-block; width: 14px; height: 14px; background: rgba(255,68,68,0.15); color: #ff6b6b; border-radius: 50%; font-size: 9px; line-height: 14px; text-align: center; font-weight: 700; }
.missed-calls { background: rgba(255,68,68,0.06); border-left: 3px solid #ff4444; border-radius: 6px; padding: 12px 16px; margin-bottom: 14px; }
.missed-title { font-weight: 700; color: #ff6b6b; font-size: 13px; margin-bottom: 8px; }
.missed-calls ul { padding-left: 18px; }
.missed-calls li { margin-bottom: 6px; font-size: 12px; color: rgba(255,255,255,0.8); }
.miss-reason { color: #ff6b6b; }
.summary-box { background: #191919; border-radius: 8px; padding: 14px; border: 1px solid rgba(255,255,255,0.04); }
.summary-lbl { font-weight: 700; font-size: 12px; margin-bottom: 6px; color: #D7FF00; }
.summary-text { font-size: 12px; line-height: 1.7; color: rgba(255,255,255,0.75); }
.missing-section { }
.missing-title { font-weight: 700; font-size: 14px; color: #ff6b6b; margin-bottom: 10px; }
.missing-section ul { padding-left: 20px; }
.missing-section li { margin-bottom: 4px; font-size: 13px; color: rgba(255,255,255,0.7); }
.footer { text-align: center; font-size: 10px; color: rgba(255,255,255,0.2); margin-top: 28px; }
</style>
</head>
<body>
<div class="header"><h1>&#128203; Daily Sales Report &mdash; The Gemini Lab</h1><p>${formattedDate}</p></div>
<div class="banner">
  <div class="banner-box"><div class="num">${unique.length}</div><div class="lbl">Submitted</div></div>
  <div class="banner-box"><div class="num" style="color:${missingAgents.length > 0 ? '#ff4444' : '#D7FF00'}">${missingAgents.length}</div><div class="lbl">Missing</div></div>
  <div class="banner-box"><div class="num">${ALL_AGENTS.length}</div><div class="lbl">Total Agents</div></div>
</div>
${missingHTML}
${agentRows || '<p style="text-align:center;color:rgba(255,255,255,0.3);padding:40px">No submissions received today.</p>'}
<div class="footer">Generated automatically &mdash; The Gemini Lab Sales System</div>
</body>
</html>`

  return { html, submittedCount: unique.length, missingAgents }
}

// GET /api/cron/daily-report
// Vercel Cron fires this daily at 11:55 PM Cairo time (21:55 UTC).
// Reads today's Google Form submissions directly from the sheet CSV,
// builds the HTML report, and upserts it into the reports table.
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

  const rows = parseCSV(csvText).slice(1) // drop header row

  // ?date=YYYY-MM-DD overrides the default (today in Cairo UTC+2)
  const url = new URL(req.url)
  const dateParam = url.searchParams.get('date')
  let targetDate: string
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    targetDate = dateParam
  } else {
    const cairoNow = new Date(Date.now() + 2 * 60 * 60 * 1000)
    targetDate = `${cairoNow.getUTCFullYear()}-${pad(cairoNow.getUTCMonth() + 1)}-${pad(cairoNow.getUTCDate())}`
  }

  const targetRows = rows
    .filter(r => r.length > 2 && getEffectiveDate(r) === targetDate)
    .map(csvToRow)

  if (targetRows.length === 0) {
    return NextResponse.json({ message: 'No submissions for this date', date: targetDate })
  }

  const { html, submittedCount, missingAgents } = buildReport(targetDate, targetRows)

  const admin = createAdminClient()
  const { error } = await admin.from('reports').upsert(
    {
      company_id: COMPANY_ID,
      type: 'daily',
      report_date: targetDate,
      week_number: null,
      data: { html, submittedCount, missingAgents },
    },
    { onConflict: 'company_id,type,report_date' }
  )

  if (error) {
    console.error('daily-report cron upsert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, date: targetDate, submittedCount, missing: missingAgents.length })
}
