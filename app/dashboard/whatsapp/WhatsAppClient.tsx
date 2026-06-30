'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'

const NEON = '#D7FF00'
const NEON_DIM = 'rgba(215,255,0,0.12)'
const NEON_BORDER = 'rgba(215,255,0,0.25)'
const CARD = 'rgba(255,255,255,0.03)'
const BORDER = 'rgba(255,255,255,0.08)'
const MUTED = 'rgba(255,255,255,0.35)'
const font = { fontFamily: "'Montserrat', sans-serif" }
const fontDisplay = { fontFamily: "'Space Grotesk', sans-serif" }

interface Contact { id: string; phone: string; client_name: string | null }
interface Sheet { id: string; name: string; current_cycle: number }
interface Assignment {
  id: string
  cycle: number
  message_text: string | null
  sent_at: string | null
  response_status: 'pending' | 'answered' | 'not_answered'
  contact: Contact
  sheet: Sheet
}

function toWaNumber(n: string): string {
  return n.replace(/\D/g, '')
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

export default function WhatsAppClient({ initialAssignments }: { initialAssignments: Assignment[] }) {
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const newAssignments = useMemo(
    () => assignments.filter(a => a.cycle === a.sheet.current_cycle && !a.sent_at),
    [assignments]
  )
  const oldAssignments = useMemo(
    () => assignments.filter(a => a.sent_at && a.response_status === 'pending'),
    [assignments]
  )

  const [tab, setTab] = useState<'new' | 'old'>(newAssignments.length > 0 ? 'new' : 'old')

  const newSheets = useMemo(() => {
    const map = new Map<string, Sheet>()
    for (const a of newAssignments) map.set(a.sheet.id, a.sheet)
    return [...map.values()]
  }, [newAssignments])

  const [activeSheetId, setActiveSheetId] = useState<string | null>(newSheets[0]?.id ?? null)
  const [messageText, setMessageText] = useState('')
  const [copied, setCopied] = useState(false)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [mediaDragOver, setMediaDragOver] = useState(false)
  const mediaInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!activeSheetId && newSheets.length > 0) setActiveSheetId(newSheets[0].id)
    if (activeSheetId && !newSheets.some(s => s.id === activeSheetId)) setActiveSheetId(newSheets[0]?.id ?? null)
  }, [newSheets, activeSheetId])

  // Photo is scoped to the active sheet's send session — clear it when switching sheets
  useEffect(() => {
    setMediaFile(null); setMediaPreview(null)
  }, [activeSheetId])

  const handleMediaSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    setMediaFile(file); setMediaPreview(URL.createObjectURL(file))
  }, [])

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
  const current = newForActiveSheet[0]

  const oldBySheet = useMemo(() => {
    const map = new Map<string, { sheet: Sheet; rows: Assignment[] }>()
    for (const a of oldAssignments) {
      if (!map.has(a.sheet.id)) map.set(a.sheet.id, { sheet: a.sheet, rows: [] })
      map.get(a.sheet.id)!.rows.push(a)
    }
    return [...map.values()]
  }, [oldAssignments])

  async function markSent() {
    if (!current) return
    setBusyId(current.id); setError(null)
    try {
      await patchAssignment(current.id, { action: 'sent', message_text: messageText })
      setAssignments(prev => prev.map(a => a.id === current.id ? { ...a, sent_at: new Date().toISOString(), message_text: messageText } : a))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as sent')
    } finally {
      setBusyId(null)
    }
  }

  function openWhatsApp() {
    if (!current) return
    // No ?text= param on purpose — WhatsApp Web mangles emoji/special characters
    // passed through the URL (e.g. bullet emoji turn into "�"). Clipboard + manual
    // paste is the only reliable way to send the message exactly as typed.
    navigator.clipboard.writeText(messageText).catch(() => {})
    window.open(`https://wa.me/${toWaNumber(current.contact.phone)}`, '_blank')
  }

  async function copyMessage() {
    await navigator.clipboard.writeText(messageText)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
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

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#fff', margin: 0, ...fontDisplay }}>
            WhatsApp <span style={{ color: NEON }}>Assignments</span>
          </h1>
          <p style={{ color: MUTED, fontSize: 13, marginTop: 6 }}>
            Clients assigned to you by admin. Send to new contacts, then mark old ones as answered or not.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <TabButton active={tab === 'new'} onClick={() => setTab('new')} label={`New (${newAssignments.length})`} />
          <TabButton active={tab === 'old'} onClick={() => setTab('old')} label={`Old (${oldAssignments.length})`} />
        </div>

        {error && (
          <div style={{ background: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#ff8080', fontSize: 13 }}>
            {error}
          </div>
        )}

        {tab === 'new' && (
          <>
            {newSheets.length === 0 && (
              <EmptyState text="No new contacts assigned right now." />
            )}

            {newSheets.length > 0 && (
              <>
                {newSheets.length > 1 && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    {newSheets.map(s => (
                      <button key={s.id} onClick={() => setActiveSheetId(s.id)} style={{
                        padding: '6px 12px', borderRadius: 6, border: `1px solid ${s.id === activeSheetId ? NEON_BORDER : BORDER}`,
                        background: s.id === activeSheetId ? NEON_DIM : 'transparent',
                        color: s.id === activeSheetId ? NEON : MUTED, fontSize: 12, cursor: 'pointer', ...fontDisplay,
                      }}>{s.name}</button>
                    ))}
                  </div>
                )}

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
                  <p style={{ color: MUTED, fontSize: 11, margin: '0 0 12px' }}>You&apos;ll attach this manually in each WhatsApp chat when sending.</p>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, ...fontDisplay }}>{newForActiveSheet.length} remaining</span>
                  </div>
                </div>

                {current ? (
                  <div style={{ background: CARD, border: `1px solid ${NEON_BORDER}`, borderRadius: 12, padding: 24 }}>
                    <div style={{ fontSize: 11, color: MUTED, letterSpacing: '0.08em', ...fontDisplay, marginBottom: 8 }}>CURRENT</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', ...fontDisplay, marginBottom: 4 }}>{current.contact.phone}</div>
                    {current.contact.client_name && <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>{current.contact.client_name}</div>}

                    <div style={{ background: 'rgba(215,255,0,0.06)', border: `1px solid ${NEON_BORDER}`, borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                      <div style={{ fontSize: 12, color: NEON, fontWeight: 600, marginBottom: 6 }}>How to send:</div>
                      <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <li style={{ fontSize: 12, color: MUTED }}>Click <strong style={{ color: '#fff' }}>Open in WhatsApp</strong> — message is copied to your clipboard</li>
                        <li style={{ fontSize: 12, color: MUTED }}>In the chat, click the text box and press <strong style={{ color: '#fff' }}>Ctrl+V</strong> to paste it (this keeps emojis/Arabic text intact — WhatsApp corrupts them if sent pre-filled)</li>
                        {mediaFile && <li style={{ fontSize: 12, color: MUTED }}>Click the 📎 icon, choose the downloaded photo, then attach it</li>}
                        <li style={{ fontSize: 12, color: MUTED }}>Press Enter / the send button in WhatsApp yourself — nothing is sent automatically</li>
                      </ol>
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                      <button onClick={openWhatsApp} disabled={!messageText.trim()} style={{
                        flex: 2, padding: '14px', borderRadius: 8, border: 'none',
                        background: messageText.trim() ? NEON : 'rgba(215,255,0,0.25)',
                        color: '#000', fontWeight: 700, fontSize: 15, cursor: messageText.trim() ? 'pointer' : 'not-allowed', ...fontDisplay,
                      }}>
                        Open in WhatsApp ↗
                      </button>
                      <button onClick={markSent} disabled={busyId === current.id} style={{
                        flex: 1, padding: '14px', borderRadius: 8, border: `1px solid ${NEON_BORDER}`,
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
                ) : (
                  <EmptyState text="All new contacts in this sheet have been sent." />
                )}
              </>
            )}
          </>
        )}

        {tab === 'old' && (
          <>
            {oldBySheet.length === 0 && <EmptyState text="Nothing waiting on a response classification." />}
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
