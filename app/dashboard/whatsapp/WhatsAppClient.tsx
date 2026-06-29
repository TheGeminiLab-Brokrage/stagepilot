'use client'

import { useState, useRef, useCallback } from 'react'

const NEON = '#D7FF00'
const NEON_DIM = 'rgba(215,255,0,0.12)'
const NEON_BORDER = 'rgba(215,255,0,0.25)'
const CARD = 'rgba(255,255,255,0.03)'
const BORDER = 'rgba(255,255,255,0.08)'
const MUTED = 'rgba(255,255,255,0.35)'
const font = { fontFamily: "'Montserrat', sans-serif" }
const fontDisplay = { fontFamily: "'Space Grotesk', sans-serif" }

function parsePhoneNumbers(text: string): string[] {
  const seen = new Set<string>()
  const results: string[] = []
  for (const line of text.split('\n')) {
    const digitsOnly = line.trim().replace(/[^\d+]/g, '')
    if (digitsOnly.length >= 7 && digitsOnly.length <= 16) {
      const key = digitsOnly.replace(/\D/g, '')
      if (!seen.has(key)) { seen.add(key); results.push(digitsOnly) }
    }
  }
  const regex = /\+?\d[\d\s\-().]{6,18}\d/g
  const matches = text.match(regex) ?? []
  for (const m of matches) {
    const clean = m.replace(/[\s\-().]/g, '')
    const key = clean.replace(/\D/g, '')
    if (key.length >= 7 && key.length <= 16 && !seen.has(key)) {
      seen.add(key); results.push(clean)
    }
  }
  return results
}

function toWaNumber(n: string): string {
  return n.replace(/\D/g, '')
}

