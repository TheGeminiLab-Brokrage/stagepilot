'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/language-context'

const ACCEPTED = '.m4a,.mp3,.mp4,.wav,.ogg,.amr,.aac,.flac,.webm,.mpeg,.mpga'
const SUPPORTED_EXTENSIONS = ['mp3', 'm4a', 'mp4', 'wav', 'ogg', 'amr', 'aac', 'flac', 'webm', 'mpeg', 'mpga']

const STAGES = [
  'interested / follow up',
  'potential to close',
  'meeting scheduled',
  'not interested',
  'low budget',
]

function validateFile(f: File): string | null {
  const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) {
    return `"${f.name}" has an unsupported format${ext ? ` (.${ext})` : ' (no extension)'}. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}.`
  }
  return null
}

export default function UploadForm() {
  const t = useT()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [agentStage, setAgentStage] = useState('')
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [uploadPct, setUploadPct] = useState(0)
  const [pendingCallId, setPendingCallId] = useState<string | null>(null)

  async function removeFile() {
    xhrRef.current?.abort()
    xhrRef.current = null
    // Clean up any record that was already created before the upload was cancelled
    if (pendingCallId) {
      await fetch('/api/delete-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: pendingCallId }),
      }).catch(() => {})
      setPendingCallId(null)
    }
    setFile(null)
    setStatus('idle')
    setErrorMsg('')
    setUploadPct(0)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (!f) return
    const err = validateFile(f)
    if (err) { setErrorMsg(err); return }
    setErrorMsg('')
    setFile(f)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !agentStage) return

    setStatus('uploading')
    setErrorMsg('')
    setUploadPct(0)

    // Step 1: Create the call record — server returns callRecordId + pre-computed audioPath
    const meta = new FormData()
    meta.append('fileName', file.name)
    meta.append('agentStage', agentStage)

    const metaRes = await fetch('/api/process-call', { method: 'POST', body: meta })
    if (!metaRes.ok) {
      const data = await metaRes.json().catch(() => ({}))
      setErrorMsg(data.error ?? 'Something went wrong. Please try again.')
      setStatus('error')
      return
    }
    const { callRecordId, audioPath } = await metaRes.json()
    setPendingCallId(callRecordId)

    // Step 2: Fire Supabase Storage upload + n8n XHR in parallel
    const supabase = createClient()

    const storageUploadPromise = supabase.storage
      .from('call-recordings')
      .upload(audioPath, file, { contentType: file.type, upsert: false })
      .then(({ error }) => {
        if (error) throw new Error(`Storage upload failed: ${error.message}`)
      })

    const n8nForm = new FormData()
    n8nForm.append('file', file, file.name)
    n8nForm.append('fileName', file.name)
    n8nForm.append('callRecordId', callRecordId)
    n8nForm.append('agentStage', agentStage)

    const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL!

    const n8nUploadPromise = new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhrRef.current = xhr
      xhr.open('POST', webhookUrl)

      xhr.upload.onprogress = e => {
        if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100))
      }
      xhr.upload.onload = () => { setUploadPct(100); resolve() }
      xhr.onerror = () => reject(new Error('Network error sending file to n8n'))
      xhr.onabort = () => reject(new Error('Upload cancelled'))

      xhr.send(n8nForm)
    })

    let uploadFailed = false
    await Promise.all([storageUploadPromise, n8nUploadPromise]).catch(async err => {
      uploadFailed = true
      // Delete the orphaned processing record so it doesn't stay stuck
      await fetch('/api/delete-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: callRecordId }),
      }).catch(() => {})
      setPendingCallId(null)
      setErrorMsg(err.message ?? 'Upload failed. Please try again.')
      setStatus('error')
    })

    if (uploadFailed) return

    setStatus('done')
    setTimeout(() => router.push('/dashboard'), 1000)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? 'rgba(215,255,0,0.6)' : 'rgba(215,255,0,0.18)'}`,
          background: dragging ? 'rgba(215,255,0,0.04)' : 'rgba(255,255,255,0.02)',
          borderRadius: 14,
          padding: '40px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color 0.2s, background 0.2s',
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (!f) return
            const err = validateFile(f)
            if (err) { setErrorMsg(err); e.target.value = ''; return }
            setErrorMsg('')
            setFile(f)
          }}
        />
        {file ? (
          <div>
            <p style={{ color: '#D7FF00', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>{file.name}</p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 4 }}>{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            {status === 'idle' && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); removeFile() }}
                style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 8, background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
              >
                {t('uploadRemoveFile')}
              </button>
            )}
          </div>
        ) : (
          <div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontFamily: "'Space Grotesk', sans-serif" }}>{t('uploadDropZone')}</p>
            <p style={{ color: 'rgba(215,255,0,0.4)', fontSize: 13, marginTop: 4 }}>{t('uploadClickBrowse')}</p>
            <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 11, marginTop: 12, letterSpacing: '0.04em' }}>{t('uploadSupportedFormats')}</p>
          </div>
        )}
      </div>

      {/* Stage selector */}
      <div>
        <label style={{ display: 'block', fontSize: 11, color: 'rgba(215,255,0,0.5)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Space Grotesk', sans-serif" }}>
          {t('uploadStageLabel')} <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <select
          value={agentStage}
          onChange={e => setAgentStage(e.target.value)}
          required
          style={{
            width: '100%',
            background: 'rgba(215,255,0,0.04)',
            border: '1px solid rgba(215,255,0,0.2)',
            color: agentStage ? '#fff' : 'rgba(255,255,255,0.35)',
            fontSize: 14,
            borderRadius: 10,
            padding: '10px 14px',
            outline: 'none',
            fontFamily: "'Space Grotesk', sans-serif",
            cursor: 'pointer',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(215,255,0,0.5)' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 14px center',
            paddingRight: 36,
          }}
          onFocus={e => { e.currentTarget.style.border = '1px solid rgba(215,255,0,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(215,255,0,0.06)' }}
          onBlur={e => { e.currentTarget.style.border = '1px solid rgba(215,255,0,0.2)'; e.currentTarget.style.boxShadow = 'none' }}
        >
          <option value="" disabled style={{ background: '#111', color: 'rgba(255,255,255,0.35)' }}>{t('uploadStagePlaceholder')}</option>
          {STAGES.map(s => (
            <option key={s} value={s} style={{ background: '#111', color: '#fff' }}>{s}</option>
          ))}
        </select>
      </div>

      {errorMsg && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 13, borderRadius: 10, padding: '12px 16px' }}>
          {errorMsg}
        </div>
      )}

      {status === 'done' && (
        <div style={{ background: 'rgba(215,255,0,0.06)', border: '1px solid rgba(215,255,0,0.2)', color: '#D7FF00', fontSize: 13, borderRadius: 10, padding: '12px 16px' }}>
          {t('uploadSuccess')}
        </div>
      )}

      {status === 'uploading' && uploadPct > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(215,255,0,0.4)', fontFamily: "'Space Grotesk', sans-serif" }}>
            <span>{t('uploadUploading')}</span>
            <span>{uploadPct}%</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 99, height: 4 }}>
            <div
              style={{ width: `${uploadPct}%`, background: '#D7FF00', height: 4, borderRadius: 99, transition: 'width 0.2s', boxShadow: '0 0 8px rgba(215,255,0,0.4)' }}
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={!file || !agentStage || status === 'uploading' || status === 'done'}
        className="tgl-btn-glow"
        style={{
          width: '100%',
          background: '#D7FF00',
          color: '#000',
          fontWeight: 700,
          borderRadius: 10,
          padding: '11px 0',
          fontSize: 14,
          letterSpacing: '0.06em',
          fontFamily: "'Space Grotesk', sans-serif",
          border: 'none',
          cursor: 'pointer',
          transition: 'opacity 0.15s',
          opacity: (!file || !agentStage || status === 'uploading' || status === 'done') ? 0.4 : 1,
        }}
      >
        {status === 'uploading' ? t('uploadSubmittingBtn') : t('uploadSubmitBtn')}
      </button>
    </form>
  )
}
