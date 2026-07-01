'use client'

import { useState, useMemo, useCallback } from 'react'
import type { BayReport } from './page'

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function pad(n: number) { return String(n).padStart(2, '0') }

function getCairoToday(): string {
  const cairoNow = new Date(Date.now() + 2 * 60 * 60 * 1000)
  return cairoNow.toISOString().split('T')[0]
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface MissedCall { name: string; phone: string; reason: string }

interface FormData {
  report_date: string
  sheets: number
  posts: number
  requests: number
  followups: number
  total_leads: number
  reached: number
  not_reached: number
  crm_actions: number
  uploaded: number
  not_uploaded: number
  crm_confirm: boolean
  has_missed_uploads: boolean
  missed_count: number
  missed_calls: MissedCall[]
  summary: string
}

function emptyForm(date: string): FormData {
  return {
    report_date: date,
    sheets: 0, posts: 0, requests: 0, followups: 0,
    total_leads: 0, reached: 0, not_reached: 0,
    crm_actions: 0, uploaded: 0, not_uploaded: 0,
    crm_confirm: false,
    has_missed_uploads: false,
    missed_count: 0,
    missed_calls: [],
    summary: '',
  }
}

function reportToForm(r: BayReport): FormData {
  const missed = Array.isArray(r.missed_calls) ? r.missed_calls : []
  return {
    report_date:        r.report_date,
    sheets:             r.sheets,
    posts:              r.posts,
    requests:           r.requests,
    followups:          r.followups,
    total_leads:        r.total_leads,
    reached:            r.reached,
    not_reached:        r.not_reached,
    crm_actions:        r.crm_actions,
    uploaded:           r.uploaded,
    not_uploaded:       r.not_uploaded,
    crm_confirm:        r.crm_confirm,
    has_missed_uploads: r.has_missed_uploads,
    missed_count:       missed.length,
    missed_calls:       missed,
    summary:            r.summary,
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  card: {
    background: 'rgba(215,255,0,0.02)',
    border: '1px solid rgba(215,255,0,0.12)',
    borderRadius: 14,
    padding: '20px 24px 24px',
  } as React.CSSProperties,
  label: {
    fontSize: 12,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    marginBottom: 6,
    display: 'block',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  hint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 4,
    fontFamily: "'Montserrat', sans-serif",
  },
  input: {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    padding: '10px 14px',
    color: '#fff',
    fontSize: 15,
    fontFamily: "'Montserrat', sans-serif",
    outline: 'none',
  } as React.CSSProperties,
  textarea: {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    padding: '10px 14px',
    color: '#fff',
    fontSize: 14,
    fontFamily: "'Montserrat', sans-serif",
    outline: 'none',
    resize: 'vertical' as const,
    minHeight: 100,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: 800,
    color: '#D7FF00',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    marginBottom: 14,
    fontFamily: "'Space Grotesk', sans-serif",
  },
}

// ── Number field ──────────────────────────────────────────────────────────────

function NumField({
  label, hint, value, onChange, warn,
}: {
  label: string; hint?: string; value: number
  onChange: (v: number) => void; warn?: boolean
}) {
  return (
    <div>
      <label style={S.label}>{label}</label>
      <input
        type="number"
        min={0}
        value={value === 0 ? '' : value}
        placeholder="0"
        onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        style={{
          ...S.input,
          border: warn ? '1px solid rgba(251,191,36,0.6)' : S.input.border,
        }}
      />
      {hint && <p style={{ ...S.hint, color: warn ? 'rgba(251,191,36,0.8)' : 'rgba(255,255,255,0.3)' }}>{hint}</p>}
    </div>
  )
}

// ── Calendar ──────────────────────────────────────────────────────────────────

function Calendar({
  calendarMonth, reportMap, selectedDate, todayStr,
  onPrev, onNext, onDayClick,
}: {
  calendarMonth: Date
  reportMap: Map<string, BayReport>
  selectedDate: string | null
  todayStr: string
  onPrev: () => void
  onNext: () => void
  onDayClick: (d: string) => void
}) {
  const year  = calendarMonth.getFullYear()
  const month = calendarMonth.getMonth()

  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInMonth    = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length < 42) cells.push(null)

  return (
    <div style={S.card}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button onClick={onPrev} style={{
          background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '6px 12px',
          cursor: 'pointer', fontSize: 16, fontFamily: "'Montserrat', sans-serif",
        }}>←</button>

        <span style={{
          color: '#D7FF00', fontWeight: 700, fontSize: 15,
          fontFamily: "'Montserrat', sans-serif",
        }}>
          {MONTH_NAMES[month]} {year}
        </span>

        <button onClick={onNext} style={{
          background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '6px 12px',
          cursor: 'pointer', fontSize: 16, fontFamily: "'Montserrat', sans-serif",
        }}>→</button>
      </div>

      {/* Day name headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 11, fontWeight: 700,
            color: 'rgba(255,255,255,0.3)', padding: '4px 0', letterSpacing: '0.05em',
          }}>{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} />
          const dateStr   = `${year}-${pad(month + 1)}-${pad(day)}`
          const hasReport = reportMap.has(dateStr)
          const isToday   = dateStr === todayStr
          const isSelected = dateStr === selectedDate
          const clickable = hasReport || isToday

          return (
            <button
              key={dateStr}
              onClick={clickable ? () => onDayClick(dateStr) : undefined}
              style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '8px 4px', borderRadius: 8, minHeight: 44,
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
                cursor: clickable ? 'pointer' : 'default',
                transition: 'all 0.12s',
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              <span style={{
                fontSize: 13,
                fontWeight: isToday ? 700 : 400,
                color: clickable ? '#fff' : 'rgba(255,255,255,0.25)',
              }}>{day}</span>
              {hasReport && (
                <span style={{
                  display: 'block', width: 5, height: 5,
                  borderRadius: '50%', background: '#D7FF00', marginTop: 3,
                }} />
              )}
              {isToday && !hasReport && (
                <span style={{
                  display: 'block', width: 5, height: 5,
                  borderRadius: '50%', background: 'rgba(215,255,0,0.4)', marginTop: 3,
                }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── HTML report generator (matches admin report aesthetic) ────────────────────

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function generateDailyHtml(report: BayReport): string {
  // Matches admin layout: 4-column grid, label on top, large value below
  const row1 = [
    { label: 'COLD CALL SHEETS',  value: report.sheets,      check: false },
    { label: 'ORGANIC POSTS',     value: report.posts,       check: report.posts >= 5, warn: report.posts > 0 && report.posts < 5 },
    { label: 'NEW REQUESTS',      value: report.requests,    check: false },
    { label: 'FOLLOW-UPS',        value: report.followups,   check: false },
  ]
  const row2 = [
    { label: 'TOTAL NEW LEADS',   value: report.total_leads, check: false },
    { label: 'REACHED',           value: report.reached,     check: false },
    { label: 'NOT REACHED',       value: report.not_reached, check: false },
    { label: 'CRM ACTIVITIES',    value: report.crm_actions, check: false },
  ]
  const row3 = [
    { label: 'CALLS UPLOADED',    value: report.uploaded,    check: report.uploaded > 0, isText: false },
    { label: 'NOT UPLOADED',      value: report.not_uploaded,check: false, isText: false },
    { label: 'CRM UPDATED',       value: report.crm_confirm ? 'Yes' : 'No', check: report.crm_confirm, isText: true },
  ]

  function statBox(label: string, value: number | string, check: boolean, warn?: boolean, isText?: boolean) {
    const valColor = warn ? '#fbbf24' : isText ? (value === 'Yes' ? '#4ade80' : 'rgba(255,255,255,0.5)') : '#fff'
    return `<div class="stat-box">
      <div class="stat-label">${label}${check ? ' <span class="check">✓</span>' : ''}</div>
      <div class="stat-value" style="color:${valColor}">${value}</div>
    </div>`
  }

  const missedHtml = report.has_missed_uploads && report.missed_calls.length > 0
    ? `<div class="missed-section">
        <div class="missed-title">⚠ مكالمات ما اترفعتش (${report.missed_calls.length})</div>
        <ul>
          ${report.missed_calls.map(mc => `
            <li>
              <strong>${esc(mc.name)}</strong>
              ${mc.phone ? `<span class="phone">${esc(mc.phone)}</span>` : ''}
              ${mc.reason ? `<span class="reason">سبب: ${esc(mc.reason)}</span>` : ''}
            </li>`).join('')}
        </ul>
      </div>`
    : ''

  const summaryHtml = report.summary
    ? `<div class="summary-box">
        <div class="summary-label">Daily Summary / ملخص اليوم</div>
        <div class="summary-text">${esc(report.summary)}</div>
      </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Montserrat',sans-serif;background:#0a0a0a;color:#fff;padding:20px}
.agent-name{font-size:18px;font-weight:700;color:#ffffff;margin-bottom:16px}
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}
.stat-box{background:#141414;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:14px 16px}
.stat-label{font-size:10px;font-weight:700;letter-spacing:0.1em;color:rgba(255,255,255,0.4);text-transform:uppercase;margin-bottom:10px}
.check{color:#4ade80}
.stat-value{font-size:26px;font-weight:800;color:#fff}
.missed-section{background:rgba(248,113,113,0.08);border-left:3px solid rgba(248,113,113,0.6);padding:12px 16px;border-radius:8px;margin-bottom:12px}
.missed-title{font-size:12px;font-weight:700;color:#f87171;margin-bottom:10px;letter-spacing:0.05em}
.missed-section ul{list-style:none;display:flex;flex-direction:column;gap:8px}
.missed-section li{font-size:13px;background:rgba(0,0,0,0.3);padding:8px 12px;border-radius:6px;color:rgba(255,255,255,0.8)}
.missed-section li strong{display:block;font-size:14px;margin-bottom:2px;color:#fff}
.phone{font-size:12px;opacity:0.5;margin-left:8px}
.reason{display:block;font-size:12px;margin-top:4px;color:#f87171}
.summary-box{background:#141414;border:1px solid rgba(255,255,255,0.06);padding:14px 16px;border-radius:10px}
.summary-label{font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-bottom:8px}
.summary-text{font-size:14px;line-height:1.7;color:rgba(255,255,255,0.8);white-space:pre-wrap;word-break:break-word;direction:rtl;text-align:right}
</style>
</head>
<body>
<div class="agent-name">${esc(report.full_name)}</div>
<div class="grid4">
  ${row1.map(m => statBox(m.label, m.value, m.check, m.warn)).join('')}
</div>
<div class="grid4">
  ${row2.map(m => statBox(m.label, m.value, m.check)).join('')}
</div>
<div class="grid3">
  ${row3.map(m => statBox(m.label, m.value, m.check, false, m.isText)).join('')}
</div>
${missedHtml}
${summaryHtml}
</body>
</html>`
}

// ── Read-only report view ─────────────────────────────────────────────────────

function ReportView({ report, onEdit, onClose, isToday }: {
  report: BayReport; onEdit: () => void; onClose: () => void; isToday: boolean
}) {
  return (
    <div style={{
      background: 'rgba(215,255,0,0.03)',
      border: '1px solid rgba(215,255,0,0.15)',
      borderRadius: 12,
      padding: 20,
      marginTop: 20,
    }}>
      {/* Header — matches admin ReportPanel */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            background: 'rgba(215,255,0,0.12)', color: '#D7FF00',
            borderRadius: 6, padding: '3px 10px', fontSize: 11,
            fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>Daily</span>
          <span style={{ color: '#D7FF00', fontWeight: 700, fontSize: 16, fontFamily: "'Montserrat', sans-serif" }}>
            {report.report_date}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isToday && (
            <button onClick={onEdit} style={{
              background: 'rgba(215,255,0,0.08)', border: '1px solid rgba(215,255,0,0.25)',
              color: '#D7FF00', borderRadius: 6, padding: '0 14px', height: 30,
              cursor: 'pointer', fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: "'Montserrat', sans-serif", flexShrink: 0,
            }}>✏ Edit</button>
          )}
          <button onClick={onClose} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.5)', borderRadius: 6,
            width: 30, height: 30, cursor: 'pointer', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Montserrat', sans-serif", flexShrink: 0,
          }}>×</button>
        </div>
      </div>

      {/* Report body in iframe — same as admin */}
      <iframe
        srcDoc={generateDailyHtml(report)}
        style={{ width: '100%', height: 520, border: 'none', borderRadius: 8, display: 'block' }}
        sandbox=""
        title="Daily Report"
      />
    </div>
  )
}

