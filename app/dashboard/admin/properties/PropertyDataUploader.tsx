'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const NEON = '#D7FF00'
const CARD = 'rgba(255,255,255,0.03)'
const BORDER = 'rgba(255,255,255,0.08)'
const MUTED = 'rgba(255,255,255,0.4)'
const font = { fontFamily: "'Montserrat', sans-serif" }
const fontDisplay = { fontFamily: "'Space Grotesk', sans-serif" }

// Sanity floor: reject uploads that look truncated. The live dataset has
// ~16,800 units; anything under this is almost certainly a partial file.
const MIN_ROWS = 1000
const REQUIRED_FIELDS = ['project', 'price', 'area']

export default function PropertyDataUploader() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  async function handleFile(file: File) {
    setResult(null)

    if (!file.name.endsWith('.json')) {
      setResult({ ok: false, text: 'Please upload a .json file in the same format as the current property dataset.' })
      return
    }

    setBusy('Reading file…')
    let rows: Record<string, unknown>[]
    try {
      const parsed = JSON.parse(await file.text())
      if (!Array.isArray(parsed)) throw new Error('File is not a list of units')
      rows = parsed
    } catch (err) {
      setBusy(null)
      setResult({ ok: false, text: `Couldn't read this file as property data: ${err instanceof Error ? err.message : 'invalid JSON'}` })
      return
    }

    if (rows.length < MIN_ROWS) {
      setBusy(null)
      setResult({ ok: false, text: `Only ${rows.length.toLocaleString()} units found — that looks like a truncated file (expected at least ${MIN_ROWS.toLocaleString()}). Upload rejected to protect the live data.` })
      return
    }
    const sample = rows[0] ?? {}
    const missing = REQUIRED_FIELDS.filter(f => !(f in sample))
    if (missing.length > 0) {
      setBusy(null)
      setResult({ ok: false, text: `The file is missing required columns: ${missing.join(', ')}. Upload rejected.` })
      return
    }

    setBusy('Preparing upload…')
    const res = await fetch('/api/admin/property-data', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setBusy(null)
      setResult({ ok: false, text: data.error ?? 'Failed to prepare the upload.' })
      return
    }

    setBusy(`Uploading ${rows.length.toLocaleString()} units…`)
    const supabase = createClient()
    const { error: upErr } = await supabase.storage
      .from(data.bucket)
      .uploadToSignedUrl(data.path, data.token, new Blob([JSON.stringify(rows)], { type: 'application/json' }))

    setBusy(null)
    if (upErr) {
      setResult({ ok: false, text: `Upload failed: ${upErr.message}` })
      return
    }
    setResult({ ok: true, text: `Done — ${rows.length.toLocaleString()} units are live. Agents get the new data on their next visit (cached copies refresh automatically in the background). The previous version was backed up.` })
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', ...font }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: '0 0 6px', ...fontDisplay }}>
        Property <span style={{ color: NEON }}>Data</span>
      </h1>
      <p style={{ color: MUTED, fontSize: 13, marginBottom: 24 }}>
        Upload a new property dataset (.json, same format as the current one). It replaces what agents see in Find a Property — no developer or deploy needed. The old version is backed up automatically on every upload.
      </p>

      {result && (
        <div style={{
          background: result.ok ? 'rgba(215,255,0,0.08)' : 'rgba(255,60,60,0.1)',
          border: `1px solid ${result.ok ? 'rgba(215,255,0,0.3)' : 'rgba(255,60,60,0.3)'}`,
          borderRadius: 8, padding: '12px 16px', marginBottom: 16,
          color: result.ok ? NEON : '#ff8080', fontSize: 13,
        }}>
          {result.text}
        </div>
      )}

      <div
        onClick={() => !busy && fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f && !busy) handleFile(f) }}
        style={{
          border: `2px dashed ${dragOver ? NEON : BORDER}`, borderRadius: 12, padding: 48,
          textAlign: 'center', cursor: busy ? 'wait' : 'pointer',
          background: dragOver ? 'rgba(215,255,0,0.06)' : CARD, transition: 'all 0.2s',
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 10 }}>🏗️</div>
        {busy ? (
          <div style={{ color: NEON, fontSize: 14, fontWeight: 600, ...fontDisplay }}>{busy}</div>
        ) : (
          <>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, ...fontDisplay }}>Drop the property dataset here</div>
            <div style={{ color: MUTED, fontSize: 12, marginTop: 6 }}>or click to browse — .json only</div>
          </>
        )}
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
      </div>

      <p style={{ color: MUTED, fontSize: 11, marginTop: 16 }}>
        Safety checks: files with fewer than {MIN_ROWS.toLocaleString()} units or missing the {REQUIRED_FIELDS.join(' / ')} columns are rejected automatically.
      </p>
    </div>
  )
}
