'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mp3Encoder } from 'lamejs'
import AiOrb from './AiOrb'

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

function createStereoMp3Blob(
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
  const leftInt16 = new Int16Array(len)
  const rightInt16 = new Int16Array(len)
  for (let i = 0; i < len; i++) {
    leftInt16[i] = Math.max(-32768, Math.min(32767, Math.round((ai[i] ?? 0) * 32767)))
    rightInt16[i] = Math.max(-32768, Math.min(32767, Math.round((mic[i] ?? 0) * 32767)))
  }

  const encoder = new Mp3Encoder(2, sampleRate, 128)
  const chunkSize = 1152
  const mp3Parts: Uint8Array[] = []
  for (let i = 0; i < len; i += chunkSize) {
    const encoded = encoder.encodeBuffer(leftInt16.subarray(i, i + chunkSize), rightInt16.subarray(i, i + chunkSize))
    if (encoded.length > 0) mp3Parts.push(new Uint8Array(encoded.buffer as ArrayBuffer))
  }
  const flushed = encoder.flush()
  if (flushed.length > 0) mp3Parts.push(new Uint8Array(flushed.buffer as ArrayBuffer))

  return new Blob(mp3Parts as unknown as BlobPart[], { type: 'audio/mpeg' })
}


// ─── Goodbye detection ────────────────────────────────────────────────────────

const GOODBYE_PATTERNS = [
  /مع السلام/,
  /وداعاً?/,
  /إلى اللقاء/,
  /الى اللقاء/,
  /\bgoodbye\b/i,
  /\bfarеwell\b/i,
  /\bbye\b/i,
]