// ── Submission form ───────────────────────────────────────────────────────────

function ReportForm({
  initial, onSave, onCancel,
}: {
  initial: FormData
  onSave: (saved: BayReport) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<FormData>(initial)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(f => ({ ...f, [key]: value }))
  }, [])

  const setNum = useCallback((key: keyof FormData) => (v: number) => {
    setForm(f => ({ ...f, [key]: v }))
  }, [])

  function handleMissedCountChange(raw: string) {
    const count = Math.max(0, Math.min(20, parseInt(raw) || 0))
    setForm(f => {
      const updated = Array.from({ length: count }, (_, i) =>
        f.missed_calls[i] ?? { name: '', phone: '', reason: '' }
      )
      return { ...f, missed_count: count, missed_calls: updated }
    })
  }

  function updateMissedCall(idx: number, field: keyof MissedCall, value: string) {
    setForm(f => {
      const calls = [...f.missed_calls]
      calls[idx] = { ...calls[idx], [field]: value }
      return { ...f, missed_calls: calls }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        report_date:        form.report_date,
        sheets:             form.sheets,
        posts:              form.posts,
        requests:           form.requests,
        followups:          form.followups,
        total_leads:        form.total_leads,
        reached:            form.reached,
        not_reached:        form.not_reached,
        crm_actions:        form.crm_actions,
        uploaded:           form.uploaded,
        not_uploaded:       form.not_uploaded,
        crm_confirm:        form.crm_confirm,
        has_missed_uploads: form.has_missed_uploads,
        missed_calls:       form.has_missed_uploads ? form.missed_calls : [],
        summary:            form.summary,
      }
      const res = await fetch('/api/bay-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Failed to save')
      onSave(json.report as BayReport)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  const postsWarn = form.posts > 0 && form.posts < 5

  return (
    <form onSubmit={handleSubmit} style={{ ...S.card, marginTop: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: "'Montserrat', sans-serif" }}>
            {form.report_date === getCairoToday() ? 'تقرير اليوم' : `تقرير ${form.report_date}`}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: "'Montserrat', sans-serif" }}>
            يتم الحفظ تلقائياً عند الضغط على إرسال — يمكنك التعديل لاحقاً
          </p>
        </div>
        <button type="button" onClick={onCancel} style={{
          background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.5)', borderRadius: 6,
          width: 30, height: 30, cursor: 'pointer', fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Montserrat', sans-serif", flexShrink: 0,
        }}>×</button>
      </div>

      {/* ── Section 1: Metrics ── */}
      <div style={{ marginBottom: 28 }}>
        <p style={S.sectionHeading}>الأرقام اليومية</p>

        {/* Row 1: sheets, posts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <NumField
            label="عدد ورقات المكالمات الباردة"
            hint="اللي خلصتها النهارده عدد الـ Cold Call Sheets"
            value={form.sheets}
            onChange={setNum('sheets')}
          />
          <NumField
            label="عدد البوستات على السوشيال ميديا"
            hint={postsWarn ? 'الحد الأدنى ٥ بوستات في اليوم' : 'الحد الأدنى ٥ بوستات في اليوم'}
            value={form.posts}
            onChange={setNum('posts')}
            warn={postsWarn}
          />
        </div>

        {/* Row 2: requests, followups */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <NumField label="عدد الطلبات الجديدة" value={form.requests} onChange={setNum('requests')} />
          <NumField label="عدد مكالمات المتابعة Follow Ups" value={form.followups} onChange={setNum('followups')} />
        </div>

        {/* Row 3: total_leads, reached, not_reached */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
          <NumField
            label="إجمالي عدد الليدز الجديدة"
            hint="العدد الكلي للليدز اللي وصلتك النهارده"
            value={form.total_leads}
            onChange={setNum('total_leads')}
          />
          <NumField
            label="عدد الليدز اللي تم التواصل معاهم"
            hint="العدد اللي ردوا وتم الكلام معاهم"
            value={form.reached}
            onChange={setNum('reached')}
          />
          <NumField
            label="عدد الليدز اللي ما تمش التواصل معاهم"
            hint="العدد اللي ما ردوش أو ما اتواصلتش معاهم"
            value={form.not_reached}
            onChange={setNum('not_reached')}
          />
        </div>

        {/* Row 4: crm_actions, uploaded, not_uploaded */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <NumField
            label="إجمالي عدد الليدز اللي اتحدثت على الـ CRM"
            value={form.crm_actions}
            onChange={setNum('crm_actions')}
          />
          <NumField
            label="عدد المكالمات المرفوعة على الـ Drive"
            hint="عدد المكالمات اللي اترفعت بنجاح على الـ Drive"
            value={form.uploaded}
            onChange={setNum('uploaded')}
          />
          <NumField
            label="عدد المكالمات اللي ما اترفعتش على الـ Drive"
            hint="عدد المكالمات اللي ما اترفعتش لأي سبب"
            value={form.not_uploaded}
            onChange={setNum('not_uploaded')}
          />
        </div>
      </div>

      {/* ── Section 2: CRM confirm ── */}
      <div style={{ marginBottom: 28 }}>
        <p style={S.sectionHeading}>تأكيد الـ CRM</p>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
          background: form.crm_confirm ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${form.crm_confirm ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 10, padding: '14px 16px',
          transition: 'all 0.15s',
        }}>
          <input
            type="checkbox"
            checked={form.crm_confirm}
            onChange={e => set('crm_confirm', e.target.checked)}
            style={{ width: 18, height: 18, accentColor: '#22c55e', cursor: 'pointer', flexShrink: 0 }}
          />
          <span style={{ fontSize: 14, color: form.crm_confirm ? '#22c55e' : 'rgba(255,255,255,0.7)', fontFamily: "'Montserrat', sans-serif", transition: 'color 0.15s' }}>
            تم تحديث كل الليدز على الـ CRM
          </span>
        </label>
      </div>

      {/* ── Section 3: Missed uploads ── */}
      <div style={{ marginBottom: 28 }}>
        <p style={S.sectionHeading}>هل في مكالمات ما اترفعتش؟</p>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: "'Montserrat', sans-serif" }}>
          لو دخلت رقم أكبر من صفر في خانة &quot;المكالمات اللي ما اترفعتش&quot;، اختر &quot;نعم&quot; عشان تضيف التفاصيل.
        </p>

        {/* Radio buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: form.has_missed_uploads ? 20 : 0 }}>
          {[
            { value: false, label: 'لا، كل المكالمات اترفعت' },
            { value: true,  label: 'نعم، عندي مكالمات ما اترفعتش' },
          ].map(({ value, label }) => (
            <label key={String(value)} style={{
              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
              background: form.has_missed_uploads === value
                ? (value ? 'rgba(248,113,113,0.08)' : 'rgba(34,197,94,0.08)')
                : 'rgba(255,255,255,0.03)',
              border: `1px solid ${form.has_missed_uploads === value
                ? (value ? 'rgba(248,113,113,0.3)' : 'rgba(34,197,94,0.3)')
                : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 10, padding: '13px 16px', transition: 'all 0.15s',
            }}>
              <input
                type="radio"
                name="has_missed_uploads"
                checked={form.has_missed_uploads === value}
                onChange={() => {
                  setForm(f => ({
                    ...f, has_missed_uploads: value,
                    ...(value ? {} : { missed_count: 0, missed_calls: [] }),
                  }))
                }}
                style={{ accentColor: value ? '#f87171' : '#22c55e', width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
              />
              <span style={{
                fontSize: 14,
                color: form.has_missed_uploads === value
                  ? (value ? '#f87171' : '#22c55e')
                  : 'rgba(255,255,255,0.6)',
                fontFamily: "'Montserrat', sans-serif", transition: 'color 0.15s',
              }}>{label}</span>
            </label>
          ))}
        </div>

        {/* Dynamic missed calls section */}
        {form.has_missed_uploads && (
          <div style={{
            background: 'rgba(248,113,113,0.04)', border: '1px solid rgba(248,113,113,0.2)',
            borderRadius: 12, padding: '18px 18px 20px', marginTop: 4,
          }}>
            {/* Count input */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ ...S.label, color: '#f87171' }}>كام مكالمة ما اترفعتش؟</label>
              <input
                type="number"
                min={1}
                max={20}
                value={form.missed_count === 0 ? '' : form.missed_count}
                placeholder="أدخل العدد"
                onChange={e => handleMissedCountChange(e.target.value)}
                style={{
                  ...S.input,
                  width: 140,
                  border: '1px solid rgba(248,113,113,0.4)',
                  background: 'rgba(248,113,113,0.06)',
                }}
              />
            </div>

            {/* One card per missed call */}
            {form.missed_calls.map((mc, i) => (
              <div key={i} style={{
                background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(248,113,113,0.15)',
                borderRadius: 10, padding: '16px', marginBottom: 12,
              }}>
                <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: '#f87171', fontFamily: "'Space Grotesk', sans-serif" }}>
                  المكالمة {i + 1}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={S.label}>اسم العميل</label>
                    <input
                      type="text"
                      value={mc.name}
                      placeholder="اسم العميل"
                      onChange={e => updateMissedCall(i, 'name', e.target.value)}
                      style={S.input}
                    />
                  </div>
                  <div>
                    <label style={S.label}>رقم العميل</label>
                    <input
                      type="text"
                      value={mc.phone}
                      placeholder="رقم التليفون"
                      onChange={e => updateMissedCall(i, 'phone', e.target.value)}
                      style={S.input}
                    />
                  </div>
                </div>
                <div>
                  <label style={S.label}>سبب عدم الرفع</label>
                  <input
                    type="text"
                    value={mc.reason}
                    placeholder="اذكر السبب"
                    onChange={e => updateMissedCall(i, 'reason', e.target.value)}
                    style={S.input}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 4: Summary ── */}
      <div style={{ marginBottom: 28 }}>
        <p style={S.sectionHeading}>ملخص اليوم</p>
        <label style={S.label}>ملخص اليوم *</label>
        <textarea
          value={form.summary}
          onChange={e => set('summary', e.target.value)}
          placeholder="اكتب ملخص ليومك واذكر إجمالي عدد المكالمات النشطة اللي عملتها، وأي ملاحظات مهمة عن الأداء أو العملاء أو المشاكل اللي قابلتها."
          style={S.textarea}
          required
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16,
          color: '#f87171', fontSize: 13, fontFamily: "'Montserrat', sans-serif",
        }}>{error}</div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        style={{
          width: '100%', padding: '14px 0',
          background: submitting ? 'rgba(215,255,0,0.3)' : '#D7FF00',
          border: 'none', borderRadius: 10, cursor: submitting ? 'not-allowed' : 'pointer',
          color: '#000', fontSize: 15, fontWeight: 800,
          fontFamily: "'Montserrat', sans-serif", letterSpacing: '0.04em',
          transition: 'all 0.15s',
        }}
      >
        {submitting ? 'جاري الإرسال...' : 'إرسال التقرير'}
      </button>
    </form>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DailyReportClient({
  reports: initialReports,
  fullName,
}: {
  reports: BayReport[]
  fullName: string
}) {
  const [reports, setReports] = useState<BayReport[]>(initialReports)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [formMode, setFormMode]         = useState(false)
  const [toast, setToast]               = useState<string | null>(null)

  const todayStr  = getCairoToday()
  const reportMap = useMemo(() => {
    const m = new Map<string, BayReport>()
    for (const r of reports) m.set(r.report_date, r)
    return m
  }, [reports])

  const selectedReport = selectedDate ? reportMap.get(selectedDate) : undefined

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function selectDay(date: string) {
    setSelectedDate(date)
    setFormMode(false)
  }

  function openFormForDate(date: string) {
    setSelectedDate(date)
    setFormMode(true)
  }

  function handleSaved(saved: BayReport) {
    setReports(prev => {
      const idx = prev.findIndex(r => r.report_date === saved.report_date)
      if (idx >= 0) {
        const next = [...prev]; next[idx] = saved; return next
      }
      return [saved, ...prev]
    })
    setFormMode(false)
    setSelectedDate(saved.report_date)
    showToast('تم حفظ التقرير بنجاح ✅')
  }

  const formInitial = formMode
    ? (selectedReport ? reportToForm(selectedReport) : emptyForm(selectedDate ?? todayStr))
    : null

  return (
    <div style={{ fontFamily: "'Montserrat', sans-serif" }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 9999,
          background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)',
          borderRadius: 10, padding: '12px 20px',
          color: '#22c55e', fontSize: 14, fontWeight: 700,
          fontFamily: "'Montserrat', sans-serif",
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}>
          {toast}
        </div>
      )}

      {/* Page title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
          Daily Report
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 4, marginBottom: 0 }}>
          {fullName} — سجّل تقريرك اليومي وتابع سجل تقاريرك السابقة
        </p>
      </div>

      {/* Submit today CTA (shown when no day selected and today has no report) */}
      {!selectedDate && !reportMap.has(todayStr) && (
        <div style={{
          background: 'rgba(215,255,0,0.04)', border: '1px dashed rgba(215,255,0,0.3)',
          borderRadius: 12, padding: '20px 24px', marginBottom: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14,
        }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: '#D7FF00', fontSize: 15, fontFamily: "'Montserrat', sans-serif" }}>
              لسه ما سجّلتش تقرير النهارده
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: "'Montserrat', sans-serif" }}>
              {todayStr}
            </p>
          </div>
          <button
            onClick={() => openFormForDate(todayStr)}
            style={{
              background: '#D7FF00', border: 'none', borderRadius: 8,
              padding: '10px 20px', cursor: 'pointer',
              color: '#000', fontSize: 13, fontWeight: 800,
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            + سجّل تقرير اليوم
          </button>
        </div>
      )}

      {/* Today already submitted CTA */}
      {!selectedDate && reportMap.has(todayStr) && (
        <div style={{
          background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)',
          borderRadius: 12, padding: '16px 24px', marginBottom: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14,
        }}>
          <p style={{ margin: 0, fontSize: 14, color: '#22c55e', fontWeight: 700, fontFamily: "'Montserrat', sans-serif" }}>
            ✅ تقرير النهارده ({todayStr}) اتسجّل — اضغط على التاريخ في الكالندر عشان تشوفه أو تعدله
          </p>
          <button
            onClick={() => selectDay(todayStr)}
            style={{
              background: 'transparent', border: '1px solid rgba(34,197,94,0.4)',
              color: '#22c55e', borderRadius: 8, padding: '8px 16px',
              cursor: 'pointer', fontSize: 12, fontWeight: 700,
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            عرض التقرير
          </button>
        </div>
      )}

      {/* Calendar */}
      <Calendar
        calendarMonth={calendarMonth}
        reportMap={reportMap}
        selectedDate={selectedDate}
        todayStr={todayStr}
        onPrev={() => { setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)); setSelectedDate(null); setFormMode(false) }}
        onNext={() => { setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)); setSelectedDate(null); setFormMode(false) }}
        onDayClick={selectDay}
      />

      {/* Right-side panel */}
      {formMode && formInitial && (
        <ReportForm
          initial={formInitial}
          onSave={handleSaved}
          onCancel={() => setFormMode(false)}
        />
      )}

      {!formMode && selectedReport && (
        <ReportView
          report={selectedReport}
          onEdit={() => setFormMode(true)}
          onClose={() => { setSelectedDate(null); setFormMode(false) }}
          isToday={selectedReport.report_date === todayStr}
        />
      )}

      {/* Selected today with no report yet → show form prompt */}
      {!formMode && selectedDate && !selectedReport && (
        <div style={{
          ...S.card, marginTop: 20,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '40px 24px', gap: 16,
        }}>
          <span style={{ fontSize: 36 }}>📋</span>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: "'Montserrat', sans-serif" }}>
            {selectedDate === todayStr ? 'سجّل تقرير النهارده' : `لا يوجد تقرير بتاريخ ${selectedDate}`}
          </p>
          {selectedDate === todayStr && (
            <button
              onClick={() => openFormForDate(todayStr)}
              style={{
                background: '#D7FF00', border: 'none', borderRadius: 8,
                padding: '12px 28px', cursor: 'pointer',
                color: '#000', fontSize: 14, fontWeight: 800,
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              + إضافة تقرير اليوم
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {reports.length === 0 && !selectedDate && (
        <p style={{
          color: 'rgba(255,255,255,0.3)', fontSize: 14,
          marginTop: 24, textAlign: 'center',
          fontFamily: "'Montserrat', sans-serif",
        }}>
          لا يوجد تقارير بعد — ابدأ بتسجيل تقرير اليوم!
        </p>
      )}
    </div>
  )
}
