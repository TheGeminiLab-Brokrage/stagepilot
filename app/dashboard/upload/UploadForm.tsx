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
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          dragging ? 'border-blue-500 bg-blue-500/5' : 'border-gray-700 hover:border-gray-500'
        }`}
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
            <p className="text-white font-medium">{file.name}</p>
            <p className="text-gray-500 text-sm mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            {status === 'idle' && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); removeFile() }}
                className="text-xs text-gray-600 hover:text-red-400 mt-2 transition-colors"
              >
                {t('uploadRemoveFile')}
              </button>
            )}
          </div>
        ) : (
          <div>
            <p className="text-gray-400">{t('uploadDropZone')}</p>
            <p className="text-gray-600 text-sm mt-1">{t('uploadClickBrowse')}</p>
            <p className="text-gray-700 text-xs mt-3">{t('uploadSupportedFormats')}</p>
          </div>
        )}
      </div>

      {/* Stage selector */}
      <div>
        <label className="block text-xs text-gray-500 mb-1.5 font-medium uppercase tracking-wide">
          {t('uploadStageLabel')} <span className="text-red-400">*</span>
        </label>
        <select
          value={agentStage}
          onChange={e => setAgentStage(e.target.value)}
          required
          className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="" disabled>{t('uploadStagePlaceholder')}</option>
          {STAGES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3">
          {errorMsg}
        </div>
      )}

      {status === 'done' && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg px-4 py-3">
          {t('uploadSuccess')}
        </div>
      )}

      {status === 'uploading' && uploadPct > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>{t('uploadUploading')}</span>
            <span>{uploadPct}%</span>
          </div>
          <div className="bg-gray-800 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ background: '#D7FF00' }}
              style={{ width: `${uploadPct}%` }}
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={!file || !agentStage || status === 'uploading' || status === 'done'}
        className="w-full disabled:opacity-40 disabled:cursor-not-allowed font-bold rounded-lg py-2.5 text-sm transition-all tgl-btn-glow"
        style={{ background: '#D7FF00', color: '#000', letterSpacing: '0.04em' }}
      >
        {status === 'uploading' ? t('uploadSubmittingBtn') : t('uploadSubmitBtn')}
      </button>
    </form>
  )
}
