'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

const ACCEPTED = '.m4a,.mp3,.mp4,.wav,.ogg,.amr,.aac,.flac,.webm,.mpeg,.mpga'
const SUPPORTED_EXTENSIONS = ['mp3', 'm4a', 'mp4', 'wav', 'ogg', 'amr', 'aac', 'flac', 'webm', 'mpeg', 'mpga']

function validateFile(f: File): string | null {
  const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) {
    return `"${f.name}" has an unsupported format${ext ? ` (.${ext})` : ' (no extension)'}. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}.`
  }
  return null
}

export default function UploadForm() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [uploadPct, setUploadPct] = useState(0)

  function removeFile() {
    xhrRef.current?.abort()
    xhrRef.current = null
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
    if (!file) return

    setStatus('uploading')
    setErrorMsg('')
    setUploadPct(0)

    // Step 1: Create the call record (metadata only)
    const meta = new FormData()
    meta.append('fileName', file.name)

    const metaRes = await fetch('/api/process-call', { method: 'POST', body: meta })
    if (!metaRes.ok) {
      const data = await metaRes.json().catch(() => ({}))
      setErrorMsg(data.error ?? 'Something went wrong. Please try again.')
      setStatus('error')
      return
    }
    const { callRecordId } = await metaRes.json()

    // Step 2: Send file directly to n8n via XHR so we can redirect as soon as
    // the upload is sent — no need to wait for n8n to finish processing (minutes)
    const n8nForm = new FormData()
    n8nForm.append('file', file, file.name)
    n8nForm.append('fileName', file.name)
    n8nForm.append('callRecordId', callRecordId)

    const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL!

    let uploadFailed = false
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhrRef.current = xhr
      xhr.open('POST', webhookUrl)

      // Track upload progress
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100))
      }

      // File fully sent to n8n → redirect immediately, no need to wait for processing
      xhr.upload.onload = () => {
        setUploadPct(100)
        resolve()
      }

      xhr.onerror = () => reject(new Error('Network error sending file to n8n'))
      xhr.onabort = () => reject(new Error('Upload cancelled'))

      xhr.send(n8nForm)
    }).catch(err => {
      uploadFailed = true
      setErrorMsg(err.message ?? 'Failed to send file for processing.')
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
            <button
              type="button"
              onClick={e => { e.stopPropagation(); removeFile() }}
              className="text-xs text-gray-600 hover:text-red-400 mt-2 transition-colors"
            >
              Remove
            </button>
          </div>
        ) : (
          <div>
            <p className="text-gray-400">Drag & drop audio file here</p>
            <p className="text-gray-600 text-sm mt-1">or click to browse</p>
            <p className="text-gray-700 text-xs mt-3">M4A, MP3, WAV, AMR, AAC, FLAC supported</p>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3">
          {errorMsg}
        </div>
      )}

      {status === 'done' && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg px-4 py-3">
          Uploaded! Processing in the background — redirecting…
        </div>
      )}

      {status === 'uploading' && uploadPct > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Uploading…</span>
            <span>{uploadPct}%</span>
          </div>
          <div className="bg-gray-800 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${uploadPct}%` }}
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={!file || status === 'uploading' || status === 'done'}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
      >
        {status === 'uploading' ? 'Uploading…' : 'Process Call'}
      </button>
    </form>
  )
}
