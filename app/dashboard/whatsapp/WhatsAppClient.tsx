'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import UploadSheetPanel, { type UploadedSheet } from './UploadSheetPanel'

const NEON = '#D7FF00'
const NEON_DIM = 'rgba(215,255,0,0.12)'
const NEON_BORDER = 'rgba(215,255,0,0.25)'
const CARD = 'rgba(255,255,255,0.03)'
const BORDER = 'rgba(255,255,255,0.08)'
const MUTED = 'rgba(255,255,255,0.35)'
const font = { fontFamily: "'Montserrat', sans-serif" }
const fontDisplay = { fontFamily: "'Space Grotesk', sans-serif" }

interface Contact { id: string; phone: string; client_name: string | null }
interface Sheet { id: string; name: string; current_cycle: number; own?: boolean }
interface Assignment {
  id: string
  cycle: number
  message_text: string | null
  sent_at: string | null
  response_status: 'pending' | 'answered' | 'not_answered'
  contact: Contact
  sheet: Sheet
}

const BATCH_SIZE = 30

function toWaNumber(n: string): string {
  return n.replace(/\D/g, '')
}

// Cells can contain multiple numbers for the same client, e.g. "+201064442200, +20222871945"
function parsePhoneNumbers(raw: string): string[] {
  return raw.split(/[,/;]+/).map(s => s.trim()).filter(Boolean)
}

async function patchAssignment(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/whatsapp/assignments/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Request failed')
  return data
}

