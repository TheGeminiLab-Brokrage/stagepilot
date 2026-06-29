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

export default function WhatsAppClient() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [numbers, setNumbers] = useState<string[]>([])
  const [newNumber, setNewNumber] = useState('')
  const [messageText, setMessageText] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [mediaDragOver, setMediaDragOver] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setError(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleImageSelect(file)
  }, [handleImageSelect])

  const handleMediaSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    setMediaFile(file)
    setMediaPreview(URL.createObjectURL(file))
  }, [])

  const handleMediaDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setMediaDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleMediaSelect(file)
  }, [handleMediaSelect])

  async function extractNumbers() {
    if (!imageFile) return
    setLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('image', imageFile)
      const res = await fetch('/api/whatsapp/extract-numbers', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to extract numbers')
      setNumbers(json.numbers ?? [])
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  function addNumber() {
    const n = newNumber.trim()
    if (!n || numbers.includes(n)) return
    setNumbers(prev => [...prev, n])
    setNewNumber('')
  }

  function removeNumber(n: string) {
    setNumbers(prev => prev.filter(x => x !== n))
  }

  function downloadCSV() {
    const rows = ['Phone Number', ...numbers].join('\n')
    const blob = new Blob([rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'whatsapp-numbers.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function copyMessage() {
    await navigator.clipboard.writeText(messageText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function downloadMedia() {
    if (!mediaFile || !mediaPreview) return
    const a = document.createElement('a')
    a.href = mediaPreview
    a.download = mediaFile.name
    a.click()
  }

  const stepLabel = (n: number, label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: step >= n ? NEON : 'transparent',
        border: `1.5px solid ${step >= n ? NEON : BORDER}`,
        color: step >= n ? '#000' : MUTED,
        fontSize: 11, fontWeight: 700, ...fontDisplay,
        flexShrink: 0,
      }}>{n}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: step >= n ? '#fff' : MUTED, ...fontDisplay, letterSpacing: '0.05em' }}>
        {label}
      </span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#000', ...font }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#fff', margin: 0, ...fontDisplay }}>
            WhatsApp <span style={{ color: NEON }}>Sender</span>
          </h1>
          <p style={{ color: MUTED, fontSize: 13, marginTop: 6, ...font }}>
            Upload a photo with client numbers, compose your message, export for Prime Sender.
          </p>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 28, padding: '12px 16px', background: CARD, borderRadius: 10, border: `1px solid ${BORDER}` }}>
          {stepLabel(1, 'Upload Photo')}
          <span style={{ color: BORDER, alignSelf: 'center' }}>›</span>
          {stepLabel(2, 'Review Numbers')}
          <span style={{ color: BORDER, alignSelf: 'center' }}>›</span>
          {stepLabel(3, 'Compose & Export')}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#ff8080', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* ── STEP 1: Upload numbers image ── */}
        {step === 1 && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 28 }}>
            <p style={{ color: MUTED, fontSize: 13, marginBottom: 20 }}>
              Upload a screenshot or photo that contains client phone numbers. AI will extract them automatically.
            </p>

            {/* Drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragOver ? NEON : imageFile ? NEON_BORDER : BORDER}`,
                borderRadius: 10,
                padding: 28,
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? NEON_DIM : imageFile ? 'rgba(215,255,0,0.04)' : 'transparent',
                transition: 'all 0.2s',
                marginBottom: 20,
              }}
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{ maxHeight: 220, maxWidth: '100%', borderRadius: 8, objectFit: 'contain' }}
                />
              ) : (
                <>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
                  <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, ...fontDisplay }}>Drop image here</div>
                  <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>or click to browse — JPG, PNG, WEBP</div>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageSelect(f) }}
            />

            {imageFile && (
              <div style={{ marginBottom: 16, fontSize: 12, color: MUTED }}>
                {imageFile.name}
                <button
                  onClick={() => { setImageFile(null); setImagePreview(null) }}
                  style={{ marginLeft: 10, color: 'rgba(255,80,80,0.7)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}
                >
                  Remove
                </button>
              </div>
            )}

            <button
              onClick={extractNumbers}
              disabled={!imageFile || loading}
              style={{
                width: '100%', padding: '12px', borderRadius: 8, border: 'none', cursor: imageFile && !loading ? 'pointer' : 'not-allowed',
                background: imageFile && !loading ? NEON : 'rgba(215,255,0,0.25)',
                color: '#000', fontWeight: 700, fontSize: 14, ...fontDisplay, letterSpacing: '0.04em',
                transition: 'all 0.2s',
              }}
            >
              {loading ? 'Extracting numbers…' : 'Extract Numbers with AI'}
            </button>
          </div>
        )}

        {/* ── STEP 2: Review numbers ── */}
        {step === 2 && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0, ...fontDisplay }}>Extracted Numbers</h2>
                <p style={{ color: MUTED, fontSize: 12, margin: '4px 0 0' }}>{numbers.length} number{numbers.length !== 1 ? 's' : ''} found</p>
              </div>
            </div>

            {/* Number chips */}
            {numbers.length === 0 ? (
              <p style={{ color: MUTED, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                No numbers detected. Add them manually below.
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {numbers.map(n => (
                  <div key={n} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: NEON_DIM, border: `1px solid ${NEON_BORDER}`,
                    borderRadius: 6, padding: '5px 10px', fontSize: 13, color: '#fff', ...fontDisplay,
                  }}>
                    {n}
                    <button
                      onClick={() => removeNumber(n)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 14, lineHeight: 1, padding: 0 }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Manual add */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              <input
                type="text"
                value={newNumber}
                onChange={e => setNewNumber(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addNumber()}
                placeholder="+971501234567"
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`,
                  borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 13, ...font, outline: 'none',
                }}
              />
              <button
                onClick={addNumber}
                style={{
                  padding: '9px 16px', borderRadius: 8, border: `1px solid ${NEON_BORDER}`,
                  background: NEON_DIM, color: NEON, fontSize: 13, fontWeight: 600, cursor: 'pointer', ...fontDisplay,
                }}
              >
                + Add
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1, padding: '11px', borderRadius: 8, border: `1px solid ${BORDER}`,
                  background: 'transparent', color: MUTED, fontSize: 13, cursor: 'pointer', ...fontDisplay,
                }}
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={numbers.length === 0}
                style={{
                  flex: 2, padding: '11px', borderRadius: 8, border: 'none',
                  background: numbers.length > 0 ? NEON : 'rgba(215,255,0,0.25)',
                  color: '#000', fontWeight: 700, fontSize: 14, cursor: numbers.length > 0 ? 'pointer' : 'not-allowed', ...fontDisplay,
                }}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Compose & Export ── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Message box */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#fff', ...fontDisplay, display: 'block', marginBottom: 10 }}>
                Message Text
              </label>
              <textarea
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                placeholder="Type the message you want to send to clients…"
                style={{
                  width: '100%', height: 160, background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 12px',
                  color: '#fff', fontSize: 13, ...font, resize: 'vertical', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Media attachment */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#fff', ...fontDisplay, display: 'block', marginBottom: 10 }}>
                Attach Photo <span style={{ color: MUTED, fontWeight: 400 }}>(optional)</span>
              </label>

              {mediaPreview ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <img src={mediaPreview} alt="Media" style={{ height: 80, width: 80, objectFit: 'cover', borderRadius: 8, border: `1px solid ${BORDER}` }} />
                  <div>
                    <div style={{ color: '#fff', fontSize: 13 }}>{mediaFile?.name}</div>
                    <button
                      onClick={() => { setMediaFile(null); setMediaPreview(null) }}
                      style={{ color: 'rgba(255,80,80,0.7)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 0, marginTop: 4 }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => mediaInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setMediaDragOver(true) }}
                  onDragLeave={() => setMediaDragOver(false)}
                  onDrop={handleMediaDrop}
                  style={{
                    border: `2px dashed ${mediaDragOver ? NEON : BORDER}`,
                    borderRadius: 8, padding: '18px', textAlign: 'center', cursor: 'pointer',
                    background: mediaDragOver ? NEON_DIM : 'transparent', transition: 'all 0.2s',
                  }}
                >
                  <div style={{ color: MUTED, fontSize: 13 }}>Drop image or <span style={{ color: NEON, textDecoration: 'underline' }}>browse</span></div>
                </div>
              )}
              <input
                ref={mediaInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleMediaSelect(f) }}
              />
            </div>

            {/* Export buttons */}
            <div style={{ background: CARD, border: `1px solid ${NEON_BORDER}`, borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: NEON, margin: '0 0 6px', ...fontDisplay }}>
                Export for Prime Sender
              </h3>
              <p style={{ fontSize: 12, color: MUTED, margin: '0 0 18px' }}>
                {numbers.length} number{numbers.length !== 1 ? 's' : ''} ready to send.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={downloadCSV}
                  style={{
                    padding: '12px', borderRadius: 8, border: 'none',
                    background: NEON, color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer', ...fontDisplay,
                  }}
                >
                  ↓ Download Numbers CSV
                </button>

                <button
                  onClick={copyMessage}
                  disabled={!messageText.trim()}
                  style={{
                    padding: '12px', borderRadius: 8, border: `1px solid ${NEON_BORDER}`,
                    background: NEON_DIM, color: copied ? NEON : '#fff', fontWeight: 600,
                    fontSize: 14, cursor: messageText.trim() ? 'pointer' : 'not-allowed', ...fontDisplay,
                    transition: 'color 0.2s',
                  }}
                >
                  {copied ? '✓ Copied!' : '⎘ Copy Message Text'}
                </button>

                {mediaFile && (
                  <button
                    onClick={downloadMedia}
                    style={{
                      padding: '12px', borderRadius: 8, border: `1px solid ${BORDER}`,
                      background: 'transparent', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', ...fontDisplay,
                    }}
                  >
                    ↓ Download Media Photo
                  </button>
                )}
              </div>
            </div>

            {/* Prime Sender instructions */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
              <button
                onClick={() => setShowInstructions(v => !v)}
                style={{
                  width: '100%', padding: '14px 20px', background: 'none', border: 'none',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', ...fontDisplay }}>How to use with Prime Sender</span>
                <span style={{ color: MUTED, fontSize: 14 }}>{showInstructions ? '▲' : '▼'}</span>
              </button>
              {showInstructions && (
                <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${BORDER}` }}>
                  <ol style={{ margin: '16px 0 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      'Download the Numbers CSV file above.',
                      'Copy your message text using the "Copy Message" button.',
                      'If you have a media photo, download it too.',
                      'Open WhatsApp Web in Chrome (web.whatsapp.com).',
                      'Open the Prime Sender extension and go to "Bulk Send".',
                      'Import the CSV file as your contacts list.',
                      'Paste your message in the Prime Sender message field.',
                      'If sending media, attach the downloaded photo in Prime Sender.',
                      'Start sending!',
                    ].map((step, i) => (
                      <li key={i} style={{ color: MUTED, fontSize: 13, lineHeight: 1.5 }}>
                        <span style={{ color: NEON, fontWeight: 700 }}>{i + 1}.</span> {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            <button
              onClick={() => setStep(2)}
              style={{
                padding: '10px', borderRadius: 8, border: `1px solid ${BORDER}`,
                background: 'transparent', color: MUTED, fontSize: 13, cursor: 'pointer', ...fontDisplay,
              }}
            >
              ← Back to Numbers
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
