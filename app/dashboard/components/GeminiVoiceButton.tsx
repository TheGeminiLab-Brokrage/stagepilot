'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Gemini Live API constants ─────────────────────────────────────────────────
const MODEL = 'models/gemini-3.1-flash-live-preview'
const WS_BASE =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'
const MIC_SAMPLE_RATE = 16000
const OUT_SAMPLE_RATE = 24000
const BUFFER_SIZE = 4096

const VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Zephyr', 'Orbit', 'Leda', 'Orus', 'Altair']

// ─── Types ─────────────────────────────────────────────────────────────────────
type Status = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error'

interface Turn {
  role: 'user' | 'assistant'
  text: string
}

interface ScenarioOption {
  id: string
  label: string
  defaultVoice?: string
}

// ─── Pure helpers ──────────────────────────────────────────────────────────────

function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const buf = new ArrayBuffer(input.length * 2)
  const view = new DataView(buf)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return buf
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToFloat32(b64: string): Float32Array | null {
  try {
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const int16 = new Int16Array(bytes.buffer)
    const float32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 0x8000
    return float32
  } catch {
    return null
  }
}

function concatFloat32(arrays: Float32Array[]): Float32Array {
  const total = arrays.reduce((n, a) => n + a.length, 0)
  const out = new Float32Array(total)
  let offset = 0
  for (const a of arrays) { out.set(a, offset); offset += a.length }
  return out
}

function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  const ratio = fromRate / toRate
  const outputLen = Math.floor(input.length / ratio)
  const output = new Float32Array(outputLen)
  for (let i = 0; i < outputLen; i++) {
    const pos = i * ratio
    const idx = Math.floor(pos)
    const frac = pos - idx
    const a = input[idx] ?? 0
    const b = input[Math.min(idx + 1, input.length - 1)] ?? 0
    output[i] = a + (b - a) * frac
  }
  return output
}

interface AiChunk {
  wallStart: number
  samples: Float32Array
}

