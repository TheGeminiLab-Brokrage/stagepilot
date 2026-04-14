'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Gemini Live API constants ─────────────────────────────────────────────────
const MODEL = 'models/gemini-3.1-flash-live-preview'
const WS_BASE = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'
const MIC_SAMPLE_RATE = 16000
const OUT_SAMPLE_RATE = 24000
const BUFFER_SIZE = 4096

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
  description?: string
}

interface AiChunk {
  wallStart: number
  samples: Float32Array
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
    interleaved[i * 2] = Math.max(-32768, Math.min(32767, Math.round(aiVal * 32767)))
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

// ─── Component ─────────────────────────────────────────────────────────────────
interface PracticeClientProps {
  userId: string
  companyId: string
  userName: string
}

export default function PracticeClient({ userId, companyId, userName }: PracticeClientProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [turns, setTurns] = useState<Turn[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [scenarios, setScenarios] = useState<ScenarioOption[]>([])
  const [selectedScenario, setSelectedScenario] = useState<string>('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')
  const [sessionStartMs, setSessionStartMs] = useState(0)

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
  const intentionalCloseRef = useRef(false)
  const lastTurnCompleteRef = useRef(true)

  const selectedScenarioRef = useRef(selectedScenario)
  useEffect(() => { selectedScenarioRef.current = selectedScenario }, [selectedScenario])

  const transcriptRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    fetch('/api/gemini-scenarios')
      .then((r) => r.json())
      .then((list: ScenarioOption[]) => {
        setScenarios(list)
        if (list.length > 0) setSelectedScenario(list[0].id)
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

  const saveSessionToServer = useCallback(async (blob: Blob, durationSeconds: number) => {
    setSaveStatus('saving')
    setSaveError('')

    const form = new FormData()
    form.append('audioBlob', blob, `practice-${Date.now()}.wav`)
    form.append('scenarioId', selectedScenarioRef.current)
    form.append('durationSeconds', String(durationSeconds))

    console.log('[PracticeClient] saveSessionToServer:', {
      blobSize: blob.size,
      scenarioId: selectedScenarioRef.current,
      durationSeconds
    })

    try {
      const res = await fetch('/api/save-practice-session', {
        method: 'POST',
        body: form,
      })

      const responseText = await res.text()
      console.log('[PracticeClient] API response:', { status: res.status, body: responseText })

      if (!res.ok) {
        throw new Error(`Failed to save session: ${res.status} - ${responseText}`)
      }

      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setSaveStatus('error')
      setSaveError(msg)
      console.error('[PracticeClient] Save failed:', msg)

      // Fallback: trigger local download so recording is never lost
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `practice-session-${Date.now()}.wav`
      a.click()
      URL.revokeObjectURL(url)
    }
  }, [])

  const closeSession = useCallback(() => {
    intentionalCloseRef.current = true
    wsRef.current?.close()
    wsRef.current = null
    stopMic()
    stopPlayback()
    playbackCtxRef.current?.close().catch(() => {})
    playbackCtxRef.current = null

    // Save recording to server if there's any audio (AI or mic)
    if (aiChunksRef.current.length > 0 || micSamplesRef.current.length > 0) {
      const durationSeconds = Math.round((Date.now() - micStartWallRef.current) / 1000)
      const blob = createStereoWavBlob(aiChunksRef.current, micSamplesRef.current, micStartWallRef.current, OUT_SAMPLE_RATE)
      console.log('[PracticeClient] Saving session:', { durationSeconds, scenarioId: selectedScenarioRef.current })
      saveSessionToServer(blob, durationSeconds)
    }

    aiChunksRef.current = []
    micSamplesRef.current = []
    setStatusSync('idle')
    setTurns([])
    setErrorMsg('')
    setSessionStartMs(0)
  }, [stopMic, stopPlayback, saveSessionToServer, setStatusSync])

  useEffect(() => { return () => closeSession() }, [closeSession])

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
        console.warn('[PracticeClient] non-JSON:', raw.slice(0, 100))
        return
      }

      console.debug('[PracticeClient] ←', JSON.stringify(msg).slice(0, 200))

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
    setStatusSync('connecting')
    setErrorMsg('')
    setTurns([])
    setSaveStatus('idle')
    setSaveError('')
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
      console.log('[PracticeClient] WS open')
      micStartWallRef.current = Date.now()
      ws.send(JSON.stringify({
        setup: {
          model: MODEL,
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: scenarios.find(s => s.id === selectedScenarioRef.current)?.defaultVoice || 'Puck' } },
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
      console.error('[PracticeClient] WS error', e)
      setStatusSync('error')
      setErrorMsg('WebSocket error — check browser console.')
    }

    ws.onclose = (e) => {
      const wasIntentional = intentionalCloseRef.current
      intentionalCloseRef.current = false
      if (wasIntentional) { stopMic(); return }
      console.warn(`[PracticeClient] closed code=${e.code} reason=${e.reason}`)
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

      // Resume audio context — required for modern browsers
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }

      const source = ctx.createMediaStreamSource(stream)
      sourceRef.current = source

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1)
      processorRef.current = processor

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
  }, [handleMessage, stopMic, stopPlayback, setStatusSync, scenarios])

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
    setTurns([])
    setErrorMsg('')
    setStatusSync('idle')
    setSessionStartMs(0)
  }, [stopMic, stopPlayback, setStatusSync])

  const isActive = status === 'listening' || status === 'speaking'
  const statusLabel: Record<Status, string> = {
    idle: 'Start Session',
    connecting: 'Connecting…',
    listening: 'Listening…',
    speaking: 'Speaking…',
    error: 'Error',
  }

  const currentScenario = scenarios.find(s => s.id === selectedScenario)

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* ─── HEADER ─── */}
      <div className="border-b border-gray-800 bg-gray-900/50 px-6 py-4">
        <h1 className="text-xl font-bold text-white">AI Practice Session</h1>
        <p className="text-xs text-gray-400 mt-1">{userName}</p>
      </div>

      {/* ─── TOP SECTION: Scenario Selector + Info ─── */}
      <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/30 space-y-4">
        <div>
          <label className="block text-xs text-gray-400 mb-2 font-medium">Select Scenario</label>
          <select
            value={selectedScenario}
            onChange={(e) => setSelectedScenario(e.target.value)}
            disabled={isActive || status === 'connecting'}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* ─── Scenario Description Card ─── */}
        {currentScenario && !isActive && (
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-2">{currentScenario.label}</h3>
            <p className="text-xs text-gray-300 leading-relaxed">{currentScenario.description}</p>
          </div>
        )}
      </div>

      {/* ─── MAIN TRANSCRIPT AREA ─── */}
      <div
        ref={transcriptRef}
        className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
      >
        {turns.length === 0 && !errorMsg && !isActive && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm text-center">
            <svg className="w-12 h-12 mb-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
            Select a scenario and start the session to begin practicing.
          </div>
        )}

        {turns.length === 0 && status === 'connecting' && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="animate-spin mb-3">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                <circle cx="12" cy="12" r="8" />
              </svg>
            </div>
            <p className="text-sm">Connecting…</p>
          </div>
        )}

        {turns.map((t, i) => (
          <div key={i} className={`flex gap-3 ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {t.role === 'assistant' && (
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
                </svg>
              </div>
            )}
            <div
              className={`max-w-[80%] px-4 py-3 rounded-lg text-sm leading-relaxed ${
                t.role === 'user'
                  ? 'bg-violet-600 text-white rounded-tr-none'
                  : 'bg-gray-800 border border-gray-700 text-gray-100 rounded-tl-none'
              }`}
            >
              {t.text}
            </div>
          </div>
        ))}

        {status === 'speaking' && turns.length > 0 && turns[turns.length - 1]?.role === 'assistant' && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
              </svg>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg rounded-tl-none px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
            {errorMsg}
          </div>
        )}

        {saveStatus === 'saved' && (
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm text-center">
            ✓ Session saved to server
          </div>
        )}

        {saveStatus === 'error' && saveError && (
          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm text-center">
            {saveError}
          </div>
        )}
      </div>

      {/* ─── FOOTER: Controls ─── */}
      <div className="border-t border-gray-800 bg-gray-900/50 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              status === 'listening' ? 'bg-green-400' :
              status === 'speaking' ? 'bg-blue-400' :
              status === 'connecting' ? 'bg-yellow-400 animate-pulse' :
              status === 'error' ? 'bg-red-400' : 'bg-gray-500'
            }`}
          />
          <span className="text-sm text-gray-300 font-medium">
            {status === 'connecting' ? 'Connecting…' : statusLabel[status]}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isActive && (
            <button
              onClick={newConversation}
              className="text-xs px-3 py-2 rounded-lg border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white transition-colors"
            >
              ↺ New
            </button>
          )}

          {!isActive && status !== 'connecting' ? (
            <button
              onClick={startSession}
              disabled={!selectedScenario || saveStatus === 'saving'}
              className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
                <path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.07A7 7 0 0 0 19 11Z" />
              </svg>
              {saveStatus === 'saving' ? 'Saving…' : 'Start'}
            </button>
          ) : (
            <button
              onClick={closeSession}
              className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors flex items-center gap-2"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
              Stop
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