export default function WhatsAppClient({
  initialAssignments,
  assignedSheets = [],
}: {
  initialAssignments: Assignment[]
  assignedSheets?: Sheet[]
}) {
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isRefilling, setIsRefilling] = useState(false)
  const [refillDone, setRefillDone] = useState(false)

  const newAssignments = useMemo(
    () => assignments.filter(a => a.cycle === a.sheet.current_cycle && !a.sent_at),
    [assignments]
  )
  const oldAssignments = useMemo(
    () => assignments.filter(a => a.sent_at && a.response_status === 'pending'),
    [assignments]
  )

  const [tab, setTab] = useState<'new' | 'old' | 'login'>(newAssignments.length > 0 ? 'new' : 'old')

  // --- WhatsApp session state ---
  const [sessionStatus, setSessionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')
  const [sessionPhone, setSessionPhone] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const [autoSendInterval, setAutoSendInterval] = useState<number | null>(null)
  const [autoSendDropdownOpen, setAutoSendDropdownOpen] = useState(false)
  const autoSendIntervalRef = useRef<number | null>(null)
  const autoSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSendDropdownRef = useRef<HTMLDivElement>(null)
  const sendViaWhatsAppRef = useRef<() => Promise<void>>(() => Promise.resolve())

  // Check session status on mount
  useEffect(() => {
    fetch('/api/whatsapp/session')
      .then(r => r.json())
      .then((data: { connected: boolean; phone?: string }) => {
        if (data.connected) {
          setSessionStatus('connected')
          setSessionPhone(data.phone ?? null)
        } else {
          setSessionStatus('disconnected')
        }
      })
      .catch(() => setSessionStatus('disconnected'))
  }, [])

  // SSE stream for QR — stays connected until scanned, timed out, or tab changes
  useEffect(() => {
    if (tab !== 'login' || sessionStatus !== 'disconnected') return

    let es: EventSource | null = null
    let cancelled = false

    function connect() {
      if (cancelled) return
      setQrLoading(true)

      es = new EventSource('/api/whatsapp/qr')

      es.onmessage = (event) => {
        if (cancelled) return
        let data: { qr?: string; connected?: boolean; phone?: string; error?: string } | null = null
        try { data = JSON.parse(event.data) } catch { return }
        if (!data) return

        if (data.qr) {
          setQrCode(data.qr)
          setQrLoading(false)
        }
        if (data.connected) {
          setSessionStatus('connected')
          setSessionPhone(data.phone ?? null)
          setQrCode(null)
          es?.close()
        }
        if (data.error === 'timeout') {
          // Server hit its 55s limit or had a transient close — reconnect for a fresh QR
          es?.close()
          if (!cancelled) connect()
        }
        if (data.error === 'loggedout') {
          // Genuine logout — stop retrying, user must re-link
          setQrLoading(false)
          es?.close()
        }
      }

      es.onerror = () => {
        if (cancelled) return
        setQrLoading(false)
        es?.close()
        // Retry after 3s on network error
        setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      cancelled = true
      es?.close()
    }
  }, [tab, sessionStatus])

  async function logout() {
    await fetch('/api/whatsapp/session', { method: 'DELETE' })
    setSessionStatus('disconnected')
    setSessionPhone(null)
    setQrCode(null)
  }

  async function sendViaWhatsApp() {
    if (!current) return
    setSendingId(current.id)
    setError(null)
    const isLast = newForActiveSheet.length === 1
    try {
      let imageBase64: string | undefined
      let imageMimeType: string | undefined
      if (mediaFile) {
        const buf = await mediaFile.arrayBuffer()
        const bytes = new Uint8Array(buf)
        let binary = ''
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
        imageBase64 = btoa(binary)
        imageMimeType = mediaFile.type
      }
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: current.id,
          phones: editableNumbers,
          message: messageText,
          ...(imageBase64 ? { imageBase64, imageMimeType } : {}),
        }),
      })
      let data: { error?: string } = {}
      try { data = await res.json() } catch { /* non-JSON body (e.g. 504 timeout) */ }
      if (!res.ok) throw new Error(data.error ?? `Send failed (HTTP ${res.status})`)
      // Auto-move contact to Old tab — no separate "Mark Sent" click needed
      setAssignments(prev => prev.map(a =>
        a.id === current.id
          ? { ...a, sent_at: new Date().toISOString(), message_text: messageText }
          : a
      ))
      setSelectedAssignmentId(null)
      setNewSearch('')
      if (isLast && activeSheetId) refill(activeSheetId)
      // Start 30-second cooldown so the agent pauses before sending to the next client
      setCooldownUntil(Date.now() + 30000)
      setCooldownRemaining(30)
      if (autoSendIntervalRef.current !== null) {
        autoSendTimerRef.current = setTimeout(() => {
          sendViaWhatsAppRef.current()
        }, autoSendIntervalRef.current)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send'
      setError(msg)
      if (msg.toLowerCase().includes('session expired') || msg.toLowerCase().includes('re-scan')) {
        setSessionStatus('disconnected')
      }
      setAutoSendInterval(null)
      if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current)
    } finally {
      setSendingId(null)
    }
  }
  sendViaWhatsAppRef.current = sendViaWhatsApp

  // --- Sheet / batch / search state ---
  const newSheets = useMemo(() => {
    const map = new Map<string, Sheet>()
    for (const a of newAssignments) map.set(a.sheet.id, a.sheet)
    return [...map.values()]
  }, [newAssignments])

  // Sheets this agent uploaded themselves this session — authoritative "own" flag
  // since assignedSheets (server-loaded) and newSheets (from assignments) may not carry it yet.
  const [ownUploadedSheets, setOwnUploadedSheets] = useState<Sheet[]>([])
  const [deletedSheetIds, setDeletedSheetIds] = useState<Set<string>>(new Set())
  const [showUpload, setShowUpload] = useState(false)
  const [deletingSheet, setDeletingSheet] = useState(false)

  // Merge assignedSheets (admin-assigned, may be empty of contacts) with newSheets (live data)
  const allSheets = useMemo(() => {
    const map = new Map<string, Sheet>()
    for (const s of assignedSheets) map.set(s.id, s)
    for (const s of newSheets) {
      const existing = map.get(s.id)
      map.set(s.id, { ...s, own: existing?.own ?? s.own }) // live data takes priority, but keep the own flag
    }
    for (const s of ownUploadedSheets) map.set(s.id, s) // session-fresh uploads, always authoritative
    return [...map.values()].filter(s => !deletedSheetIds.has(s.id))
  }, [assignedSheets, newSheets, ownUploadedSheets, deletedSheetIds])

  const [activeSheetId, setActiveSheetId] = useState<string | null>(allSheets[0]?.id ?? null)

  // Message text and media are stored per sheet so switching tabs preserves each sheet's state
  const [messageTexts, setMessageTexts] = useState<Record<string, string>>({})
  const [mediaFiles, setMediaFiles] = useState<Record<string, File | null>>({})
  const [mediaPreviews, setMediaPreviews] = useState<Record<string, string | null>>({})

  const messageText = messageTexts[activeSheetId ?? ''] ?? ''
  const setMessageText = (text: string) => {
    if (!activeSheetId) return
    setMessageTexts(prev => ({ ...prev, [activeSheetId]: text }))
  }
  const mediaFile = mediaFiles[activeSheetId ?? ''] ?? null
  const mediaPreview = mediaPreviews[activeSheetId ?? ''] ?? null
  const setMediaFile = useCallback((file: File | null) => {
    if (!activeSheetId) return
    setMediaFiles(prev => ({ ...prev, [activeSheetId]: file }))
  }, [activeSheetId])
  const setMediaPreview = useCallback((url: string | null) => {
    if (!activeSheetId) return
    setMediaPreviews(prev => ({ ...prev, [activeSheetId]: url }))
  }, [activeSheetId])

  const [copied, setCopied] = useState(false)
  const [showPasteHint, setShowPasteHint] = useState(false)
  const [clipboardFailed, setClipboardFailed] = useState(false)
  const [numbersCopied, setNumbersCopied] = useState(false)
  const [numbersBatchIndex, setNumbersBatchIndex] = useState(0)
  const [lastCopiedBatch, setLastCopiedBatch] = useState<Assignment[]>([])
  const [newSearch, setNewSearch] = useState('')
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null)
  const [mediaDragOver, setMediaDragOver] = useState(false)
  const mediaInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!activeSheetId && allSheets.length > 0) setActiveSheetId(allSheets[0].id)
    if (activeSheetId && !allSheets.some(s => s.id === activeSheetId)) setActiveSheetId(allSheets[0]?.id ?? null)
  }, [allSheets, activeSheetId])

  // Batch progress is per-sheet — reset when switching sheets
  useEffect(() => {
    setNumbersBatchIndex(0); setLastCopiedBatch([])
  }, [activeSheetId])

  // Refill state is per-sheet — reset when switching sheets
  useEffect(() => {
    setRefillDone(false)
  }, [activeSheetId])

  // Search/selection is per-sheet — reset when switching sheets
  useEffect(() => {
    setNewSearch(''); setSelectedAssignmentId(null)
  }, [activeSheetId])

  // Cooldown countdown — ticks every 200ms until the 30s window expires
  useEffect(() => {
    if (!cooldownUntil) return
    const tick = () => {
      const remaining = Math.ceil((cooldownUntil - Date.now()) / 1000)
      if (remaining <= 0) { setCooldownUntil(null); setCooldownRemaining(0) }
      else setCooldownRemaining(remaining)
    }
    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [cooldownUntil])

  // Keep ref in sync so timer callbacks always see the latest interval value
  useEffect(() => {
    autoSendIntervalRef.current = autoSendInterval
  }, [autoSendInterval])

  // Stop auto-send when all contacts are exhausted
  useEffect(() => {
    if (refillDone && autoSendInterval !== null) {
      setAutoSendInterval(null)
      if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current)
    }
  }, [refillDone, autoSendInterval])

  // Reset auto-send and cooldown when switching sheets
  useEffect(() => {
    setAutoSendInterval(null)
    setAutoSendDropdownOpen(false)
    setCooldownUntil(null)
    setCooldownRemaining(0)
    if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current)
  }, [activeSheetId])

  // Clear pending timer on unmount
  useEffect(() => {
    return () => { if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current) }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!autoSendDropdownOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (autoSendDropdownRef.current && !autoSendDropdownRef.current.contains(e.target as Node)) {
        setAutoSendDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [autoSendDropdownOpen])

  const handleMediaSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    setMediaFile(file); setMediaPreview(URL.createObjectURL(file))
  }, [setMediaFile, setMediaPreview])

  const handleMediaDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setMediaDragOver(false)
    const f = e.dataTransfer.files[0]; if (f) handleMediaSelect(f)
  }, [handleMediaSelect])

  function downloadMedia() {
    if (!mediaFile || !mediaPreview) return
    const a = document.createElement('a')
    a.href = mediaPreview
    a.download = mediaFile.name
    a.click()
  }

  const newForActiveSheet = useMemo(
    () => newAssignments.filter(a => a.sheet.id === activeSheetId),
    [newAssignments, activeSheetId]
  )
  const oldForActiveSheet = useMemo(
    () => oldAssignments.filter(a => a.sheet.id === activeSheetId),
    [oldAssignments, activeSheetId]
  )
  const current = newForActiveSheet.find(a => a.id === selectedAssignmentId) ?? newForActiveSheet[0]
  const currentNumbers = useMemo(() => current ? parsePhoneNumbers(current.contact.phone) : [], [current])
  const totalBatches = Math.max(1, Math.ceil(newForActiveSheet.length / BATCH_SIZE))

  // Editable copy of the phone numbers — agent can correct a number before sending
  const [editableNumbers, setEditableNumbers] = useState<string[]>([])
  useEffect(() => { setEditableNumbers(currentNumbers) }, [current?.id])
  useEffect(() => { setShowPasteHint(false); setClipboardFailed(false) }, [current?.id])

  const newSearchMatches = useMemo(() => {
    const q = toWaNumber(newSearch)
    if (!q) return []
    return newForActiveSheet.filter(a => parsePhoneNumbers(a.contact.phone).some(n => toWaNumber(n).includes(q)))
  }, [newForActiveSheet, newSearch])

  const [oldSearch, setOldSearch] = useState('')

  const filteredOldAssignments = useMemo(() => {
    const q = toWaNumber(oldSearch)
    if (!q) return oldAssignments
    return oldAssignments.filter(a => parsePhoneNumbers(a.contact.phone).some(n => toWaNumber(n).includes(q)))
  }, [oldAssignments, oldSearch])

  const oldBySheet = useMemo(() => {
    const map = new Map<string, { sheet: Sheet; rows: Assignment[] }>()
    for (const a of filteredOldAssignments) {
      if (!map.has(a.sheet.id)) map.set(a.sheet.id, { sheet: a.sheet, rows: [] })
      map.get(a.sheet.id)!.rows.push(a)
    }
    return [...map.values()]
  }, [filteredOldAssignments])

  async function refill(sheetId: string) {
    setIsRefilling(true)
    try {
      const res = await fetch('/api/whatsapp/assignments/refill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to load more clients — try again')
        return
      }
      if (data.done || !data.assignments?.length) {
        setRefillDone(true)
      } else {
        setAssignments(prev => [...prev, ...data.assignments])
      }
    } catch {
      setError('Failed to load more clients — try again')
    } finally {
      setIsRefilling(false)
    }
  }

  function handleUploaded(sheet: UploadedSheet) {
    setOwnUploadedSheets(prev => [{ id: sheet.id, name: sheet.name, current_cycle: sheet.current_cycle, own: true }, ...prev])
    setActiveSheetId(sheet.id)
    setTab('new')
    setShowUpload(false)
    refill(sheet.id)
  }

  async function deleteOwnSheet() {
    const activeSheet = allSheets.find(s => s.id === activeSheetId)
    if (!activeSheet?.own || !activeSheetId) return
    if (!window.confirm(`Delete "${activeSheet.name}" and all its contacts? This can't be undone.`)) return
    setDeletingSheet(true); setError(null)
    try {
      const res = await fetch(`/api/whatsapp/sheets/${activeSheetId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete sheet')
      setDeletedSheetIds(prev => new Set(prev).add(activeSheetId))
      setOwnUploadedSheets(prev => prev.filter(s => s.id !== activeSheetId))
      setAssignments(prev => prev.filter(a => a.sheet.id !== activeSheetId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete sheet')
    } finally {
      setDeletingSheet(false)
    }
  }

  async function markSent() {
    if (!current) return
    setBusyId(current.id); setError(null)
    const isLast = newForActiveSheet.length === 1
    try {
      await patchAssignment(current.id, { action: 'sent', message_text: messageText })
      setAssignments(prev => prev.map(a => a.id === current.id ? { ...a, sent_at: new Date().toISOString(), message_text: messageText } : a))
      setSelectedAssignmentId(null); setNewSearch('')
      if (isLast && activeSheetId) refill(activeSheetId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as sent')
    } finally {
      setBusyId(null)
    }
  }

  function openWhatsApp(number: string) {
    // No ?text= param — confirmed (again, on both wa.me and api.whatsapp.com) that
    // real campaign-length messages (Arabic + multiple emoji + line breaks) get
    // silently dropped rather than prefilled. Clipboard + manual paste is the only
    // transport that reliably delivers the message intact regardless of length.
    navigator.clipboard.writeText(messageText).catch(() => setClipboardFailed(true))
    setShowPasteHint(true)
    window.open(`https://wa.me/${toWaNumber(number)}`, '_blank')
  }

  async function copyMessage() {
    await navigator.clipboard.writeText(messageText)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  async function copyNumbersBatch() {
    if (newForActiveSheet.length === 0) return
    const start = numbersBatchIndex * BATCH_SIZE
    const batch = newForActiveSheet.slice(start, start + BATCH_SIZE)
    const numbers = batch.flatMap(a => parsePhoneNumbers(a.contact.phone))
    await navigator.clipboard.writeText(numbers.join('\n'))
    setLastCopiedBatch(batch)
    setNumbersCopied(true); setTimeout(() => setNumbersCopied(false), 2000)
    setNumbersBatchIndex(prev => (prev + 1) % totalBatches)
  }

  async function markBatchSent() {
    if (lastCopiedBatch.length === 0) return
    if (!window.confirm(`Mark these ${lastCopiedBatch.length} clients as sent?`)) return
    setBusyId('bulk'); setError(null)
    try {
      await Promise.all(lastCopiedBatch.map(a => patchAssignment(a.id, { action: 'sent', message_text: messageText })))
      const now = new Date().toISOString()
      const ids = new Set(lastCopiedBatch.map(a => a.id))
      const updatedAssignments = assignments.map(a => ids.has(a.id) ? { ...a, sent_at: now, message_text: messageText } : a)
      setAssignments(updatedAssignments)
      setLastCopiedBatch([])
      setNumbersBatchIndex(0)
      const stillUnsent = updatedAssignments.filter(a =>
        a.sheet.id === activeSheetId &&
        a.cycle === a.sheet.current_cycle &&
        !a.sent_at
      ).length
      if (stillUnsent === 0 && activeSheetId) refill(activeSheetId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark batch as sent')
    } finally {
      setBusyId(null)
    }
  }

  function downloadClientsExcel() {
    const rows = assignments
      .filter(a => a.sheet.id === activeSheetId && a.cycle === a.sheet.current_cycle)
      .map(a => ({
        'Client Name': a.contact.client_name ?? '',
        'Phone': a.contact.phone,
        'Sheet': a.sheet.name,
        'Cycle': a.cycle,
        'Status': a.response_status === 'answered' ? 'Answered'
                : a.response_status === 'not_answered' ? 'Not Answered'
                : 'Pending',
        'Sent At': a.sent_at ? new Date(a.sent_at).toLocaleString() : '',
      }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'My Clients')
    XLSX.writeFile(wb, `my-clients-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  async function classify(assignment: Assignment, status: 'answered' | 'not_answered') {
    setBusyId(assignment.id); setError(null)
    try {
      await patchAssignment(assignment.id, { action: status })
      setAssignments(prev => prev.map(a => a.id === assignment.id ? { ...a, response_status: status } : a))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save response')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000', ...font }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#fff', margin: 0, ...fontDisplay }}>
              WhatsApp <span style={{ color: NEON }}>Assignments</span>
            </h1>
            <p style={{ color: MUTED, fontSize: 13, marginTop: 6 }}>
              Clients assigned to you by admin. Send to new contacts, then mark old ones as answered or not.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => setShowUpload(v => !v)}
              style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: NEON_DIM, border: `1px solid ${NEON_BORDER}`,
                color: NEON, cursor: 'pointer', whiteSpace: 'nowrap',
                ...fontDisplay,
              }}
            >
              ⭱ Upload My Sheet
            </button>
            <button
              onClick={downloadClientsExcel}
              disabled={assignments.length === 0}
              style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: NEON_DIM, border: `1px solid ${NEON_BORDER}`,
                color: NEON, cursor: 'pointer', whiteSpace: 'nowrap',
                opacity: assignments.length === 0 ? 0.4 : 1,
                ...fontDisplay,
              }}
            >
              ↓ Download Clients
            </button>
          </div>
        </div>

        {showUpload && (
          <UploadSheetPanel endpoint="/api/whatsapp/sheets" onClose={() => setShowUpload(false)} onUploaded={handleUploaded} />
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <TabButton active={tab === 'new'} onClick={() => setTab('new')} label={`New (${newForActiveSheet.length})`} />
          <TabButton active={tab === 'old'} onClick={() => setTab('old')} label={`Old (${oldForActiveSheet.length})`} />
          <TabButton active={tab === 'login'} onClick={() => setTab('login')} label="Login" />
        </div>

        {error && (
          <div style={{ background: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#ff8080', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* ── LOGIN TAB ── */}
        {tab === 'login' && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 40, textAlign: 'center' }}>
            {sessionStatus === 'checking' && (
              <div style={{ color: MUTED, fontSize: 14 }}>Checking connection…</div>
            )}

            {sessionStatus === 'connected' && (
              <>
                <div style={{ fontSize: 48, marginBottom: 12, color: NEON }}>✓</div>
                <div style={{ color: NEON, fontWeight: 700, fontSize: 20, ...fontDisplay, marginBottom: 6 }}>Connected</div>
                {sessionPhone && (
                  <div style={{ color: MUTED, fontSize: 13, marginBottom: 24 }}>+{sessionPhone}</div>
                )}
                <p style={{ color: MUTED, fontSize: 13, marginBottom: 24 }}>
                  Your WhatsApp is linked. Go to the{' '}
                  <button onClick={() => setTab('new')} style={{ color: NEON, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline', ...fontDisplay }}>
                    New tab
                  </button>{' '}
                  to auto-send messages.
                </p>
                <button
                  onClick={logout}
                  style={{
                    padding: '10px 22px', borderRadius: 8,
                    border: '1px solid rgba(255,80,80,0.35)',
                    background: 'rgba(255,80,80,0.08)',
                    color: 'rgba(255,100,100,0.9)', fontSize: 13,
                    cursor: 'pointer', ...fontDisplay,
                  }}
                >
                  Unlink / Logout
                </button>
              </>
            )}

            {sessionStatus === 'disconnected' && (
              <>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, ...fontDisplay, marginBottom: 10 }}>
                  Link your WhatsApp
                </div>
                <p style={{ color: MUTED, fontSize: 13, marginBottom: 24, maxWidth: 340, margin: '0 auto 24px' }}>
                  Open WhatsApp on your phone → tap <strong style={{ color: '#fff' }}>⋮ Menu</strong> or <strong style={{ color: '#fff' }}>Settings</strong> → <strong style={{ color: '#fff' }}>Linked Devices</strong> → <strong style={{ color: '#fff' }}>Link a Device</strong> → scan this code
                </p>

                {qrLoading && !qrCode && (
                  <div style={{ color: MUTED, fontSize: 13, padding: '40px 0' }}>Generating QR code…</div>
                )}

                {qrCode && (
                  <>
                    <div style={{
                      display: 'inline-block', background: '#fff',
                      padding: 14, borderRadius: 14, marginBottom: 12,
                    }}>
                      <img src={qrCode} alt="WhatsApp QR Code" style={{ display: 'block', width: 220, height: 220 }} />
                    </div>
                    <p style={{ color: MUTED, fontSize: 11, marginTop: 8 }}>
                      Code refreshes automatically. Scan within 30 seconds.
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ── NEW TAB ── */}
        {tab === 'new' && (
          <>
            {isRefilling && (
              <div style={{ background: NEON_DIM, border: `1px solid ${NEON_BORDER}`, borderRadius: 10, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: NEON, fontSize: 16 }}>⟳</span>
                <span style={{ color: NEON, fontSize: 13, fontWeight: 600, ...fontDisplay }}>Getting your next 30 clients…</span>
              </div>
            )}

            {!isRefilling && allSheets.length === 0 && (
              <EmptyState text={refillDone ? 'You\'ve finished all clients for this sheet!' : 'No new contacts assigned right now.'} />
            )}

            {allSheets.length > 0 && (
              <>
                {allSheets.find(s => s.id === activeSheetId)?.own && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                    <button onClick={deleteOwnSheet} disabled={deletingSheet} style={{
                      padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,80,80,0.35)',
                      background: 'rgba(255,80,80,0.08)', color: 'rgba(255,120,120,0.9)',
                      fontSize: 12, cursor: 'pointer', ...fontDisplay,
                    }}>
                      {deletingSheet ? 'Deleting…' : '🗑 Delete This Sheet'}
                    </button>
                  </div>
                )}
                {allSheets.length > 1 && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    {allSheets.map(s => (
                      <button key={s.id} onClick={() => setActiveSheetId(s.id)} style={{
                        padding: '6px 12px', borderRadius: 6, border: `1px solid ${s.id === activeSheetId ? NEON_BORDER : BORDER}`,
                        background: s.id === activeSheetId ? NEON_DIM : 'transparent',
                        color: s.id === activeSheetId ? NEON : MUTED, fontSize: 12, cursor: 'pointer', ...fontDisplay,
                      }}>{s.name}</button>
                    ))}
                  </div>
                )}

                {!isRefilling && newForActiveSheet.length === 0 && activeSheetId && (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ color: MUTED, fontSize: 14, marginBottom: 16 }}>
                      {refillDone ? 'You\'ve finished all clients for this sheet!' : 'No contacts loaded for this sheet yet.'}
                    </div>
                    {!refillDone && (
                      <button
                        onClick={() => refill(activeSheetId)}
                        style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: NEON,
                                 color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer', ...fontDisplay }}
                      >
                        Get Contacts
                      </button>
                    )}
                  </div>
                )}

                {newForActiveSheet.length > 0 && (<>
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, marginBottom: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#fff', ...fontDisplay, display: 'block', marginBottom: 10 }}>Message Text</label>
                  <textarea value={messageText} onChange={e => setMessageText(e.target.value)}
                    placeholder="Type the message you want to send to clients…"
                    style={{ width: '100%', height: 120, background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 13, ...font, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                  <button onClick={copyMessage} style={{
                    marginTop: 10, padding: '8px 14px', borderRadius: 6, border: `1px solid ${NEON_BORDER}`,
                    background: NEON_DIM, color: copied ? NEON : '#fff', fontSize: 12, cursor: 'pointer', ...fontDisplay,
                  }}>{copied ? '✓ Copied!' : '⎘ Copy Message'}</button>
                </div>

                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, marginBottom: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#fff', ...fontDisplay, display: 'block', marginBottom: 6 }}>
                    Attach Photo <span style={{ color: MUTED, fontWeight: 400 }}>(optional)</span>
                  </label>
                  <p style={{ color: MUTED, fontSize: 11, margin: '0 0 12px' }}>When connected, the photo is sent automatically with the message. If not connected, download it and attach manually.</p>
                  {mediaPreview ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <img src={mediaPreview} alt="Media" style={{ height: 80, width: 80, objectFit: 'cover', borderRadius: 8, border: `1px solid ${BORDER}` }} />
                      <div>
                        <div style={{ color: '#fff', fontSize: 13 }}>{mediaFile?.name}</div>
                        <button onClick={() => { setMediaFile(null); setMediaPreview(null) }}
                          style={{ color: 'rgba(255,80,80,0.7)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 0, marginTop: 4 }}>Remove</button>
                      </div>
                    </div>
                  ) : (
                    <div onClick={() => mediaInputRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); setMediaDragOver(true) }}
                      onDragLeave={() => setMediaDragOver(false)}
                      onDrop={handleMediaDrop}
                      style={{ border: `2px dashed ${mediaDragOver ? NEON : BORDER}`, borderRadius: 8, padding: '18px', textAlign: 'center', cursor: 'pointer', background: mediaDragOver ? NEON_DIM : 'transparent', transition: 'all 0.2s' }}>
                      <div style={{ color: MUTED, fontSize: 13 }}>Drop image or <span style={{ color: NEON, textDecoration: 'underline' }}>browse</span></div>
                    </div>
                  )}
                  <input ref={mediaInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleMediaSelect(f) }} />
                </div>

                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, ...fontDisplay }}>
                      {newForActiveSheet.length} remaining — Batch {numbersBatchIndex + 1}/{totalBatches}
                    </span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={copyNumbersBatch} disabled={newForActiveSheet.length === 0} style={{
                        padding: '6px 12px', borderRadius: 6, border: `1px solid ${NEON_BORDER}`,
                        background: NEON_DIM, color: numbersCopied ? NEON : '#fff', fontSize: 12, cursor: 'pointer', ...fontDisplay,
                      }}>{numbersCopied ? '✓ Copied!' : `⎘ Copy Next Batch (${Math.min(BATCH_SIZE, newForActiveSheet.length - numbersBatchIndex * BATCH_SIZE)})`}</button>
                      <button onClick={markBatchSent} disabled={busyId === 'bulk' || lastCopiedBatch.length === 0} style={{
                        padding: '6px 12px', borderRadius: 6, border: `1px solid ${NEON_BORDER}`,
                        background: NEON_DIM, color: NEON, fontSize: 12, cursor: 'pointer', ...fontDisplay,
                      }}>{busyId === 'bulk' ? '…' : `✓ Mark Batch Sent (${lastCopiedBatch.length})`}</button>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <input value={newSearch} onChange={e => setNewSearch(e.target.value)}
                    placeholder="Search by phone number to jump to a contact…"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 13, ...font, outline: 'none', boxSizing: 'border-box' }} />
                </div>

                {newSearch.trim() && (
                  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
                    {newSearchMatches.length === 0 ? (
                      <div style={{ padding: '14px 16px', color: MUTED, fontSize: 13 }}>No matches in this sheet.</div>
                    ) : newSearchMatches.map(a => (
                      <button key={a.id} onClick={() => { setSelectedAssignmentId(a.id); setNewSearch('') }} style={{
                        display: 'block', width: '100%', textAlign: 'left', padding: '12px 16px', border: 'none',
                        borderBottom: `1px solid ${BORDER}`, background: 'transparent',
                        color: '#fff', fontSize: 13, cursor: 'pointer', ...fontDisplay,
                      }}>
                        {parsePhoneNumbers(a.contact.phone).join(', ')}
                        {a.contact.client_name && <span style={{ color: MUTED, marginLeft: 8 }}>{a.contact.client_name}</span>}
                      </button>
                    ))}
                  </div>
                )}

                {current ? (
                  <div style={{ background: CARD, border: `1px solid ${NEON_BORDER}`, borderRadius: 12, padding: 24 }}>
                    <div style={{ fontSize: 11, color: MUTED, letterSpacing: '0.08em', ...fontDisplay, marginBottom: 8 }}>CURRENT</div>
                    {editableNumbers.map((num, i) => (
                      <input
                        key={i}
                        value={num}
                        onChange={e => setEditableNumbers(prev => prev.map((n, j) => j === i ? e.target.value : n))}
                        style={{
                          display: 'block', width: '100%', fontSize: 20, fontWeight: 700,
                          color: '#fff', background: 'rgba(255,255,255,0.05)',
                          border: `1px solid ${BORDER}`, borderRadius: 8,
                          padding: '8px 12px', marginBottom: 6, outline: 'none',
                          boxSizing: 'border-box', ...fontDisplay,
                        }}
                      />
                    ))}
                    {current.contact.client_name && <div style={{ fontSize: 13, color: MUTED, marginBottom: 10 }}>{current.contact.client_name}</div>}

                    {messageText.trim() && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, color: MUTED, letterSpacing: '0.08em', ...fontDisplay, marginBottom: 6 }}>MESSAGE PREVIEW</div>
                        <div style={{
                          background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: 8,
                          padding: '10px 12px', color: '#fff', fontSize: 13, whiteSpace: 'pre-wrap',
                          fontFamily: "system-ui, 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif",
                        }}>
                          {messageText}
                        </div>
                      </div>
                    )}

                    {/* Manual send instructions — hidden when connected (auto-send handles delivery) */}
                    {sessionStatus !== 'connected' && (
                      <div style={{ background: 'rgba(215,255,0,0.06)', border: `1px solid ${NEON_BORDER}`, borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                        <div style={{ fontSize: 12, color: NEON, fontWeight: 600, marginBottom: 6 }}>How to send:</div>
                        <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <li style={{ fontSize: 12, color: MUTED }}>Click <strong style={{ color: '#fff' }}>Open in WhatsApp</strong> — message is copied to your clipboard</li>
                          <li style={{ fontSize: 12, color: MUTED }}>In the chat, click the text box and press <strong style={{ color: '#fff' }}>Ctrl+V</strong> to paste it — this is required, WhatsApp corrupts emoji if sent pre-filled instead</li>
                          {mediaFile && <li style={{ fontSize: 12, color: MUTED }}>Click the 📎 icon, choose the downloaded photo, then attach it</li>}
                          <li style={{ fontSize: 12, color: MUTED }}>Press Enter / the send button in WhatsApp yourself — nothing is sent automatically</li>
                        </ol>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                      {sessionStatus === 'connected' ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          {/* Primary send button */}
                          <button
                            onClick={sendViaWhatsApp}
                            disabled={!messageText.trim() || !!sendingId || !!cooldownUntil}
                            style={{
                              flex: 1, padding: '14px', borderRadius: 8, border: 'none',
                              background: messageText.trim() && !cooldownUntil ? NEON : 'rgba(215,255,0,0.25)',
                              color: '#000', fontWeight: 700, fontSize: 15,
                              cursor: messageText.trim() && !sendingId && !cooldownUntil ? 'pointer' : 'not-allowed', ...fontDisplay,
                            }}
                          >
                            {sendingId === current.id ? 'Sending…' : cooldownUntil ? `Wait ${cooldownRemaining}s…` : 'Send via WhatsApp'}
                          </button>

                          {/* Auto Send toggle + dropdown */}
                          <div ref={autoSendDropdownRef} style={{ position: 'relative' }}>
                            {autoSendInterval === null ? (
                              <button
                                onClick={() => setAutoSendDropdownOpen(v => !v)}
                                disabled={!messageText.trim()}
                                style={{
                                  height: '100%', padding: '0 16px', borderRadius: 8,
                                  border: `1px solid ${NEON_BORDER}`, background: NEON_DIM,
                                  color: NEON, fontWeight: 600, fontSize: 13,
                                  cursor: messageText.trim() ? 'pointer' : 'not-allowed',
                                  whiteSpace: 'nowrap', ...fontDisplay,
                                }}
                              >
                                Auto Send ▾
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setAutoSendInterval(null)
                                  if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current)
                                }}
                                style={{
                                  height: '100%', padding: '0 16px', borderRadius: 8,
                                  border: '1px solid rgba(255,80,80,0.35)',
                                  background: 'rgba(255,80,80,0.08)',
                                  color: 'rgba(255,120,120,0.9)', fontWeight: 600, fontSize: 13,
                                  cursor: 'pointer', whiteSpace: 'nowrap', ...fontDisplay,
                                }}
                              >
                                Stop Auto
                              </button>
                            )}
                            {autoSendDropdownOpen && autoSendInterval === null && (
                              <div style={{
                                position: 'absolute', right: 0, top: '100%', marginTop: 4,
                                background: '#111', border: `1px solid ${BORDER}`,
                                borderRadius: 8, overflow: 'hidden', zIndex: 20, minWidth: 130,
                              }}>
                                {([
                                  { label: '15 sec', ms: 15000 },
                                  { label: '30 sec', ms: 30000 },
                                  { label: '1 min',  ms: 60000 },
                                  { label: '2 min',  ms: 120000 },
                                ] as const).map(({ label, ms }) => (
                                  <button
                                    key={ms}
                                    onClick={() => {
                                      setAutoSendInterval(ms)
                                      setAutoSendDropdownOpen(false)
                                      sendViaWhatsApp()
                                    }}
                                    style={{
                                      display: 'block', width: '100%', textAlign: 'left',
                                      padding: '10px 14px', border: 'none',
                                      borderBottom: `1px solid ${BORDER}`,
                                      background: 'transparent', color: '#fff',
                                      fontSize: 13, cursor: 'pointer', ...fontDisplay,
                                    }}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Manual flow when not connected */
                        <>
                          {sessionStatus === 'disconnected' && (
                            <div style={{ background: 'rgba(215,255,0,0.04)', border: `1px solid ${NEON_BORDER}`, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: MUTED }}>
                              <span style={{ color: NEON }}>Tip:</span>{' '}
                              Connect in the{' '}
                              <button onClick={() => setTab('login')} style={{ color: NEON, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 0, textDecoration: 'underline', ...fontDisplay }}>
                                Login tab
                              </button>{' '}
                              to auto-send messages.
                            </div>
                          )}
                          {!showPasteHint && messageText.trim() && (
                            <div style={{ fontSize: 12, color: MUTED, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px' }}>
                              WhatsApp will open with an <strong style={{ color: '#fff' }}>empty</strong> chat — the message is copied to your clipboard, so click the text box and press <strong style={{ color: '#fff' }}>Ctrl+V</strong> to paste it, then send it yourself.
                            </div>
                          )}
                          {editableNumbers.map((num, i) => (
                            <button key={i} onClick={() => openWhatsApp(num)} disabled={!messageText.trim()} style={{
                              padding: '14px', borderRadius: 8, border: 'none',
                              background: messageText.trim() ? NEON : 'rgba(215,255,0,0.25)',
                              color: '#000', fontWeight: 700, fontSize: 15, cursor: messageText.trim() ? 'pointer' : 'not-allowed', ...fontDisplay,
                            }}>
                              {editableNumbers.length > 1 ? `Open ${num} in WhatsApp ↗` : 'Open in WhatsApp ↗'}
                            </button>
                          ))}
                          {showPasteHint && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 13, color: '#92400e', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 6, padding: '10px 14px' }}>
                              <span>
                                {clipboardFailed
                                  ? <>Couldn&apos;t copy automatically — click <strong>Copy Message</strong> below, then paste it (<strong>Ctrl+V</strong>) into the WhatsApp chat and send.</>
                                  : <>Message copied — click the WhatsApp text box and press <strong>Ctrl+V</strong> to paste, then hit <strong>Send</strong> yourself.</>}
                              </span>
                              <button onClick={() => setShowPasteHint(false)} style={{ background: 'none', border: 'none', color: '#92400e', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }} aria-label="Dismiss">×</button>
                            </div>
                          )}
                        </>
                      )}

                      {/* Always keep Mark Sent as a fallback */}
                      <button onClick={markSent} disabled={busyId === current.id} style={{
                        padding: '14px', borderRadius: 8, border: `1px solid ${NEON_BORDER}`,
                        background: NEON_DIM, color: NEON, fontWeight: 600, fontSize: 13, cursor: 'pointer', ...fontDisplay,
                      }}>
                        {busyId === current.id ? '…' : '✓ Mark Sent'}
                      </button>
                    </div>

                    {mediaFile && mediaPreview && (
                      <button onClick={downloadMedia} style={{
                        width: '100%', marginTop: 10, padding: '11px', borderRadius: 8,
                        border: `1px solid ${BORDER}`, background: 'transparent',
                        color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', ...fontDisplay,
                      }}>
                        ↓ Download Photo to Attach
                      </button>
                    )}
                  </div>
                ) : isRefilling ? (
                  <div style={{ background: NEON_DIM, border: `1px solid ${NEON_BORDER}`, borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: NEON, fontSize: 16 }}>⟳</span>
                    <span style={{ color: NEON, fontSize: 13, fontWeight: 600, ...fontDisplay }}>Getting your next 30 clients…</span>
                  </div>
                ) : refillDone ? (
                  <EmptyState text="You've finished all clients for this sheet!" />
                ) : (
                  <EmptyState text="All new contacts in this sheet have been sent." />
                )}
                </>)}
              </>
            )}
          </>
        )}

        {/* ── OLD TAB ── */}
        {tab === 'old' && (
          <>
            <input value={oldSearch} onChange={e => setOldSearch(e.target.value)}
              placeholder="Search by phone number…"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 13, ...font, outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />
            {oldBySheet.length === 0 && (
              <EmptyState text={oldSearch.trim() ? 'No contacts match that number.' : 'Nothing waiting on a response classification.'} />
            )}
            {oldBySheet.map(({ sheet, rows }) => (
              <div key={sheet.id} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', ...fontDisplay, marginBottom: 10 }}>{sheet.name}</div>
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
                  {rows.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${BORDER}` }}>
                      <div>
                        <div style={{ color: '#fff', fontSize: 13, ...fontDisplay }}>{a.contact.phone}</div>
                        {a.contact.client_name && <div style={{ color: MUTED, fontSize: 11 }}>{a.contact.client_name}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => classify(a, 'answered')} disabled={busyId === a.id} style={{
                          padding: '7px 12px', borderRadius: 6, border: `1px solid ${NEON_BORDER}`, background: NEON_DIM,
                          color: NEON, fontSize: 12, fontWeight: 600, cursor: 'pointer', ...fontDisplay,
                        }}>✓ Answered</button>
                        <button onClick={() => classify(a, 'not_answered')} disabled={busyId === a.id} style={{
                          padding: '7px 12px', borderRadius: 6, border: `1px solid ${BORDER}`, background: 'transparent',
                          color: MUTED, fontSize: 12, cursor: 'pointer', ...fontDisplay,
                        }}>✗ No Answer</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{
      padding: '9px 18px', borderRadius: 8, border: `1px solid ${active ? NEON_BORDER : BORDER}`,
      background: active ? NEON_DIM : 'transparent', color: active ? NEON : MUTED,
      fontSize: 13, fontWeight: 600, cursor: 'pointer', ...fontDisplay,
    }}>{label}</button>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 40, textAlign: 'center', color: MUTED, fontSize: 13 }}>
      {text}
    </div>
  )
}