export default function WhatsAppClient() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [numbers, setNumbers] = useState<string[]>([])
  const [newNumber, setNewNumber] = useState('')
  const [messageText, setMessageText] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [mediaDragOver, setMediaDragOver] = useState(false)

  // Sending session state
  const [sentSet, setSentSet] = useState<Set<number>>(new Set())
  const [currentIdx, setCurrentIdx] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    setImageFile(file); setImagePreview(URL.createObjectURL(file)); setError(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]; if (f) handleImageSelect(f)
  }, [handleImageSelect])

  const handleMediaSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    setMediaFile(file); setMediaPreview(URL.createObjectURL(file))
  }, [])

  const handleMediaDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setMediaDragOver(false)
    const f = e.dataTransfer.files[0]; if (f) handleMediaSelect(f)
  }, [handleMediaSelect])

  async function extractNumbers() {
    if (!imageFile) return
    setLoading(true); setProgress(0); setError(null)
    try {
      const Tesseract = (await import('tesseract.js')).default
      const result = await Tesseract.recognize(imageFile, 'eng', {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100))
        },
      })
      const found = parsePhoneNumbers(result.data.text)
      if (found.length === 0) { setError('No phone numbers detected. Try a clearer photo.'); return }
      setNumbers(found); setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OCR failed')
    } finally { setLoading(false); setProgress(0) }
  }

  function addNumber() {
    const n = newNumber.trim()
    if (!n || numbers.includes(n)) return
    setNumbers(prev => [...prev, n]); setNewNumber('')
  }

  function startSession() {
    setSentSet(new Set()); setCurrentIdx(0); setStep(4)
  }

  function openWhatsApp(idx: number) {
    const num = toWaNumber(numbers[idx])
    const text = encodeURIComponent(messageText)
    window.open(`https://wa.me/${num}?text=${text}`, '_blank')
  }

  function markSentAndNext(idx: number) {
    setSentSet(prev => new Set([...prev, idx]))
    const next = numbers.findIndex((_, i) => i > idx && !sentSet.has(i))
    if (next !== -1) setCurrentIdx(next)
    else setCurrentIdx(-1)
  }

  function skip(idx: number) {
    const next = numbers.findIndex((_, i) => i > idx && !sentSet.has(i))
    if (next !== -1) setCurrentIdx(next)
    else setCurrentIdx(-1)
  }

  async function copyMessage() {
    await navigator.clipboard.writeText(messageText)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const stepLabel = (n: number, label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: step >= n ? NEON : 'transparent', border: `1.5px solid ${step >= n ? NEON : BORDER}`,
        color: step >= n ? '#000' : MUTED, fontSize: 11, fontWeight: 700, ...fontDisplay, flexShrink: 0,
      }}>{n}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: step >= n ? '#fff' : MUTED, ...fontDisplay, letterSpacing: '0.05em' }}>{label}</span>
    </div>
  )

  const sentCount = sentSet.size
  const allDone = sentCount === numbers.length && numbers.length > 0

  return (
    <div style={{ minHeight: '100vh', background: '#000', ...font }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#fff', margin: 0, ...fontDisplay }}>
            WhatsApp <span style={{ color: NEON }}>Sender</span>
          </h1>
          <p style={{ color: MUTED, fontSize: 13, marginTop: 6 }}>
            Upload a photo with client numbers, compose your message, send directly via WhatsApp.
          </p>
        </div>

        {/* Step bar */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 28, padding: '12px 16px', background: CARD, borderRadius: 10, border: `1px solid ${BORDER}`, flexWrap: 'wrap' }}>
          {stepLabel(1, 'Upload')}
          <span style={{ color: BORDER, alignSelf: 'center' }}>›</span>
          {stepLabel(2, 'Numbers')}
          <span style={{ color: BORDER, alignSelf: 'center' }}>›</span>
          {stepLabel(3, 'Message')}
          <span style={{ color: BORDER, alignSelf: 'center' }}>›</span>
          {stepLabel(4, 'Send')}
        </div>

        {error && (
          <div style={{ background: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#ff8080', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 28 }}>
            <p style={{ color: MUTED, fontSize: 13, marginBottom: 20 }}>
              Upload a screenshot or photo containing client phone numbers. OCR runs in your browser — nothing is uploaded.
            </p>
            <div
              onClick={() => !loading && fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragOver ? NEON : imageFile ? NEON_BORDER : BORDER}`, borderRadius: 10,
                padding: 28, textAlign: 'center', cursor: loading ? 'default' : 'pointer',
                background: dragOver ? NEON_DIM : imageFile ? 'rgba(215,255,0,0.04)' : 'transparent',
                transition: 'all 0.2s', marginBottom: 20,
              }}
            >
              {imagePreview
                ? <img src={imagePreview} alt="Preview" style={{ maxHeight: 220, maxWidth: '100%', borderRadius: 8, objectFit: 'contain' }} />
                : <>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
                    <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, ...fontDisplay }}>Drop image here</div>
                    <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>or click to browse — JPG, PNG, WEBP</div>
                  </>
              }
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageSelect(f) }} />
            {imageFile && !loading && (
              <div style={{ marginBottom: 16, fontSize: 12, color: MUTED }}>
                {imageFile.name}
                <button onClick={() => { setImageFile(null); setImagePreview(null) }}
                  style={{ marginLeft: 10, color: 'rgba(255,80,80,0.7)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>Remove</button>
              </div>
            )}
            {loading && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: MUTED, fontSize: 12 }}>Reading image…</span>
                  <span style={{ color: NEON, fontSize: 12, ...fontDisplay }}>{progress}%</span>
                </div>
                <div style={{ height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: NEON, borderRadius: 2, transition: 'width 0.2s' }} />
                </div>
              </div>
            )}
            <button onClick={extractNumbers} disabled={!imageFile || loading} style={{
              width: '100%', padding: '12px', borderRadius: 8, border: 'none',
              cursor: imageFile && !loading ? 'pointer' : 'not-allowed',
              background: imageFile && !loading ? NEON : 'rgba(215,255,0,0.25)',
              color: '#000', fontWeight: 700, fontSize: 14, ...fontDisplay, transition: 'all 0.2s',
            }}>
              {loading ? `Scanning… ${progress}%` : 'Extract Numbers'}
            </button>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 28 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 4px', ...fontDisplay }}>Review Numbers</h2>
            <p style={{ color: MUTED, fontSize: 12, margin: '0 0 20px' }}>{numbers.length} found — delete wrong ones or add missing ones</p>
            {numbers.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {numbers.map(n => (
                  <div key={n} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: NEON_DIM, border: `1px solid ${NEON_BORDER}`,
                    borderRadius: 6, padding: '5px 10px', fontSize: 13, color: '#fff', ...fontDisplay,
                  }}>
                    {n}
                    <button onClick={() => setNumbers(prev => prev.filter(x => x !== n))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 14, lineHeight: 1, padding: 0 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              <input type="text" value={newNumber} onChange={e => setNewNumber(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addNumber()} placeholder="+971501234567"
                style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 13, ...font, outline: 'none' }} />
              <button onClick={addNumber} style={{
                padding: '9px 16px', borderRadius: 8, border: `1px solid ${NEON_BORDER}`,
                background: NEON_DIM, color: NEON, fontSize: 13, fontWeight: 600, cursor: 'pointer', ...fontDisplay,
              }}>+ Add</button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: '11px', borderRadius: 8, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, fontSize: 13, cursor: 'pointer', ...fontDisplay }}>← Back</button>
              <button onClick={() => setStep(3)} disabled={numbers.length === 0} style={{
                flex: 2, padding: '11px', borderRadius: 8, border: 'none',
                background: numbers.length > 0 ? NEON : 'rgba(215,255,0,0.25)',
                color: '#000', fontWeight: 700, fontSize: 14, cursor: numbers.length > 0 ? 'pointer' : 'not-allowed', ...fontDisplay,
              }}>Continue →</button>
            </div>
          </div>
        )}

        {/* ── STEP 3 ── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#fff', ...fontDisplay, display: 'block', marginBottom: 10 }}>Message Text</label>
              <textarea value={messageText} onChange={e => setMessageText(e.target.value)}
                placeholder="Type the message you want to send to clients…"
                style={{ width: '100%', height: 160, background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 13, ...font, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#fff', ...fontDisplay, display: 'block', marginBottom: 6 }}>
                Attach Photo <span style={{ color: MUTED, fontWeight: 400 }}>(optional)</span>
              </label>
              <p style={{ color: MUTED, fontSize: 11, margin: '0 0 12px' }}>You'll attach this manually in each WhatsApp chat when sending.</p>
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

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, padding: '12px', borderRadius: 8, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, fontSize: 13, cursor: 'pointer', ...fontDisplay }}>← Back</button>
              <button onClick={startSession} disabled={!messageText.trim()} style={{
                flex: 2, padding: '14px', borderRadius: 8, border: 'none',
                background: messageText.trim() ? NEON : 'rgba(215,255,0,0.25)',
                color: '#000', fontWeight: 700, fontSize: 15, cursor: messageText.trim() ? 'pointer' : 'not-allowed', ...fontDisplay,
              }}>
                Start Sending {numbers.length} Messages →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: SEND SESSION ── */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Progress bar */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, ...fontDisplay }}>
                  {allDone ? '🎉 All sent!' : `Sending… ${sentCount} / ${numbers.length}`}
                </span>
                <span style={{ color: NEON, fontSize: 13, ...fontDisplay }}>{Math.round((sentCount / numbers.length) * 100)}%</span>
              </div>
              <div style={{ height: 6, background: BORDER, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(sentCount / numbers.length) * 100}%`, background: NEON, borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
            </div>

            {/* Current contact */}
            {!allDone && currentIdx !== -1 && (
              <div style={{ background: CARD, border: `1px solid ${NEON_BORDER}`, borderRadius: 12, padding: 24 }}>
                <div style={{ fontSize: 11, color: MUTED, letterSpacing: '0.08em', ...fontDisplay, marginBottom: 8 }}>CURRENT</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', ...fontDisplay, marginBottom: 4 }}>{numbers[currentIdx]}</div>
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 24 }}>Contact {currentIdx + 1} of {numbers.length}</div>

                {mediaFile && mediaPreview && (
                  <div style={{ background: 'rgba(215,255,0,0.06)', border: `1px solid ${NEON_BORDER}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: NEON }}>
                    📎 Remember to attach <strong>{mediaFile.name}</strong> in the WhatsApp chat
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => { openWhatsApp(currentIdx); }}
                    style={{
                      flex: 2, padding: '14px', borderRadius: 8, border: 'none',
                      background: NEON, color: '#000', fontWeight: 700, fontSize: 15, cursor: 'pointer', ...fontDisplay,
                    }}>
                    Open in WhatsApp ↗
                  </button>
                  <button onClick={() => skip(currentIdx)} style={{
                    flex: 1, padding: '14px', borderRadius: 8, border: `1px solid ${BORDER}`,
                    background: 'transparent', color: MUTED, fontSize: 13, cursor: 'pointer', ...fontDisplay,
                  }}>Skip</button>
                </div>

                <button onClick={() => markSentAndNext(currentIdx)} style={{
                  width: '100%', marginTop: 10, padding: '12px', borderRadius: 8,
                  border: `1px solid ${NEON_BORDER}`, background: NEON_DIM,
                  color: NEON, fontWeight: 600, fontSize: 14, cursor: 'pointer', ...fontDisplay,
                }}>
                  ✓ Mark as Sent → Next
                </button>
              </div>
            )}

            {/* All done state */}
            {(allDone || currentIdx === -1) && (
              <div style={{ background: CARD, border: `1px solid ${NEON_BORDER}`, borderRadius: 12, padding: 28, textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', ...fontDisplay, marginBottom: 8 }}>
                  {allDone ? 'All messages sent!' : 'Session complete'}
                </div>
                <div style={{ fontSize: 13, color: MUTED, marginBottom: 24 }}>
                  {sentCount} of {numbers.length} contacts messaged
                </div>
                <button onClick={() => { setStep(1); setNumbers([]); setMessageText(''); setMediaFile(null); setMediaPreview(null); setImageFile(null); setImagePreview(null); setSentSet(new Set()); setCurrentIdx(0) }}
                  style={{ padding: '12px 32px', borderRadius: 8, border: 'none', background: NEON, color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer', ...fontDisplay }}>
                  Start New Batch
                </button>
              </div>
            )}

            {/* Contact list */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}` }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', ...fontDisplay }}>All Contacts</span>
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {numbers.map((n, i) => {
                  const isSent = sentSet.has(i)
                  const isCurrent = i === currentIdx && !allDone
                  return (
                    <div key={n} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 20px', borderBottom: `1px solid ${BORDER}`,
                      background: isCurrent ? NEON_DIM : 'transparent',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                          width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isSent ? NEON : isCurrent ? 'rgba(215,255,0,0.3)' : 'transparent',
                          border: `1.5px solid ${isSent ? NEON : isCurrent ? NEON : BORDER}`,
                          fontSize: 10, color: isSent ? '#000' : MUTED, flexShrink: 0,
                        }}>
                          {isSent ? '✓' : i + 1}
                        </span>
                        <span style={{ fontSize: 13, color: isSent ? MUTED : '#fff', textDecoration: isSent ? 'line-through' : 'none', ...fontDisplay }}>{n}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {!isSent && (
                          <button onClick={() => { setCurrentIdx(i) }} style={{
                            padding: '4px 10px', borderRadius: 5, border: `1px solid ${BORDER}`,
                            background: 'transparent', color: MUTED, fontSize: 11, cursor: 'pointer', ...fontDisplay,
                          }}>Go</button>
                        )}
                        {isSent && <span style={{ color: NEON, fontSize: 11, ...fontDisplay }}>Sent</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { copyMessage() }} style={{
                flex: 1, padding: '10px', borderRadius: 8, border: `1px solid ${NEON_BORDER}`,
                background: NEON_DIM, color: copied ? NEON : '#fff', fontSize: 13, cursor: 'pointer', ...fontDisplay,
              }}>
                {copied ? '✓ Copied!' : '⎘ Copy Message'}
              </button>
              <button onClick={() => setStep(3)} style={{
                flex: 1, padding: '10px', borderRadius: 8, border: `1px solid ${BORDER}`,
                background: 'transparent', color: MUTED, fontSize: 13, cursor: 'pointer', ...fontDisplay,
              }}>← Edit Message</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
