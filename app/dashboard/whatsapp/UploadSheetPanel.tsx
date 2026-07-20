'use client'

import { useState, useRef, useMemo } from 'react'
import { parseExcelFile, type ParsedSheet, type RawRow } from '@/lib/excel-parser'
import { normalizePhoneKey } from '@/lib/phone'

const NEON = '#D7FF00'
const NEON_DIM = 'rgba(215,255,0,0.12)'
const NEON_BORDER = 'rgba(215,255,0,0.25)'
const CARD = 'rgba(255,255,255,0.03)'
const BORDER = 'rgba(255,255,255,0.08)'
const MUTED = 'rgba(255,255,255,0.35)'
const font = { fontFamily: "'Montserrat', sans-serif" }
const fontDisplay = { fontFamily: "'Space Grotesk', sans-serif" }

export interface UploadedSheet {
  id: string
  name: string
  current_cycle: number
  created_at: string
  contactCount: number
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

interface DuplicateEntry {
  phone: string
  client_name: string | null
  sheet_name: string
  status: 'answered' | 'not_answered' | 'pending' | 'never_distributed' | 'opted_out'
}

const STATUS_LABEL: Record<string, string> = {
  answered: 'Answered',
  not_answered: 'No Answer',
  pending: 'Pending',
  never_distributed: 'Not yet sent',
  opted_out: 'Asked to stop',
}

export default function UploadSheetPanel({
  endpoint,
  checkDuplicatesEndpoint,
  onClose,
  onUploaded,
}: {
  endpoint: string
  checkDuplicatesEndpoint?: string
  onClose: () => void
  onUploaded: (sheet: UploadedSheet) => void
}) {
  const [dragOver, setDragOver] = useState(false)
  const [parsedSheets, setParsedSheets] = useState<ParsedSheet[]>([])
  const [sheetIdx, setSheetIdx] = useState(0)
  const [phoneCol, setPhoneCol] = useState('')
  const [nameCol, setNameCol] = useState('')
  const [sheetName, setSheetName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)
  const [duplicateReport, setDuplicateReport] = useState<DuplicateEntry[] | null>(null)
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
      const key = normalizePhoneKey(phone)
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

  async function doUpload(contacts: { phone: string; client_name: string | null }[]) {
    setSubmitting(true); setError(null)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sheetName.trim(), contacts }),
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

  async function handleConfirm() {
    if (!sheetName.trim() || previewContacts.length === 0) return

    if (checkDuplicatesEndpoint) {
      setCheckingDuplicates(true); setError(null)
      try {
        const res = await fetch(checkDuplicatesEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phones: previewContacts.map(c => c.phone) }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Duplicate check failed')
        setCheckingDuplicates(false)
        if (Array.isArray(data.duplicates) && data.duplicates.length > 0) {
          setDuplicateReport(data.duplicates)
          return
        }
      } catch (err) {
        setCheckingDuplicates(false)
        setError(err instanceof Error ? err.message : 'Duplicate check failed')
        return
      }
    }

    await doUpload(previewContacts)
  }

  // Opted-out clients asked to stop — they are stripped from EVERY upload path,
  // including "Upload All Anyway". There is no override.
  function optedOutKeys(): Set<string> {
    return new Set(
      (duplicateReport ?? []).filter(d => d.status === 'opted_out').map(d => normalizePhoneKey(d.phone))
    )
  }

  function handleUploadExcludingAnswered() {
    const excludeKeys = new Set(
      (duplicateReport ?? []).filter(d => d.status === 'answered' || d.status === 'opted_out').map(d => normalizePhoneKey(d.phone))
    )
    const filtered = previewContacts.filter(c => !excludeKeys.has(normalizePhoneKey(c.phone)))
    setDuplicateReport(null)
    doUpload(filtered)
  }