function isGoodbye(text: string): boolean {
  if (GOODBYE_PATTERNS.some((r) => r.test(text))) return true
  // standalone سلام (not preceded by ل as in السلام عليكم)
  return /(?<!ل)سلام[.!،؟\s]*$/.test(text.trim())
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
  const [audioLevel, setAudioLevel] = useState(0)

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
  const audioLevelRafRef = useRef<number>(0)
  const ringCtxRef = useRef<AudioContext | null>(null)
  const ringStoppedRef = useRef(true)
  const goodbyeTriggeredRef = useRef(false)

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
    cancelAnimationFrame(audioLevelRafRef.current)
    processorRef.current?.disconnect()
    sourceRef.current?.disconnect()
    audioCtxRef.current?.close().catch(() => {})
    streamRef.current?.getTracks().forEach((t) => t.stop())
    processorRef.current = null
    sourceRef.current = null
    audioCtxRef.current = null
    streamRef.current = null
    setAudioLevel(0)
  }, [])

  const stopPlayback = useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try { src.stop() } catch { /* already ended */ }
    }
    activeSourcesRef.current = []
    nextPlayTimeRef.current = 0
  }, [])

  const stopRingSound = useCallback(() => {
    ringStoppedRef.current = true
    if (ringCtxRef.current) {
      ringCtxRef.current.close().catch(() => {})
      ringCtxRef.current = null
    }
  }, [])

  const startRingSound = useCallback(() => {
    stopRingSound()
    ringStoppedRef.current = false
    const ctx = new AudioContext()
    ringCtxRef.current = ctx

    const scheduleRing = () => {
      if (ringStoppedRef.current || !ringCtxRef.current || ringCtxRef.current.state === 'closed') return

      const gain = ctx.createGain()
      gain.gain.value = 0.22
      gain.connect(ctx.destination)

      const o1 = ctx.createOscillator()
      const o2 = ctx.createOscillator()
      o1.type = 'sine'
      o2.type = 'sine'
      o1.frequency.value = 440
      o2.frequency.value = 480
      o1.connect(gain)
      o2.connect(gain)
      o1.start()
      o2.start()

      setTimeout(() => {
        if (ringStoppedRef.current) return
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1)
        setTimeout(() => {
          try { o1.stop(); o2.stop() } catch { /* already stopped */ }
          setTimeout(scheduleRing, 3000)
        }, 150)
      }, 1200)
    }

    scheduleRing()
  }, [stopRingSound])

  const saveSessionToServer = useCallback(async (blob: Blob, durationSeconds: number) => {
    setSaveStatus('saving')
    setSaveError('')

    try {
      const urlRes = await fetch('/api/practice-signed-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!urlRes.ok) throw new Error('Could not get upload URL')
      const { signedUrl, audioPath } = await urlRes.json()

      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'audio/mpeg' },
        body: blob,
      })
      if (!uploadRes.ok) throw new Error(`Storage upload failed: ${uploadRes.status}`)

      const metaRes = await fetch('/api/save-practice-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioPath,
          scenarioId: selectedScenarioRef.current,
          durationSeconds,
        }),
      })
      const metaText = await metaRes.text()
      if (!metaRes.ok) throw new Error(`Metadata save failed: ${metaRes.status} - ${metaText}`)

      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setSaveStatus('error')
      setSaveError(msg)
      console.error('[PracticeClient] Save failed:', msg)

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `practice-session-${Date.now()}.mp3`
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

    if (aiChunksRef.current.length > 0 || micSamplesRef.current.length > 0) {
      const durationSeconds = Math.round((Date.now() - micStartWallRef.current) / 1000)
      const blob = createStereoMp3Blob(aiChunksRef.current, micSamplesRef.current, micStartWallRef.current, OUT_SAMPLE_RATE)
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

  // Phone ring during connecting state
  useEffect(() => {
    if (status === 'connecting') startRingSound()
    else stopRingSound()
  }, [status, startRingSound, stopRingSound])

  // Auto-close when AI says goodbye
  useEffect(() => {
    if (status !== 'listening' && status !== 'speaking') return
    const lastAI = [...turns].reverse().find((t) => t.role === 'assistant')
    if (!lastAI || !isGoodbye(lastAI.text) || goodbyeTriggeredRef.current) return
    goodbyeTriggeredRef.current = true
    const t = setTimeout(() => closeSession(), 1500)
    return () => clearTimeout(t)
  }, [turns, status, closeSession])

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
        setAudioLevel(0)
      }
    }

    setStatus((prev) => (prev === 'listening' || prev === 'connecting' ? 'speaking' : prev))

    // Compute RMS for speaking audio level
    let sum = 0
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
    const rms = Math.sqrt(sum / samples.length)
    setAudioLevel(Math.min(1, rms * 4))
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
    goodbyeTriggeredRef.current = false
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

      if (ctx.state === 'suspended') await ctx.resume()

      const source = ctx.createMediaStreamSource(stream)
      sourceRef.current = source

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (ev) => {
        const channelData = ev.inputBuffer.getChannelData(0)
        micSamplesRef.current.push(new Float32Array(channelData))

        // Compute mic RMS for orb reactivity
        let sum = 0
        for (let i = 0; i < channelData.length; i++) sum += channelData[i] * channelData[i]
        const rms = Math.sqrt(sum / channelData.length)
        setAudioLevel(Math.min(1, rms * 6))

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

      micStartWallRef.current = Date.now()
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
    goodbyeTriggeredRef.current = false
    setTurns([])
    setErrorMsg('')
    setStatusSync('idle')
    setSessionStartMs(0)
    setAudioLevel(0)
  }, [stopMic, stopPlayback, setStatusSync])

  const isActive = status === 'listening' || status === 'speaking'
  const currentScenario = scenarios.find(s => s.id === selectedScenario)

  const statusLabel: Record<Status, string> = {
    idle:       'Ready to Practice',
    connecting: 'Connecting…',
    listening:  'Listening',
    speaking:   'Speaking',
    error:      'Connection Error',
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col" style={{ background: '#000', fontFamily: "'Montserrat', sans-serif" }}>

      {/* ── SCENARIO SELECTOR (top) ─────────────────────────────────────────── */}
      <div className="px-6 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(215,255,0,0.12)' }}>
        <label
          className="block text-xs font-semibold mb-2 uppercase"
          style={{ color: 'rgba(215,255,0,0.6)', letterSpacing: '0.1em', fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Select Scenario
        </label>
        <select
          value={selectedScenario}
          onChange={(e) => setSelectedScenario(e.target.value)}
          disabled={isActive || status === 'connecting'}
          className="w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none"
          style={{
            background: 'rgba(215,255,0,0.05)',
            border: '1px solid rgba(215,255,0,0.25)',
            color: '#fff',
            fontFamily: "'Montserrat', sans-serif",
          }}
          onFocus={e => (e.target.style.borderColor = 'rgba(215,255,0,0.7)')}
          onBlur={e => (e.target.style.borderColor = 'rgba(215,255,0,0.25)')}
        >
          {scenarios.map((s) => (
            <option key={s.id} value={s.id} style={{ background: '#111', color: '#fff' }}>
              {s.label}
            </option>
          ))}
        </select>

        {currentScenario && !isActive && (
          <p className="mt-2 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {currentScenario.description}
          </p>
        )}
      </div>

      {/* ── ORB SECTION (center) ────────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center py-4" style={{ flex: '1 1 auto', minHeight: 0 }}>
        <AiOrb status={status} audioLevel={audioLevel} />

        {/* Status label under orb */}
        <div className="mt-4 flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: status === 'error' ? '#ef4444' : '#D7FF00',
              boxShadow: status === 'error'
                ? '0 0 8px rgba(239,68,68,0.8)'
                : status === 'idle'
                ? 'none'
                : '0 0 10px rgba(215,255,0,0.9)',
              animation: status === 'connecting' ? 'orb-breathe 1s ease-in-out infinite' : 'none',
            }}
          />
          <span
            className="text-sm font-semibold tracking-widest uppercase"
            style={{
              color: status === 'error'
                ? '#ef4444'
                : status === 'idle'
                ? 'rgba(255,255,255,0.4)'
                : '#D7FF00',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.15em',
              textShadow: status !== 'idle' && status !== 'error'
                ? '0 0 16px rgba(215,255,0,0.6)'
                : 'none',
            }}
          >
            {statusLabel[status]}
          </span>
        </div>

        {saveStatus === 'saving' && (
          <p className="mt-2 text-xs" style={{ color: 'rgba(215,255,0,0.5)' }}>Saving session…</p>
        )}
        {saveStatus === 'saved' && (
          <p className="mt-2 text-xs" style={{ color: '#26D701' }}>✓ Session saved</p>
        )}
        {saveStatus === 'error' && (
          <p className="mt-2 text-xs" style={{ color: '#ef4444' }}>Save failed — downloaded locally</p>
        )}
      </div>

      {/* ── TRANSCRIPT (scrollable middle) ──────────────────────────────────── */}
      <div
        ref={transcriptRef}
        className="flex-1 overflow-y-auto px-6 space-y-3 pb-4"
        style={{ minHeight: 0 }}
      >
        {turns.map((t, i) => (
          <div key={i} className={`flex gap-2 ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {t.role === 'assistant' && (
              <div
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                style={{
                  background: 'rgba(215,255,0,0.1)',
                  border: '1px solid rgba(215,255,0,0.3)',
                  color: '#D7FF00',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                AI
              </div>
            )}
            <div
              className="max-w-[78%] px-3 py-2 rounded-lg text-xs leading-relaxed"
              style={
                t.role === 'user'
                  ? {
                      background: 'rgba(215,255,0,0.12)',
                      border: '1px solid rgba(215,255,0,0.3)',
                      color: '#fff',
                      borderRadius: '12px 12px 4px 12px',
                    }
                  : {
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.8)',
                      borderRadius: '12px 12px 12px 4px',
                    }
              }
            >
              {t.text}
            </div>
          </div>
        ))}

        {status === 'speaking' && turns.length > 0 && turns[turns.length - 1]?.role === 'assistant' && (
          <div className="flex gap-2 justify-start">
            <div
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
              style={{ background: 'rgba(215,255,0,0.1)', border: '1px solid rgba(215,255,0,0.3)', color: '#D7FF00', fontFamily: "'Space Grotesk', sans-serif" }}
            >
              AI
            </div>
            <div
              className="px-3 py-2 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px 12px 12px 4px' }}
            >
              <div className="flex gap-1 items-center">
                {[0, 0.15, 0.3].map((delay, i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ background: '#D7FF00', animationDelay: `${delay}s`, boxShadow: '0 0 6px rgba(215,255,0,0.8)' }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {errorMsg && (
          <div
            className="px-4 py-3 rounded-lg text-xs text-center"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}
          >
            {errorMsg}
          </div>
        )}
      </div>

      {/* ── FOOTER CONTROLS ─────────────────────────────────────────────────── */}
      <div
        className="px-6 py-4 flex items-center justify-between gap-4"
        style={{ borderTop: '1px solid rgba(215,255,0,0.12)', background: 'rgba(0,0,0,0.6)' }}
      >
        {isActive ? (
          <button
            onClick={newConversation}
            className="text-xs px-3 py-2 rounded-lg font-medium transition-all"
            style={{
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.5)',
              background: 'transparent',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.05em',
            }}
            onMouseEnter={e => { (e.target as HTMLButtonElement).style.borderColor = 'rgba(215,255,0,0.4)'; (e.target as HTMLButtonElement).style.color = '#D7FF00' }}
            onMouseLeave={e => { (e.target as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)'; (e.target as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)' }}
          >
            ↺ New
          </button>
        ) : (
          <div />
        )}

        {!isActive && status !== 'connecting' ? (
          <button
            onClick={startSession}
            disabled={!selectedScenario || saveStatus === 'saving'}
            className="tgl-btn-glow flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: '#D7FF00',
              color: '#000',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.05em',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
              <path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.07A7 7 0 0 0 19 11Z" />
            </svg>
            {saveStatus === 'saving' ? 'Saving…' : 'Start'}
          </button>
        ) : status === 'connecting' ? (
          <button
            disabled
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm opacity-60 cursor-not-allowed"
            style={{ background: 'rgba(215,255,0,0.2)', color: '#D7FF00', border: '1px solid rgba(215,255,0,0.3)', fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
            Connecting
          </button>
        ) : (
          <button
            onClick={closeSession}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all"
            style={{
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.4)',
              color: '#fca5a5',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.05em',
            }}
            onMouseEnter={e => { const b = e.currentTarget; b.style.background = 'rgba(239,68,68,0.25)'; b.style.borderColor = 'rgba(239,68,68,0.7)' }}
            onMouseLeave={e => { const b = e.currentTarget; b.style.background = 'rgba(239,68,68,0.15)'; b.style.borderColor = 'rgba(239,68,68,0.4)' }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
            End Session
          </button>
        )}
      </div>
    </div>
  )
}