function createStereoWavBlob(
  aiChunks: AiChunk[],
  micSamples: Float32Array[],
  sessionStartMs: number,
  sampleRate: number,
): Blob {
  let aiTrackLen = 0
  for (const chunk of aiChunks) {
    const offset = Math.round(((chunk.wallStart - sessionStartMs) / 1000) * sampleRate)
    if (offset >= 0) aiTrackLen = Math.max(aiTrackLen, offset + chunk.samples.length)
  }
  const ai = new Float32Array(Math.max(aiTrackLen, 1))
  for (const chunk of aiChunks) {
    const offset = Math.round(((chunk.wallStart - sessionStartMs) / 1000) * sampleRate)
    if (offset >= 0 && offset + chunk.samples.length <= ai.length) {
      ai.set(chunk.samples, offset)
    }
  }

  const micRaw = concatFloat32(micSamples)
  const mic = resampleLinear(micRaw, MIC_SAMPLE_RATE, sampleRate)

  const len = Math.max(ai.length, mic.length)
  const interleaved = new Int16Array(len * 2)
  for (let i = 0; i < len; i++) {
    const aiVal = ai[i] ?? 0
    const micVal = mic[i] ?? 0
    interleaved[i * 2]     = Math.max(-32768, Math.min(32767, Math.round(aiVal  * 32767)))
    interleaved[i * 2 + 1] = Math.max(-32768, Math.min(32767, Math.round(micVal * 32767)))
  }

  const dataLen = interleaved.buffer.byteLength
  const buf = new ArrayBuffer(44 + dataLen)
  const v = new DataView(buf)
  v.setUint32(0, 0x52494646, false)
  v.setUint32(4, 36 + dataLen, true)
  v.setUint32(8, 0x57415645, false)
  v.setUint32(12, 0x666d7420, false)
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 2, true)
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2 * 2, true)
  v.setUint16(32, 4, true)
  v.setUint16(34, 16, true)
  v.setUint32(36, 0x64617461, false)
  v.setUint32(40, dataLen, true)
  new Int16Array(buf, 44).set(interleaved)
  return new Blob([buf], { type: 'audio/wav' })
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function GeminiVoiceButton() {
  const [status, setStatus] = useState<Status>('idle')
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [selectedVoice, setSelectedVoice] = useState('Puck')
  const [scenarios, setScenarios] = useState<ScenarioOption[]>([])
  const [selectedScenario, setSelectedScenario] = useState<string>('')
  const [hasRecording, setHasRecording] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewPlaying, setPreviewPlaying] = useState(false)
  const [previewErrorMsg, setPreviewErrorMsg] = useState('')

  const statusRef = useRef<Status>('idle')
  const setStatusSync = useCallback((s: Status) => { statusRef.current = s; setStatus(s) }, [])

  const wsRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const playbackCtxRef = useRef<AudioContext | null>(null)
  const nextPlayTimeRef = useRef(0)
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([])
  const aiChunksRef = useRef<AiChunk[]>([])
  const micSamplesRef = useRef<Float32Array[]>([])
  const micStartWallRef = useRef(0)
  const ctxCreatedAtWallRef = useRef(0)
  const previewCtxRef = useRef<AudioContext | null>(null)
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const previewAbortRef = useRef(false)
  const intentionalCloseRef = useRef(false)
  const lastTurnCompleteRef = useRef(true)

  const selectedVoiceRef = useRef(selectedVoice)
  const selectedScenarioRef = useRef(selectedScenario)
  useEffect(() => { selectedVoiceRef.current = selectedVoice }, [selectedVoice])
  useEffect(() => { selectedScenarioRef.current = selectedScenario }, [selectedScenario])

  useEffect(() => {
    const scenario = scenarios.find(s => s.id === selectedScenario)
    if (scenario?.defaultVoice) setSelectedVoice(scenario.defaultVoice)
  }, [selectedScenario, scenarios])

  const transcriptRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    fetch('/api/gemini-scenarios')
      .then((r) => r.json())
      .then((list: ScenarioOption[]) => {
        setScenarios(list)
        if (list.length > 0) {
          setSelectedScenario(list[0].id)
          if (list[0].defaultVoice) setSelectedVoice(list[0].defaultVoice)
        }
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [turns])

  const stopMic = useCallback(() => {
    processorRef.current?.disconnect()
    sourceRef.current?.disconnect()
    audioCtxRef.current?.close().catch(() => {})
    streamRef.current?.getTracks().forEach((t) => t.stop())
    processorRef.current = null
    sourceRef.current = null
    audioCtxRef.current = null
    streamRef.current = null
  }, [])

  const stopPlayback = useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try { src.stop() } catch { /* already ended */ }
    }
    activeSourcesRef.current = []
    nextPlayTimeRef.current = 0
  }, [])

  const saveRecording = useCallback(() => {
    if (aiChunksRef.current.length === 0) return
    const blob = createStereoWavBlob(aiChunksRef.current, micSamplesRef.current, micStartWallRef.current, OUT_SAMPLE_RATE)
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    triggerDownload(blob, `gemini-session-${ts}.wav`)
    aiChunksRef.current = []
    micSamplesRef.current = []
    setHasRecording(false)
  }, [])

  const closeSession = useCallback(() => {
    if (aiChunksRef.current.length > 0) saveRecording()
    intentionalCloseRef.current = true
    wsRef.current?.close()
    wsRef.current = null
    stopMic()
    stopPlayback()
    playbackCtxRef.current?.close().catch(() => {})
    playbackCtxRef.current = null
    setStatusSync('idle')
    setOpen(false)
  }, [stopMic, stopPlayback, saveRecording, setStatusSync])

  useEffect(() => { return () => closeSession() }, [closeSession])

  const stopPreview = useCallback(() => {
    previewAbortRef.current = true
    try { previewSourceRef.current?.stop() } catch { /* ended */ }
    previewSourceRef.current = null
    previewCtxRef.current?.close().catch(() => {})
    previewCtxRef.current = null
    setPreviewPlaying(false)
    setPreviewLoading(false)
    setPreviewErrorMsg('')
  }, [])

  const playVoicePreview = useCallback(async (attempt = 0) => {
    if (previewPlaying || previewLoading) { stopPreview(); return }
    previewAbortRef.current = false
    setPreviewLoading(true)
    setPreviewErrorMsg('')

    try {
      const res = await fetch('/api/gemini-voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: selectedVoice }),
      })

      if (res.status === 429 && attempt < 3) {
        const body = await res.json().catch(() => ({}))
        const waitSec = (body?.retryDelay ?? 30) as number
        for (let s = waitSec; s > 0; s--) {
          if (previewAbortRef.current) { setPreviewLoading(false); return }
          setPreviewErrorMsg(`Rate limited — retrying in ${s}s…`)
          await new Promise(r => setTimeout(r, 1000))
        }
        if (previewAbortRef.current) { setPreviewLoading(false); return }
        setPreviewErrorMsg('')
        return playVoicePreview(attempt + 1)
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(`Preview failed ${res.status}: ${errBody?.detail ?? errBody?.error ?? 'unknown'}`)
      }
      const { audio } = await res.json()
      if (!audio) throw new Error('No audio in response')

      const samples = base64ToFloat32(audio)
      if (!samples?.length) throw new Error('Failed to decode audio')

      const ctx = new AudioContext({ sampleRate: OUT_SAMPLE_RATE })
      previewCtxRef.current = ctx

      const buf = ctx.createBuffer(1, samples.length, OUT_SAMPLE_RATE)
      buf.copyToChannel(new Float32Array(samples), 0)
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.connect(ctx.destination)
      src.start()
      previewSourceRef.current = src

      setPreviewLoading(false)
      setPreviewPlaying(true)
      setPreviewErrorMsg('')

      src.onended = () => {
        setPreviewPlaying(false)
        ctx.close().catch(() => {})
        if (previewCtxRef.current === ctx) previewCtxRef.current = null
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[VoicePreview] error', msg)
      setPreviewLoading(false)
      setPreviewErrorMsg(msg)
    }
  }, [selectedVoice, previewPlaying, previewLoading, stopPreview])

  useEffect(() => { stopPreview() }, [selectedVoice, stopPreview])

  const playAudioChunk = useCallback((b64: string) => {
    const samples = base64ToFloat32(b64)
    if (!samples || samples.length === 0) return

    if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
      playbackCtxRef.current = new AudioContext({ sampleRate: OUT_SAMPLE_RATE })
      ctxCreatedAtWallRef.current = Date.now()
      nextPlayTimeRef.current = 0
    }
    const ctx = playbackCtxRef.current
    const audioBuf = ctx.createBuffer(1, samples.length, OUT_SAMPLE_RATE)
    audioBuf.copyToChannel(new Float32Array(samples), 0)

    const src = ctx.createBufferSource()
    src.buffer = audioBuf
    src.connect(ctx.destination)

    const startAt = Math.max(ctx.currentTime, nextPlayTimeRef.current)
    src.start(startAt)
    nextPlayTimeRef.current = startAt + audioBuf.duration

    const wallStart = ctxCreatedAtWallRef.current + startAt * 1000
    aiChunksRef.current.push({ wallStart, samples: new Float32Array(samples) })
    setHasRecording(true)

    activeSourcesRef.current.push(src)
    src.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== src)
      if (activeSourcesRef.current.length === 0) {
        setStatus((prev) => (prev === 'speaking' ? 'listening' : prev))
      }
    }

    setStatus((prev) => (prev === 'listening' || prev === 'connecting' ? 'speaking' : prev))
  }, [])

  const handleMessage = useCallback(
    (raw: string) => {
      let msg: Record<string, unknown>
      try { msg = JSON.parse(raw) } catch {
        console.warn('[GeminiVoice] non-JSON:', raw.slice(0, 100))
        return
      }

      console.debug('[GeminiVoice] ←', JSON.stringify(msg).slice(0, 200))

      if ('setupComplete' in msg || 'setup_complete' in msg) {
        setStatusSync('listening')
        return
      }

      const sc = msg.serverContent as Record<string, unknown> | undefined
      if (!sc) return

      if (sc.interrupted) {
        stopPlayback()
        lastTurnCompleteRef.current = true
        setStatusSync('listening')
        return
      }

      if (sc.turnComplete) {
        lastTurnCompleteRef.current = true
      }

      const appendAssistant = (text: string) => {
        setTurns((prev) => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant' && !lastTurnCompleteRef.current) {
            return [...prev.slice(0, -1), { role: 'assistant', text: last.text + text }]
          }
          lastTurnCompleteRef.current = false
          return [...prev, { role: 'assistant', text }]
        })
      }

      const modelTurn = sc.modelTurn as Record<string, unknown> | undefined
      if (modelTurn) {
        const parts = (modelTurn.parts as Array<Record<string, unknown>>) ?? []
        for (const part of parts) {
          const inlineData = part.inlineData as Record<string, unknown> | undefined
          if (inlineData?.data) playAudioChunk(inlineData.data as string)
          if (typeof part.text === 'string' && part.text.trim()) {
            appendAssistant(part.text)
          }
        }
      }

      const outTx = sc.outputTranscription as Record<string, unknown> | undefined
      if (outTx?.text) {
        appendAssistant(outTx.text as string)
      }

      const inTx = sc.inputTranscription as Record<string, unknown> | undefined
      if (inTx?.text) {
        const text = inTx.text as string
        setTurns((prev) => {
          const last = prev[prev.length - 1]
          if (last?.role === 'user') {
            return [...prev.slice(0, -1), { role: 'user', text: last.text + ' ' + text }]
          }
          return [...prev, { role: 'user', text }]
        })
      }
    },
    [playAudioChunk, stopPlayback, setStatusSync]
  )

  const startSession = useCallback(async () => {
    stopPreview()
    setStatusSync('connecting')
    setOpen(true)
    setErrorMsg('')
    setTurns([])
    setHasRecording(false)
    aiChunksRef.current = []
    micSamplesRef.current = []
    micStartWallRef.current = 0
    ctxCreatedAtWallRef.current = 0
    lastTurnCompleteRef.current = true
    stopPlayback()

    let token: string
    let systemPrompt: string
    try {
      const res = await fetch('/api/gemini-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: selectedScenarioRef.current }),
      })
      if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`)
      const json = await res.json()
      token = json.token
      systemPrompt = json.systemPrompt
    } catch (e) {
      setStatusSync('error')
      setErrorMsg('Could not get auth token. Are you logged in?')
      console.error(e)
      return
    }

    const ws = new WebSocket(`${WS_BASE}?key=${token}`)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[GeminiVoice] WS open')
      ws.send(JSON.stringify({
        setup: {
          model: MODEL,
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoiceRef.current } },
            },
          },
          realtimeInputConfig: {
            automaticActivityDetection: {},
          },
          systemInstruction: { parts: [{ text: systemPrompt }] },
        },
      }))
    }

    ws.onmessage = (e) => {
      if (typeof e.data === 'string') handleMessage(e.data)
      else if (e.data instanceof Blob) e.data.text().then(handleMessage).catch(console.error)
    }

    ws.onerror = (e) => {
      if (intentionalCloseRef.current) return
      console.error('[GeminiVoice] WS error', e)
      setStatusSync('error')
      setErrorMsg('WebSocket error — check browser console.')
    }

    ws.onclose = (e) => {
      const wasIntentional = intentionalCloseRef.current
      intentionalCloseRef.current = false
      if (wasIntentional) { stopMic(); return }
      console.warn(`[GeminiVoice] closed code=${e.code} reason=${e.reason}`)
      if (statusRef.current !== 'error') {
        if (e.code !== 1000) {
          setStatusSync('error')
          setErrorMsg(`Disconnected (code ${e.code}${e.reason ? ': ' + e.reason : ''})`)
        } else {
          setStatusSync('idle')
        }
      }
      stopMic()
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream

      const ctx = new AudioContext({ sampleRate: MIC_SAMPLE_RATE })
      audioCtxRef.current = ctx

      const source = ctx.createMediaStreamSource(stream)
      sourceRef.current = source

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1)
      processorRef.current = processor

      micStartWallRef.current = Date.now()
      processor.onaudioprocess = (ev) => {
        const channelData = ev.inputBuffer.getChannelData(0)
        micSamplesRef.current.push(new Float32Array(channelData))
        if (ws.readyState !== WebSocket.OPEN) return
        const pcm = floatTo16BitPCM(channelData)
        ws.send(JSON.stringify({
          realtimeInput: {
            audio: {
              data: arrayBufferToBase64(pcm),
              mimeType: `audio/pcm;rate=${MIC_SAMPLE_RATE}`,
            },
          },
        }))
      }

      source.connect(processor)
      processor.connect(ctx.destination)
    } catch (e) {
      setStatusSync('error')
      setErrorMsg('Mic access denied — please allow microphone permission and try again.')
      console.error(e)
      ws.close()
    }
  }, [handleMessage, stopMic, stopPlayback, stopPreview, setStatusSync])

  const newConversation = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    stopMic()
    stopPlayback()
    playbackCtxRef.current?.close().catch(() => {})
    playbackCtxRef.current = null
    aiChunksRef.current = []
    micSamplesRef.current = []
    ctxCreatedAtWallRef.current = 0
    lastTurnCompleteRef.current = true
    setHasRecording(false)
    setTurns([])
    setErrorMsg('')
    setStatusSync('idle')
    setOpen(true)
  }, [stopMic, stopPlayback, setStatusSync])

  const isActive = status === 'listening' || status === 'speaking'
  const statusLabel: Record<Status, string> = {
    idle: 'Start session',
    connecting: 'Connecting…',
    listening: 'Listening…',
    speaking: 'Speaking…',
    error: 'Error — tap to retry',
  }
  const isPulsing = status === 'listening' || status === 'speaking'

  const getScenarioLabel = () => {
    const scenario = scenarios.find(s => s.id === selectedScenario)
    return scenario?.label || 'Voice'
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-[400px] max-h-[80vh] rounded-2xl border border-white/10 bg-gray-950 shadow-2xl flex flex-col overflow-hidden">

          {/* ─── HEADER ─── */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gray-900/50">
            <div className="flex items-center gap-2.5">
              <span className={`w-2 h-2 rounded-full transition-colors ${
                status === 'listening' ? 'bg-green-400' :
                status === 'speaking'  ? 'bg-blue-400' :
                status === 'connecting' ? 'bg-yellow-400 animate-pulse' :
                status === 'error'     ? 'bg-red-400' : 'bg-gray-500'
              }`} />
              <span className="text-sm font-semibold text-white truncate max-w-[200px]">
                {getScenarioLabel()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isActive && (
                <button
                  onClick={newConversation}
                  className="text-gray-400 hover:text-white text-xs transition-colors px-2 py-1 rounded border border-gray-700 hover:border-gray-500"
                  title="Start new conversation"
                >
                  ↺ New
                </button>
              )}
              {!isActive && turns.length > 0 && (
                <button
                  onClick={() => { setTurns([]); setErrorMsg(''); setHasRecording(false); aiChunksRef.current = []; micSamplesRef.current = [] }}
                  className="text-gray-400 hover:text-white text-xs transition-colors px-2 py-1 rounded border border-gray-700 hover:border-gray-500"
                  title="Clear chat history"
                >
                  ✕ Clear
                </button>
              )}
              <button
                onClick={closeSession}
                className="text-gray-400 hover:text-white text-xs transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* ─── CONTROLS ─── */}
          {!isActive && status !== 'connecting' && (
            <div className="px-4 py-4 border-b border-white/10 bg-gray-900/50 space-y-3">
              {scenarios.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5 font-medium">Scenario</label>
                  <select
                    value={selectedScenario}
                    onChange={(e) => setSelectedScenario(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors"
                  >
                    {scenarios.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">Voice</label>
                <div className="flex gap-2">
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors"
                  >
                    {VOICES.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => (previewLoading || previewPlaying) ? stopPreview() : playVoicePreview()}
                    title={previewPlaying ? 'Stop preview' : previewLoading ? 'Cancel' : 'Preview this voice'}
                    className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 hover:border-violet-500 text-gray-400 hover:text-white transition-colors shrink-0"
                  >
                    {previewLoading ? (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    ) : previewPlaying ? (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="4" y="4" width="16" height="16" rx="2"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {previewErrorMsg && (
                <p className="text-yellow-400 text-xs px-2">{previewErrorMsg}</p>
              )}

              <button
                onClick={startSession}
                className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 mt-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
                  <path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.07A7 7 0 0 0 19 11Z" />
                </svg>
                Start Session
              </button>
            </div>
          )}

          {/* ─── TRANSCRIPT ─── */}
          <div
            ref={transcriptRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-[160px]"
          >
            {turns.length === 0 && !errorMsg && (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs text-center">
                {status === 'connecting' ? 'Connecting…' : 'Start speaking…'}
              </div>
            )}

            {turns.map((t, i) => (
              <div key={i} className={`flex gap-2 ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {t.role === 'assistant' && (
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
                    </svg>
                  </div>
                )}
                <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${
                  t.role === 'user'
                    ? 'bg-violet-600 text-white rounded-br-none'
                    : 'bg-gray-800 border border-gray-700 text-gray-100 rounded-bl-none'
                }`}>
                  {t.text}
                </div>
              </div>
            ))}

            {status === 'speaking' && turns.length > 0 && turns[turns.length - 1]?.role === 'assistant' && (
              <div className="flex gap-2 justify-start">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
                  </svg>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-bl-none px-4 py-2.5">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            )}

            {errorMsg && (
              <p className="text-red-400 text-xs text-center px-2 py-2 bg-red-500/10 rounded">{errorMsg}</p>
            )}
          </div>

          {/* ─── FOOTER ─── */}
          <div className="px-4 py-3 border-t border-white/10 bg-gray-900/50 flex items-center justify-between gap-2">
            {isActive || status === 'connecting' ? (
              <button
                onClick={closeSession}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors"
                title="Stop session and save recording"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                  <rect x="4" y="4" width="16" height="16" rx="2"/>
                </svg>
                Stop
              </button>
            ) : (
              <span className="text-xs text-gray-400">{statusLabel[status]}</span>
            )}
            {hasRecording && isActive && (
              <button
                onClick={saveRecording}
                className="text-xs text-gray-400 hover:text-white transition-colors"
                title="Download recording now"
              >
                ⬇ Save
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── FLOATING MIC BUTTON ─── */}
      <button
        onClick={() => {
          if (isActive || status === 'connecting') {
            closeSession()
          } else if (status === 'idle' || status === 'error') {
            if (!open) { setOpen(true) } else { startSession() }
          }
        }}
        className={`relative w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-200 ${
          isActive || status === 'connecting'
            ? 'bg-red-600 hover:bg-red-500'
            : status === 'error'
            ? 'bg-red-600 hover:bg-red-500'
            : 'bg-violet-600 hover:bg-violet-500'
        }`}
        aria-label={isActive || status === 'connecting' ? 'Stop session' : statusLabel[status]}
        title={isActive || status === 'connecting' ? 'Stop session' : statusLabel[status]}
      >
        {isPulsing && (
          <span className="absolute inset-0 rounded-full animate-ping opacity-40 bg-current" />
        )}
        {isActive || status === 'connecting' ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 relative">
            <rect x="5" y="5" width="14" height="14" rx="2"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 relative">
            <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
            <path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.07A7 7 0 0 0 19 11Z" />
          </svg>
        )}
      </button>
    </div>
  )
}