  function handleUploadAllAnyway() {
    const excluded = optedOutKeys()
    const filtered = previewContacts.filter(c => !excluded.has(normalizePhoneKey(c.phone)))
    setDuplicateReport(null)
    doUpload(filtered)
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

      {duplicateReport && (() => {
        const answered = duplicateReport.filter(d => d.status === 'answered')
        const optedOut = duplicateReport.filter(d => d.status === 'opted_out')
        const safe = duplicateReport.filter(d => d.status !== 'answered' && d.status !== 'opted_out')
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, color: '#fff' }}>
              Found <strong>{duplicateReport.length}</strong> number{duplicateReport.length === 1 ? '' : 's'} already in another sheet.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.25)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#ff8080', ...fontDisplay }}>{answered.length}</div>
                <div style={{ fontSize: 11, color: MUTED }}>already answered</div>
              </div>
              {optedOut.length > 0 && (
                <div style={{ flex: 1, background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.25)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#ff8080', ...fontDisplay }}>{optedOut.length}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>asked to stop — always excluded</div>
                </div>
              )}
              <div style={{ flex: 1, background: NEON_DIM, border: `1px solid ${NEON_BORDER}`, borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: NEON, ...fontDisplay }}>{safe.length}</div>
                <div style={{ fontSize: 11, color: MUTED }}>pending / no answer / not yet sent</div>
              </div>
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto', border: `1px solid ${BORDER}`, borderRadius: 8 }}>
              {duplicateReport.map((d, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 12px', borderBottom: `1px solid ${BORDER}`, fontSize: 12 }}>
                  <span style={{ color: '#fff', flexShrink: 0 }}>{d.phone}</span>
                  <span style={{ color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.client_name ?? ''}</span>
                  <span style={{ color: MUTED, flexShrink: 0 }}>{d.sheet_name}</span>
                  <span style={{ color: d.status === 'answered' ? '#ff8080' : NEON, fontWeight: 600, flexShrink: 0 }}>{STATUS_LABEL[d.status]}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDuplicateReport(null)} style={{
                flex: 1, padding: '11px', borderRadius: 8, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, fontSize: 12, cursor: 'pointer', ...fontDisplay,
              }}>← Back</button>
              {answered.length > 0 && (
                <button onClick={handleUploadExcludingAnswered} disabled={submitting} style={{
                  flex: 2, padding: '11px', borderRadius: 8, border: 'none', background: NEON,
                  color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer', ...fontDisplay,
                }}>
                  {submitting ? 'Uploading…' : `Skip Answered, Upload Rest (${previewContacts.length - answered.length - optedOut.length})`}
                </button>
              )}
              <button onClick={handleUploadAllAnyway} disabled={submitting} style={{
                flex: 2, padding: '11px', borderRadius: 8, border: `1px solid ${NEON_BORDER}`, background: 'transparent',
                color: NEON, fontWeight: 700, fontSize: 12, cursor: 'pointer', ...fontDisplay,
              }}>
                {submitting ? 'Uploading…' : `Upload All Anyway (${previewContacts.length - optedOut.length})`}
              </button>
            </div>
          </div>
        )
      })()}

      {!duplicateReport && parsedSheets.length > 0 && activeSheet && (
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
            <button onClick={handleConfirm} disabled={!phoneCol || !sheetName.trim() || previewContacts.length === 0 || submitting || checkingDuplicates} style={{
              flex: 2, padding: '11px', borderRadius: 8, border: 'none',
              background: phoneCol && sheetName.trim() && previewContacts.length > 0 && !submitting && !checkingDuplicates ? NEON : 'rgba(215,255,0,0.25)',
              color: '#000', fontWeight: 700, fontSize: 14, cursor: phoneCol && sheetName.trim() ? 'pointer' : 'not-allowed', ...fontDisplay,
            }}>
              {checkingDuplicates ? 'Checking for duplicates…' : submitting ? 'Uploading…' : `Create Sheet (${previewContacts.length} contacts)`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
