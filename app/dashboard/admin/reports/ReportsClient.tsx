'use client'

import { useState, useMemo } from 'react'
import type { Report } from './page'
import CrmStatusChanges from './CrmStatusChanges'

interface Props {
  reports: Report[]
}

type ReportTab = 'daily' | 'weekly' | 'monthly' | 'crm'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function formatDateLabel(report: Report): string {
  if (report.type === 'daily') return report.report_date
  if (report.type === 'weekly') {
    const [y, m] = report.report_date.split('-')
    return `Week ${report.week_number} — ${MONTH_NAMES[parseInt(m) - 1]} ${y}`
  }
  const [y, m] = report.report_date.split('-')
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`
}

// ── Generic report data renderer ──────────────────────────────────────────────

function ReportDataView({ data, depth = 0 }: { data: Record<string, unknown>; depth?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {Object.entries(data).map(([key, value]) => {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          return (
            <div key={key} style={{ marginTop: depth === 0 ? 16 : 8 }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#D7FF00',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 6,
                paddingLeft: depth * 16,
              }}>
                {label}
              </div>
              <div style={{
                paddingLeft: depth * 16 + 12,
                borderLeft: '1px solid rgba(215,255,0,0.15)',
                marginLeft: depth * 16,
              }}>
                <ReportDataView data={value as Record<string, unknown>} depth={depth + 1} />
              </div>
            </div>
          )
        }

        if (Array.isArray(value)) {
          return (
            <div key={key} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              padding: '8px 0',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              paddingLeft: depth * 16,
            }}>
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>{label}</span>
              <span style={{ color: '#fff', fontSize: 13, textAlign: 'right', maxWidth: '60%' }}>
                {value.length === 0 ? '—' : value.map(String).join(', ')}
              </span>
            </div>
          )
        }

        const displayValue = value === null || value === undefined ? '—' : String(value)
        const isNumber = typeof value === 'number'

        return (
          <div key={key} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 0',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            paddingLeft: depth * 16,
          }}>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>{label}</span>
            <span style={{
              color: isNumber ? '#D7FF00' : '#fff',
              fontSize: 13,
              fontWeight: isNumber ? 700 : 400,
              textAlign: 'right',
            }}>
              {isNumber ? Number(value).toLocaleString() : displayValue}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Calendar ──────────────────────────────────────────────────────────────────

function Calendar({
  calendarMonth,
  onPrev,
  onNext,
  onDayClick,
  onMonthClick,
  onWeekClick,
  dailyReportMap,
  monthlyReportMap,
  weeklyReportMap,
  selectedReport,
}: {
  calendarMonth: Date
  onPrev: () => void
  onNext: () => void
  onDayClick: (dateStr: string) => void
  onMonthClick: () => void
  onWeekClick: (w: number) => void
  dailyReportMap: Map<string, Report>
  monthlyReportMap: Map<string, Report>
  weeklyReportMap: Map<string, Report>
  selectedReport: Report | null
}) {
  const year = calendarMonth.getFullYear()
  const month = calendarMonth.getMonth()
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // 42 cells (6 rows × 7 cols); null = empty cell
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length < 42) cells.push(null)

  const monthKey = `${year}-${pad(month + 1)}-01`
  const hasMonthReport = monthlyReportMap.has(monthKey)

  function weekKey(w: number) {
    return `${year}-${pad(month + 1)}-W${w}`
  }

  return (
    <div style={{
      background: 'rgba(215,255,0,0.02)',
      border: '1px solid rgba(215,255,0,0.12)',
      borderRadius: 14,
      padding: '20px 24px 24px',
    }}>
      {/* Calendar header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        gap: 8,
      }}>
        <button
          onClick={onPrev}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.6)',
            borderRadius: 8,
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: 16,
            fontFamily: "'Montserrat', sans-serif",
          }}
        >
          ←
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'center' }}>
          {/* Clickable month + year → monthly report */}
          <button
            onClick={hasMonthReport ? onMonthClick : undefined}
            title={hasMonthReport ? 'View monthly report' : 'No monthly report yet'}
            style={{
              background: selectedReport?.type === 'monthly' && selectedReport.report_date === monthKey
                ? 'rgba(215,255,0,0.12)'
                : 'transparent',
              border: 'none',
              color: hasMonthReport ? '#D7FF00' : 'rgba(255,255,255,0.5)',
              fontSize: 16,
              fontWeight: 700,
              cursor: hasMonthReport ? 'pointer' : 'default',
              fontFamily: "'Montserrat', sans-serif",
              padding: '4px 10px',
              borderRadius: 8,
              transition: 'background 0.15s',
            }}
          >
            {MONTH_NAMES[month]} {year}
          </button>

          {/* W1–W4 week buttons */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2, 3, 4].map(w => {
              const key = weekKey(w)
              const has = weeklyReportMap.has(key)
              const isSelected = selectedReport?.type === 'weekly' &&
                selectedReport.week_number === w &&
                selectedReport.report_date.startsWith(`${year}-${pad(month + 1)}`)
              return (
                <button
                  key={w}
                  onClick={has ? () => onWeekClick(w) : undefined}
                  title={has ? `View Week ${w} report` : `No Week ${w} report yet`}
                  style={{
                    background: isSelected ? 'rgba(215,255,0,0.15)' : has ? 'rgba(215,255,0,0.05)' : 'transparent',
                    border: `1px solid ${has ? 'rgba(215,255,0,0.3)' : 'rgba(255,255,255,0.1)'}`,
                    color: has ? '#D7FF00' : 'rgba(255,255,255,0.25)',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: has ? 'pointer' : 'default',
                    fontFamily: "'Montserrat', sans-serif",
                    transition: 'all 0.15s',
                  }}
                >
                  W{w}
                </button>
              )
            })}
          </div>
        </div>

        <button
          onClick={onNext}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.6)',
            borderRadius: 8,
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: 16,
            fontFamily: "'Montserrat', sans-serif",
          }}
        >
          →
        </button>
      </div>

      {/* Day name headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 4,
        marginBottom: 4,
      }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{
            textAlign: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.3)',
            padding: '4px 0',
            letterSpacing: '0.05em',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 4,
      }}>
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} />
          }

          const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`
          const hasReport = dailyReportMap.has(dateStr)
          const isToday = dateStr === todayStr
          const isSelected = selectedReport?.type === 'daily' && selectedReport.report_date === dateStr

          return (
            <button
              key={dateStr}
              onClick={hasReport ? () => onDayClick(dateStr) : undefined}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 4px',
                borderRadius: 8,
                border: isSelected
                  ? '1px solid rgba(215,255,0,0.6)'
                  : isToday
                  ? '1px solid rgba(215,255,0,0.3)'
                  : '1px solid transparent',
                background: isSelected
                  ? 'rgba(215,255,0,0.15)'
                  : isToday
                  ? 'rgba(215,255,0,0.06)'
                  : 'transparent',
                cursor: hasReport ? 'pointer' : 'default',
                transition: 'all 0.12s',
                fontFamily: "'Montserrat', sans-serif",
                minHeight: 44,
              }}
            >
              <span style={{
                fontSize: 13,
                fontWeight: isToday ? 700 : 400,
                color: hasReport ? '#fff' : 'rgba(255,255,255,0.25)',
              }}>
                {day}
              </span>
              {hasReport && (
                <span style={{
                  display: 'block',
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: '#D7FF00',
                  marginTop: 3,
                }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Dark-theme injection ──────────────────────────────────────────────────────

const DARK_THEME_CSS = `
<style>
  * { box-sizing: border-box; }
  body {
    background: #000000 !important;
    color: #ffffff !important;
  }
  .header {
    background: rgba(215,255,0,0.05) !important;
    border: 1px solid rgba(215,255,0,0.2) !important;
    box-shadow: none !important;
  }
  .header h1 { color: #D7FF00 !important; }
  .header p { color: rgba(255,255,255,0.45) !important; opacity: 1 !important; }

  .banner-box {
    background: rgba(255,255,255,0.03) !important;
    border: 1px solid rgba(255,255,255,0.08) !important;
    box-shadow: none !important;
  }
  .banner-box .num { color: #D7FF00 !important; }
  .banner-box .lbl { color: rgba(255,255,255,0.4) !important; }

  .agent-card {
    background: rgba(215,255,0,0.02) !important;
    border: 1px solid rgba(215,255,0,0.10) !important;
    box-shadow: none !important;
  }
  .agent-header { border-bottom: 1px solid rgba(255,255,255,0.07) !important; }
  .agent-name { color: #ffffff !important; }

  .stat-box {
    background: rgba(255,255,255,0.03) !important;
    border: 1px solid rgba(255,255,255,0.07) !important;
  }
  .stat-label { color: rgba(255,255,255,0.4) !important; }
  .stat-value { color: #D7FF00 !important; }

  .ok { color: #4ade80 !important; }
  .warn { color: #f87171 !important; }

  .missed-calls {
    background: rgba(248,113,113,0.08) !important;
    border-left: 3px solid rgba(248,113,113,0.6) !important;
  }
  .missed-title { color: #f87171 !important; }
  .missed-calls li { color: rgba(255,255,255,0.8) !important; }
  .missed-calls li strong { color: #ffffff !important; }
  .missed-calls li span { color: #f87171 !important; }

  .summary-box {
    background: rgba(255,255,255,0.03) !important;
    border: 1px solid rgba(255,255,255,0.06) !important;
  }
  .summary-label { color: rgba(255,255,255,0.55) !important; }
  .summary-text { color: rgba(255,255,255,0.85) !important; }

  .missing-section {
    background: rgba(248,113,113,0.07) !important;
    border: 2px dashed rgba(248,113,113,0.35) !important;
  }
  .missing-title { color: #f87171 !important; }
  .missing-section li { color: rgba(255,255,255,0.75) !important; }

  .footer { color: rgba(255,255,255,0.18) !important; }
</style>
`

function applyDarkTheme(html: string): string {
  if (html.includes('</head>')) {
    return html.replace('</head>', `${DARK_THEME_CSS}</head>`)
  }
  // Fallback: prepend if no <head> tag found
  return DARK_THEME_CSS + html
}

// ── Report panel ──────────────────────────────────────────────────────────────

function ReportPanel({ report, onClose }: { report: Report; onClose: () => void }) {
  const rawHtml = typeof report.data.html === 'string' ? report.data.html : null
  const html = rawHtml ? applyDarkTheme(rawHtml) : null
  const perfectCount = typeof report.data.perfectCount === 'number' ? report.data.perfectCount : null
  const missedAgents = Array.isArray(report.data.missedAgents) ? report.data.missedAgents as string[] : []

  function downloadReport() {
    if (!html) return
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${report.report_date}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{
      background: 'rgba(215,255,0,0.03)',
      border: '1px solid rgba(215,255,0,0.15)',
      borderRadius: 12,
      padding: 20,
      marginTop: 20,
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: perfectCount !== null ? 14 : 20,
        flexWrap: 'wrap',
        gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            background: 'rgba(215,255,0,0.12)',
            color: '#D7FF00',
            borderRadius: 6,
            padding: '3px 10px',
            fontSize: 11,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            {report.type}
          </span>
          <span style={{ color: '#D7FF00', fontWeight: 700, fontSize: 16 }}>
            {formatDateLabel(report)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {html && (
            <button
              onClick={downloadReport}
              title="Download report as HTML"
              style={{
                background: 'rgba(215,255,0,0.08)',
                border: '1px solid rgba(215,255,0,0.25)',
                color: '#D7FF00',
                borderRadius: 6,
                padding: '0 14px',
                height: 30,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: "'Montserrat', sans-serif",
                flexShrink: 0,
              }}
            >
              ↓ Download
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.5)',
              borderRadius: 6,
              width: 30,
              height: 30,
              cursor: 'pointer',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'Montserrat', sans-serif",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Quick stats bar */}
      {perfectCount !== null && (
        <div style={{
          display: 'flex',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.25)',
            borderRadius: 8,
            padding: '6px 14px',
          }}>
            <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 700 }}>
              ✅ {perfectCount}/12 Perfect Attendance
            </span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: missedAgents.length > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
            border: `1px solid ${missedAgents.length > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`,
            borderRadius: 8,
            padding: '6px 14px',
          }}>
            {missedAgents.length === 0 ? (
              <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 700 }}>
                🎉 Full team — perfect attendance!
              </span>
            ) : (
              <span style={{ color: '#ef4444', fontSize: 13, fontWeight: 700 }}>
                ❌ {missedAgents.length} missed days: {missedAgents.join(', ')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Report body */}
      {html ? (
        <iframe
          srcDoc={html}
          style={{
            width: '100%',
            height: 720,
            border: 'none',
            borderRadius: 8,
            display: 'block',
          }}
          sandbox=""
          title="Daily Sales Report"
        />
      ) : Object.keys(report.data).length === 0 ? (
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>No data in this report.</p>
      ) : (
        <ReportDataView data={report.data} />
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReportsClient({ reports }: Props) {
  const [activeTab, setActiveTab] = useState<ReportTab>('daily')
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)

  // Pre-build lookup maps from the reports array
  const { dailyReportMap, monthlyReportMap, weeklyReportMap } = useMemo(() => {
    const daily = new Map<string, Report>()
    const monthly = new Map<string, Report>()
    const weekly = new Map<string, Report>()

    for (const r of reports) {
      if (r.type === 'daily') {
        daily.set(r.report_date, r)
      } else if (r.type === 'monthly') {
        // Monthly reports use first day of month as report_date
        monthly.set(r.report_date, r)
      } else if (r.type === 'weekly' && r.week_number !== null) {
        const [y, m] = r.report_date.split('-')
        weekly.set(`${y}-${m}-W${r.week_number}`, r)
      }
    }

    return { dailyReportMap: daily, monthlyReportMap: monthly, weeklyReportMap: weekly }
  }, [reports])

  function prevMonth() {
    setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    setSelectedReport(null)
  }

  function nextMonth() {
    setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    setSelectedReport(null)
  }

  function selectDay(dateStr: string) {
    setSelectedReport(dailyReportMap.get(dateStr) ?? null)
  }

  function selectMonth() {
    const key = `${calendarMonth.getFullYear()}-${pad(calendarMonth.getMonth() + 1)}-01`
    setSelectedReport(monthlyReportMap.get(key) ?? null)
  }

  function selectWeek(w: number) {
    const key = `${calendarMonth.getFullYear()}-${pad(calendarMonth.getMonth() + 1)}-W${w}`
    setSelectedReport(weeklyReportMap.get(key) ?? null)
  }

  const tabs: { key: ReportTab; label: string }[] = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'crm', label: 'Status Changes' },
  ]

  return (
    <div style={{ fontFamily: "'Montserrat', sans-serif" }}>
      {/* Page title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontSize: 24,
          fontWeight: 800,
          color: '#fff',
          margin: 0,
          letterSpacing: '-0.02em',
        }}>
          Reports
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 4, marginBottom: 0 }}>
          Browse daily, weekly, and monthly team reports
        </p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 24,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); setSelectedReport(null) }}
            style={{
              padding: '11px 28px',
              borderRadius: '8px 8px 0 0',
              fontSize: 16,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === key ? 'rgba(215,255,0,0.08)' : 'transparent',
              color: activeTab === key ? '#D7FF00' : 'rgba(255,255,255,0.4)',
              borderBottom: activeTab === key ? '2px solid #D7FF00' : '2px solid transparent',
              transition: 'all 0.15s',
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'daily' && (
        <div>
          <Calendar
            calendarMonth={calendarMonth}
            onPrev={prevMonth}
            onNext={nextMonth}
            onDayClick={selectDay}
            onMonthClick={selectMonth}
            onWeekClick={selectWeek}
            dailyReportMap={dailyReportMap}
            monthlyReportMap={monthlyReportMap}
            weeklyReportMap={weeklyReportMap}
            selectedReport={selectedReport}
          />
          {selectedReport && (
            <ReportPanel report={selectedReport} onClose={() => setSelectedReport(null)} />
          )}
          {reports.length === 0 && (
            <p style={{
              color: 'rgba(255,255,255,0.3)',
              fontSize: 14,
              marginTop: 24,
              textAlign: 'center',
            }}>
              No reports yet. Configure your n8n workflows to POST to{' '}
              <code style={{ color: 'rgba(215,255,0,0.7)', fontSize: 13 }}>/api/webhook/reports</code>.
            </p>
          )}
        </div>
      )}

      {activeTab === 'weekly' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 0',
          color: 'rgba(255,255,255,0.3)',
          gap: 8,
        }}>
          <span style={{ fontSize: 32 }}>📊</span>
          <p style={{ fontSize: 15, margin: 0 }}>Weekly reports — coming soon</p>
          <p style={{ fontSize: 13, margin: 0, color: 'rgba(255,255,255,0.2)' }}>
            Access weekly reports from the calendar using the W1–W4 buttons
          </p>
        </div>
      )}

      {activeTab === 'monthly' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 0',
          color: 'rgba(255,255,255,0.3)',
          gap: 8,
        }}>
          <span style={{ fontSize: 32 }}>📅</span>
          <p style={{ fontSize: 15, margin: 0 }}>Monthly reports — coming soon</p>
          <p style={{ fontSize: 13, margin: 0, color: 'rgba(255,255,255,0.2)' }}>
            Click the month name in the calendar to open a monthly report
          </p>
        </div>
      )}

      {activeTab === 'crm' && <CrmStatusChanges />}
    </div>
  )
}
