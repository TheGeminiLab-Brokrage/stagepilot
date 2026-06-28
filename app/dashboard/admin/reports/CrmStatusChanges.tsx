'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import * as XLSX from 'xlsx'

function todayStr() {
  return new Date().toISOString().split('T')[0]
}
function monthStartStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

type Row = Record<string, unknown>

type ResultState = {
  count: number
  dateFrom: string
  dateTo: string
  data: Row[]
  source?: 'api' | 'file' | 'saved'
  savedAt?: string
  savedId?: number
}

export default function CrmStatusChanges({
  onDataChange,
}: {
  onDataChange?: (data: Row[], dateFrom: string, dateTo: string) => void
}) {
  const [dateFrom, setDateFrom] = useState(monthStartStr)
  const [dateTo, setDateTo]     = useState(todayStr)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [debug, setDebug]       = useState<Record<string, unknown> | null>(null)
  const [result, setResult]     = useState<ResultState | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Load last saved export on mount ──────────────────────────────────────────
  useEffect(() => {
    fetch('/api/crm/save')
      .then(r => r.json())
      .then(json => {
        if (json.ok && json.export) {
          const ex = json.export
          setResult({
            count: ex.row_count,
            dateFrom: ex.date_from,
            dateTo: ex.date_to,
            data: ex.data as Row[],
            source: 'saved',
            savedAt: ex.saved_at,
            savedId: ex.id,
          })
          setDateFrom(ex.date_from)
          setDateTo(ex.date_to)
          onDataChange?.(ex.data as Row[], ex.date_from, ex.date_to)
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Save ──────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!result) return
    setSaving(true)
    try {
      const res = await fetch('/api/crm/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateFrom: result.dateFrom, dateTo: result.dateTo, data: result.data, source: result.source ?? 'file' }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Save failed'); return }
      setResult(prev => prev ? { ...prev, source: 'saved', savedAt: json.savedAt, savedId: json.id } : prev)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!result?.savedId) { setResult(null); onDataChange?.([], '', ''); return }
    setDeleting(true)
    try {
      const res = await fetch('/api/crm/save', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: result.savedId }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Delete failed'); return }
      setResult(null)
      onDataChange?.([], '', '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  // ── API path ──────────────────────────────────────────────────────────────────
  async function handleUpdate() {
    if (!dateFrom || !dateTo) { setError('Please select both a From and To date.'); return }
    if (dateFrom > dateTo)    { setError('"From" date must be before or equal to "To" date.'); return }
    setLoading(true); setError(null); setDebug(null); setResult(null)
    try {
      const res  = await fetch('/api/crm/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateFrom, dateTo }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setError(json.error ?? `Request failed (HTTP ${res.status})`)
        if (json.debug) setDebug(json.debug as Record<string, unknown>)
        return
      }
      setResult({ count: json.count, dateFrom: json.dateFrom, dateTo: json.dateTo, data: json.data, source: 'api' })
      onDataChange?.(json.data, json.dateFrom, json.dateTo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  // ── File / drag-and-drop path ─────────────────────────────────────────────────
  function parseExcel(file: File) {
    if (!file.name.match(/\.xlsx?$/i)) { setError('Please drop an Excel file (.xlsx or .xls)'); return }
    setLoading(true); setError(null); setDebug(null); setResult(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const buffer   = e.target?.result as ArrayBuffer
        const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
        const sheet    = workbook.Sheets[workbook.SheetNames[0]]
        const allRows  = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Row[]
        const fromMs   = new Date(dateFrom + 'T00:00:00Z').getTime()
        const toMs     = new Date(dateTo   + 'T23:59:59Z').getTime()
        const records  = allRows.filter(row => {
          const raw = String(row['CREATED_AT'] ?? row['Created At'] ?? row['created_at'] ?? '')
          if (!raw) return true
          const ts = new Date(raw).getTime()
          return !isNaN(ts) && ts >= fromMs && ts <= toMs
        })
        setResult({ count: records.length, dateFrom, dateTo, data: records, source: 'file' })
        onDataChange?.(records, dateFrom, dateTo)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse Excel file')
      } finally {
        setLoading(false)
      }
    }
    reader.onerror = () => { setError('Failed to read file'); setLoading(false) }
    reader.readAsArrayBuffer(file)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) parseExcel(file)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo])

  const isSaved = result?.source === 'saved'

  return (
    <div style={{ fontFamily: "'Montserrat', sans-serif" }}>

      {/* ── Controls bar ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 16, padding: '20px 24px', background: 'rgba(215,255,0,0.02)', border: '1px solid rgba(215,255,0,0.12)', borderRadius: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} disabled={loading}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, padding: '8px 12px', fontFamily: "'Montserrat', sans-serif", outline: 'none', cursor: loading ? 'not-allowed' : 'pointer', colorScheme: 'dark' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} disabled={loading}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, padding: '8px 12px', fontFamily: "'Montserrat', sans-serif", outline: 'none', cursor: loading ? 'not-allowed' : 'pointer', colorScheme: 'dark' }} />
        </div>
        <button onClick={handleUpdate} disabled={loading}
          style={{ background: loading ? 'rgba(215,255,0,0.1)' : '#D7FF00', color: loading ? 'rgba(215,255,0,0.4)' : '#000', border: 'none', borderRadius: 8, padding: '0 24px', height: 40, fontSize: 14, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Montserrat', sans-serif", transition: 'all 0.15s', letterSpacing: '0.02em', flexShrink: 0 }}>
          {loading ? 'Updating…' : 'Update'}
        </button>
        {loading && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', alignSelf: 'center' }}>This may take up to 90 seconds</span>}
      </div>

      {/* ── Divider ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>or upload a CRM export directly</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
      </div>

      {/* ── Drop zone (hidden when a file is already loaded) ── */}
      {!result && (
        <div
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => !loading && fileInputRef.current?.click()}
          style={{ border: `2px dashed ${dragOver ? '#D7FF00' : 'rgba(255,255,255,0.12)'}`, borderRadius: 14, padding: '36px 24px', marginBottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: loading ? 'not-allowed' : 'pointer', background: dragOver ? 'rgba(215,255,0,0.04)' : 'transparent', transition: 'all 0.15s' }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={dragOver ? '#D7FF00' : 'rgba(255,255,255,0.25)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: dragOver ? '#D7FF00' : 'rgba(255,255,255,0.4)' }}>Drag &amp; drop a CRM export here</p>
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>or <span style={{ color: dragOver ? '#D7FF00' : 'rgba(215,255,0,0.6)', textDecoration: 'underline' }}>click to browse</span> — accepts .xlsx / .xls</p>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) parseExcel(f); e.target.value = '' }} />
        </div>
      )}

      {/* ── Error / Debug ── */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '14px 18px', marginBottom: debug ? 8 : 20, color: '#f87171', fontSize: 14 }}>
          {error}
        </div>
      )}
      {debug && (
        <pre style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, color: 'rgba(255,255,255,0.5)', fontSize: 11, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {JSON.stringify(debug, null, 2)}
        </pre>
      )}

      {/* ── File card (replaces the full table) ── */}
      {result && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Excel icon */}
          <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
              <line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /><line x1="10" y1="9" x2="14" y2="9" />
            </svg>
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>CRM Status Changes Export</span>
              {isSaved && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.08em', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 5, padding: '2px 8px' }}>
                  Saved
                </span>
              )}
              {result.source === 'file' && (
                <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(215,255,0,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', background: 'rgba(215,255,0,0.07)', border: '1px solid rgba(215,255,0,0.2)', borderRadius: 5, padding: '2px 8px' }}>
                  Unsaved
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: '#D7FF00', fontWeight: 700 }}>{result.count.toLocaleString()} records</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{result.dateFrom} → {result.dateTo}</span>
              {result.savedAt && (
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
                  Saved {new Date(result.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {/* Save button — only when unsaved */}
            {!isSaved && (
              <button onClick={handleSave} disabled={saving}
                style={{ background: saving ? 'rgba(215,255,0,0.08)' : 'rgba(215,255,0,0.12)', color: saving ? 'rgba(215,255,0,0.3)' : '#D7FF00', border: '1px solid rgba(215,255,0,0.35)', borderRadius: 8, padding: '0 18px', height: 36, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'Montserrat', sans-serif", display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
                </svg>
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}

            {/* Replace file button */}
            <button onClick={() => fileInputRef.current?.click()} disabled={loading}
              style={{ background: 'transparent', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '0 14px', height: 36, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Montserrat', sans-serif", display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Replace
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) parseExcel(f); e.target.value = '' }} />

            {/* Delete button */}
            <button onClick={handleDelete} disabled={deleting}
              style={{ background: 'transparent', color: deleting ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.7)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '0 14px', height: 36, fontSize: 12, fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: "'Montserrat', sans-serif", display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
              </svg>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
