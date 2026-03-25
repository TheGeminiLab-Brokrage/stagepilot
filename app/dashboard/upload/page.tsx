'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

const ACCEPTED = '.m4a,.mp3,.mp4,.wav,.ogg,.amr,.aac,.flac'

export default function UploadPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [agentName, setAgentName] = useState('')
  const [team, setTeam] = useState('')
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return

    setStatus('uploading')
    setErrorMsg('')

    // Step 1: Create the call record (metadata only — no file, avoids Vercel's 4.5 MB body limit)
    const meta = new FormData()
    meta.append('fileName', file.name)
    meta.append('agentName', agentName)
    meta.append('team', team)

    const metaRes = await fetch('/api/process-call', { method: 'POST', body: meta })
    if (!metaRes.ok) {
      const data = await metaRes.json().catch(() => ({}))
      setErrorMsg(data.error ?? 'Something went wrong. Please try again.')
      setStatus('error')
      return
    }
    const { callRecordId } = await metaRes.json()

    // Step 2: Send the file directly to n8n (bypasses Vercel — no size limit)
    const n8nForm = new FormData()
    n8nForm.append('file', file, file.name)
    n8nForm.append('fileName', file.name)
    n8nForm.append('agentName', agentName)
    n8nForm.append('team', team)
    n8nForm.append('callRecordId', callRecordId)

    const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL!
    const n8nRes = await fetch(webhookUrl, { method: 'POST', body: n8nForm })
    if (!n8nRes.ok) {
      setErrorMsg('Failed to send file for processing. Please try again.')
      setStatus('error')
      return
    }

    setStatus('done')
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Upload Call Recording</h1>
        <p className="text-sm text-gray-500 mt-1">
          Your recording will be transcribed and categorized automatically. Audio is never stored.
        </p>
      </div>

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
            onChange={e => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div>
              <p className="text-white font-medium">{file.name}</p>
              <p className="text-gray-500 text-sm mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setFile(null) }}
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

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Your name
          </label>
          <input
            type="text"
            required
            value={agentName}
            onChange={e => setAgentName(e.target.value)}
            placeholder="e.g. Mohammed Shaaban"
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Team
          </label>
          <input
            type="text"
            required
            value={team}
            onChange={e => setTeam(e.target.value)}
            placeholder="e.g. Youssef"
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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

        <button
          type="submit"
          disabled={!file || status === 'uploading' || status === 'done'}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
        >
          {status === 'uploading' ? 'Uploading…' : 'Process Call'}
        </button>
      </form>
    </div>
  )
}
