'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mp3Encoder } from '@breezystack/lamejs'
import AiOrb from './AiOrb'
import { useT, useLanguage } from '@/lib/language-context'
import { translations } from '@/lib/translations'

// ─── Gemini Live API constants ─────────────────────────────────────────────────
const MODEL = 'models/gemini-3.1-flash-live-preview'
const WS_BASE = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'
const MIC_SAMPLE_RATE = 16000
const OUT_SAMPLE_RATE = 24000
const BUFFER_SIZE = 4096

// ─── Types ─────────────────────────────────────────────────────────────────────
type Status = 'idle' | 'connecting' | 'listening' | 'speaking' | 'ending' | 'error'

interface Turn {
  role: 'user' | 'assistant'
  text: string
}

interface ScenarioOption {
  id: string
  label: string
  defaultVoice?: string
  description?: string
  category?: string
  subcategory?: 'Clients' | 'Educational'
  name?: string
  job?: string
  tag?: string
  iconType?: 'tooth' | 'sparkle' | 'chart' | 'tower'
  context?: string
  practiceGoal?: string
  nameAr?: string
  jobAr?: string
  tagAr?: string
  contextAr?: string
  practiceGoalAr?: string
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

async function createStereoWavBlob(
  aiChunks: AiChunk[],
  micSamples: Float32Array[],
  sessionStartMs: number,
  sampleRate: number,
): Promise<Blob> {
  const effectiveStart =
    sessionStartMs > 0
      ? sessionStartMs
      : (aiChunks.length > 0 ? aiChunks[0].wallStart : Date.now())

  console.log('[SAVE] createStereoMp3Blob start — aiChunks:', aiChunks.length, 'micSamples:', micSamples.length, 'effectiveStart:', effectiveStart)

  let aiTrackLen = 0
  for (const chunk of aiChunks) {
    const offset = Math.round(((chunk.wallStart - effectiveStart) / 1000) * sampleRate)
    if (offset >= 0) aiTrackLen = Math.max(aiTrackLen, offset + chunk.samples.length)
  }
  const MAX_SAMPLES = 24000 * 3600
  if (aiTrackLen > MAX_SAMPLES) {
    throw new Error(`aiTrackLen too large (${aiTrackLen}) — effectiveStart=${effectiveStart}`)
  }
  const ai = new Float32Array(Math.max(aiTrackLen, 1))
  for (const chunk of aiChunks) {
    const offset = Math.round(((chunk.wallStart - effectiveStart) / 1000) * sampleRate)
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

  const encoder = new Mp3Encoder(2, sampleRate, 96)
  const chunkSize = 1152
  const mp3Parts: Uint8Array[] = []
  for (let i = 0; i < len; i += chunkSize) {
    const encoded = encoder.encodeBuffer(leftInt16.subarray(i, i + chunkSize), rightInt16.subarray(i, i + chunkSize))
    if (encoded.length > 0) mp3Parts.push(new Uint8Array(encoded))
    if (i % (chunkSize * 100) === 0 && i > 0) await new Promise<void>(r => setTimeout(r, 0))
  }
  const flushed = encoder.flush()
  if (flushed.length > 0) mp3Parts.push(new Uint8Array(flushed))

  const blob = new Blob(mp3Parts as unknown as BlobPart[], { type: 'audio/mpeg' })
  console.log('[SAVE] blob created, size:', blob.size, 'bytes')
  return blob
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

function playCallEndSound(existingCtx?: AudioContext | null) {
  const ctx = existingCtx ?? new AudioContext()
  const scheduleBeeps = () => {
    const t = ctx.currentTime
    const schedule = (startTime: number) => {
      const gain = ctx.createGain()
      gain.connect(ctx.destination)
      gain.gain.setValueAtTime(0.4, startTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.35)
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = 480
      o.connect(gain)
      o.start(startTime)
      o.stop(startTime + 0.4)
    }
    schedule(t)
    schedule(t + 0.55)
    if (!existingCtx) setTimeout(() => ctx.close().catch(() => {}), 2000)
  }
  if (ctx.state === 'suspended') ctx.resume().then(scheduleBeeps).catch(() => {})
  else scheduleBeeps()
}

// ─── Component ─────────────────────────────────────────────────────────────────
interface PracticeClientProps {
  userId: string
  companyId: string
  userName: string
  role: string
  userEmail: string
}

const AVATAR: Record<string, string> = {
  dr_yasmine: '/avatars/yasmin.jpg',
  dr_mariam: '/avatars/mariam.jpg',
  mohammed_tgl: '/avatars/mohammed-tgl.jpg',
  mohammed_madinet_masr: '/avatars/mohammed-madinet-masr.jpg',
  mona_hassan: '/avatars/mona.jpg',
}

const AVATAR_POSITION: Record<string, string> = {
  dr_yasmine: '48% center',
  dr_mariam: '18% center',
  mohammed_tgl: '44% center',
  mohammed_madinet_masr: '50% center',
  mona_hassan: '47% center',
}

export default function PracticeClient({ userId, companyId, userName, role, userEmail }: PracticeClientProps) {
  const t = useT()
  const { lang } = useLanguage()
  const [status, setStatus] = useState<Status>('idle')
  const [turns, setTurns] = useState<Turn[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [scenarios, setScenarios] = useState<ScenarioOption[]>([])
  const [selectedScenario, setSelectedScenario] = useState<string>('')
  const [panelOpen, setPanelOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<'Clients' | 'Educational'>('Clients')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')
  const [downloadUrl, setDownloadUrl] = useState<{ url: string; filename: string } | null>(null)
  const [dailyUsage, setDailyUsage] = useState<Record<string, number>>({})

  const DAILY_LIMIT = 3
  const isFreePlan = role === 'trainee' && userEmail !== 'trainee@test.com'
  const [sessionStartMs, setSessionStartMs] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [toolCallNote, setToolCallNote] = useState<string | null>(null)

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
  const ringMinEndTimeRef = useRef(0)
  const goodbyeTriggeredRef = useRef(false)
  const lastAssistantTextRef = useRef('')
  const closeSessionRef = useRef<() => void>(() => {})

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

  const refreshDailyUsage = useCallback(() => {
    if (!isFreePlan) return
    fetch('/api/daily-limit')
      .then((r) => r.json())
      .then((data) => {
        if (!data.unlimited) setDailyUsage(data.usage ?? {})
      })
      .catch(console.error)
  }, [isFreePlan])

  useEffect(() => { refreshDailyUsage() }, [refreshDailyUsage])

  // Refresh usage count after a session is successfully saved
  useEffect(() => {
    if (saveStatus === 'saved') refreshDailyUsage()
  }, [saveStatus, refreshDailyUsage])

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
    ringMinEndTimeRef.current = Date.now() + 4500
    const ctx = new AudioContext()
    ringCtxRef.current = ctx

    let ringCount = 0
    const scheduleRing = () => {
      if (ringStoppedRef.current || !ringCtxRef.current || ringCtxRef.current.state === 'closed') return
      ringCount++

      const gain = ctx.createGain()
      gain.gain.value = 0.35
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
          if (ringCount >= 3) { stopRingSound(); return }
          setTimeout(scheduleRing, 3000)
        }, 150)
      }, 1200)
    }

    ctx.resume().catch(() => {})
    scheduleRing()
  }, [stopRingSound])

  const saveSessionToServer = useCallback(async (blob: Blob, durationSeconds: number) => {
    console.log('[SAVE] saveSessionToServer called, blob size:', blob.size)

    // Store blob URL in state so a visible download button appears in the UI.
    // Programmatic a.click() inside setTimeout loses user-gesture context and
    // is silently blocked by Brave / Firefox / strict Chrome settings.
    try {
      const localUrl = URL.createObjectURL(blob)
      setDownloadUrl({ url: localUrl, filename: `practice-session-${Date.now()}.mp3` })
      console.log('[SAVE] download URL set')
    } catch (downloadErr) {
      console.error('[SAVE] local download failed:', downloadErr)
    }

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

      // Fire grading (fire and forget)
      const metaJson = JSON.parse(metaText) as { sessionId?: string }
      if (metaJson.sessionId) {
        fetch('/api/practice/trigger-grading', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: metaJson.sessionId,
            audioPath,
            scenarioId: selectedScenarioRef.current,
          }),
        }).catch(() => {})
      }

      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setSaveStatus('error')
      setSaveError(msg)
      console.error('[PracticeClient] DB upload failed (local copy already saved):', msg)
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

    // Capture before clearing so deferred encode has the data
    const chunks = aiChunksRef.current.slice()
    const mic = micSamplesRef.current.slice()
    const startMs = micStartWallRef.current

    // Reset UI immediately — don't wait for encoding
    aiChunksRef.current = []
    micSamplesRef.current = []
    setStatusSync('idle')
    setTurns([])
    setErrorMsg('')
    setSessionStartMs(0)

    // Defer heavy MP3 encoding so the UI state update flushes first
    if (chunks.length > 0 || mic.length > 0) {
      const durationSeconds = Math.round((Date.now() - startMs) / 1000)
      console.log('[SAVE] closeSession: deferring encode — chunks:', chunks.length, 'mic:', mic.length, 'startMs:', startMs, 'duration:', durationSeconds)
      setTimeout(async () => {
        try {
          const blob = await createStereoWavBlob(chunks, mic, startMs, OUT_SAMPLE_RATE)
          await saveSessionToServer(blob, durationSeconds)
        } catch (e) {
          console.error('[SAVE] closeSession: encoding/save failed:', e)
          setSaveStatus('error')
          setSaveError(e instanceof Error ? e.message : String(e))
        }
      }, 50)
    } else {
      console.warn('[SAVE] closeSession: no audio data to save — chunks:', chunks.length, 'mic:', mic.length)
    }
  }, [stopMic, stopPlayback, saveSessionToServer, setStatusSync])

  useEffect(() => { return () => closeSession() }, [closeSession])

  // Stop ring when no longer connecting — delay until minimum ring duration has elapsed
  useEffect(() => {
    if (status === 'connecting') return
    const delay = Math.max(0, ringMinEndTimeRef.current - Date.now())
    const t = setTimeout(stopRingSound, delay)
    return () => clearTimeout(t)
  }, [status, stopRingSound])

  // Keep ref current so the goodbye timer always calls the latest closeSession
  useEffect(() => { closeSessionRef.current = closeSession }, [closeSession])

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

      // Handle real-time tool calls from Gemini (e.g. search_clinic_projects)
      const toolCall = msg.toolCall as Record<string, unknown> | undefined
      if (toolCall) {
        const functionCalls = (toolCall.functionCalls as Array<Record<string, unknown>>) ?? []
        const searchCall = functionCalls.find((c) => c.name === 'search_clinic_projects')
        if (searchCall) {
          const q = (searchCall.args as Record<string, unknown>)?.query as string
          setToolCallNote(q ?? '…')
        }
        void (async () => {
          const responses = await Promise.all(
            functionCalls.map(async (call) => {
              const callId = call.id as string
              const name = call.name as string
              const args = call.args as Record<string, unknown>

              if (name === 'search_clinic_projects') {
                try {
                  const res = await fetch('/api/knowledge/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: args.query, scenarioId: selectedScenarioRef.current }),
                  })
                  const json = await res.json()
                  return { id: callId, name, response: { output: json.result ?? 'No results found.' } }
                } catch {
                  return { id: callId, name, response: { output: 'Search unavailable.' } }
                }
              }
              return { id: callId, name, response: { output: 'Unknown tool.' } }
            })
          )

          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              toolResponse: { functionResponses: responses },
            }))
          }
          setToolCallNote(null)
        })()
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
        if (!goodbyeTriggeredRef.current && isGoodbye(lastAssistantTextRef.current)) {
          goodbyeTriggeredRef.current = true
          setStatusSync('ending')
          playCallEndSound(playbackCtxRef.current)
          setTimeout(() => closeSessionRef.current(), 1500)
        }
      }

      const appendAssistant = (text: string) => {
        setTurns((prev) => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant' && !lastTurnCompleteRef.current) {
            const combined = last.text + text
            lastAssistantTextRef.current = combined
            return [...prev.slice(0, -1), { role: 'assistant', text: combined }]
          }
          lastTurnCompleteRef.current = false
          lastAssistantTextRef.current = text
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
    if (isFreePlan && (dailyUsage[selectedScenarioRef.current] ?? 0) >= DAILY_LIMIT) {
      setStatusSync('error')
      setErrorMsg(lang === 'ar' ? 'لقد وصلت إلى الحد اليومي لهذا السيناريو. حاول مرة أخرى غداً.' : 'You have reached the daily limit for this scenario. Try again tomorrow.')
      return
    }

    setStatusSync('connecting')
    startRingSound()
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
    lastAssistantTextRef.current = ''
    stopPlayback()

    let token: string
    let systemPrompt: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tools: any[] = []
    try {
      const res = await fetch('/api/gemini-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: selectedScenarioRef.current }),
      })
      if (res.status === 429) {
        setStatusSync('error')
        setErrorMsg(lang === 'ar' ? 'لقد وصلت إلى الحد اليومي لهذا السيناريو. حاول مرة أخرى غداً.' : 'You have reached the daily limit for this scenario. Try again tomorrow.')
        stopRingSound()
        return
      }
      if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`)
      const json = await res.json()
      token = json.token
      systemPrompt = json.systemPrompt
      tools = json.tools ?? []
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
          ...(tools.length > 0 ? { tools } : {}),
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
      if (goodbyeTriggeredRef.current) { stopMic(); return }
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
  }, [handleMessage, stopMic, stopPlayback, setStatusSync, scenarios, startRingSound, stopRingSound, isFreePlan, dailyUsage])

  const newConversation = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    stopMic()
    stopPlayback()
    playbackCtxRef.current?.close().catch(() => {})
    playbackCtxRef.current = null

    // Save before clearing — same logic as closeSession
    const chunks = aiChunksRef.current.slice()
    const mic = micSamplesRef.current.slice()
    const startMs = micStartWallRef.current
    if (chunks.length > 0 || mic.length > 0) {
      const durationSeconds = Math.round((Date.now() - startMs) / 1000)
      console.log('[SAVE] newConversation: deferring encode — chunks:', chunks.length, 'mic:', mic.length, 'startMs:', startMs)
      setTimeout(async () => {
        try {
          const blob = await createStereoWavBlob(chunks, mic, startMs, OUT_SAMPLE_RATE)
          await saveSessionToServer(blob, durationSeconds)
        } catch (e) {
          console.error('[SAVE] newConversation: encoding/save failed:', e)
        }
      }, 50)
    } else {
      console.warn('[SAVE] newConversation: no audio data — chunks:', chunks.length, 'mic:', mic.length)
    }

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
  }, [stopMic, stopPlayback, saveSessionToServer, setStatusSync])

  const isActive = status === 'listening' || status === 'speaking'
  const currentScenario = scenarios.find(s => s.id === selectedScenario)

  const tr = translations[lang]
  const statusLabel: Record<Status, string> = {
    idle:       tr.practiceStatusIdle,
    connecting: tr.practiceStatusConnecting,
    listening:  tr.practiceStatusListening,
    speaking:   tr.practiceStatusSpeaking,
    ending:     tr.practiceStatusEnding,
    error:      tr.practiceStatusError,
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden" style={{ background: '#000', fontFamily: "'Montserrat', sans-serif" }}>

      {/* ── SCENARIO PANEL (centered overlay) ────────────────────────────────── */}
      <div
        onClick={() => setPanelOpen(false)}
        style={{
          position: 'absolute', inset: 0, zIndex: 20,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          padding: '20px 16px',
          background: panelOpen ? 'rgba(0,0,0,0.80)' : 'rgba(0,0,0,0)',
          backdropFilter: panelOpen ? 'blur(4px)' : 'none',
          transition: 'background 0.22s ease',
          pointerEvents: panelOpen ? 'auto' : 'none',
          overflowY: 'auto',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 880, flexShrink: 0,
            background: '#060606',
            border: '1px solid rgba(215,255,0,0.12)',
            borderRadius: 20,
            overflow: 'hidden',
            opacity: panelOpen ? 1 : 0,
            transform: panelOpen ? 'translateY(0) scale(1)' : 'translateY(-12px) scale(0.97)',
            transition: 'opacity 0.22s ease, transform 0.22s ease',
            boxShadow: '0 32px 80px rgba(0,0,0,0.85), 0 0 0 1px rgba(215,255,0,0.04)',
          }}
        >
          {/* Panel header */}
          <div style={{
            padding: '14px 20px 12px',
            borderBottom: '1px solid rgba(215,255,0,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <span style={{ color: '#D7FF00', fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: "'Space Grotesk', sans-serif" }}>
              {t('practiceScenarios')}
            </span>
            <button
              onClick={() => setPanelOpen(false)}
              style={{ color: 'rgba(255,255,255,0.35)', fontSize: 22, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', fontWeight: 300 }}
            >
              ×
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(215,255,0,0.10)', padding: '0 20px' }}>
            {(['Clients', 'Educational'] as const).map(tab => {
              const label = tab === 'Clients' ? t('practiceClients') : t('practiceEducational')
              const isActive = activeTab === tab
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '12px 18px 10px',
                    fontSize: lang === 'ar' ? 15 : 11, fontWeight: 700, letterSpacing: '0.12em',
                    textTransform: 'uppercase', fontFamily: "'Space Grotesk', sans-serif",
                    color: isActive ? '#D7FF00' : 'rgba(255,255,255,0.35)',
                    borderBottom: isActive ? '2px solid #D7FF00' : '2px solid transparent',
                    marginBottom: -1,
                    transition: 'color 0.15s, border-color 0.15s',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Card grid — active tab only */}
          <div style={{ padding: '24px 20px 28px' }}>
            {(() => {
              const subcat = activeTab
              const subcatCats = Array.from(new Set(
                scenarios.filter(s => s.subcategory === subcat).map(s => s.category)
              ))
              return subcatCats.map((cat, ci) => {
                const catScenarios = scenarios.filter(s => s.subcategory === subcat && s.category === cat)
                return (
                  <div key={cat} style={{ marginBottom: ci < subcatCats.length - 1 ? 24 : 0 }}>
                    {/* Category label */}
                    <p style={{ fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(215,255,0,0.45)', marginBottom: 14, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>
                      {cat}
                    </p>

                    {/* 2-column card grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                          {catScenarios.map(s => {
                            const selected = selectedScenario === s.id
                            const scenarioLimitReached = isFreePlan && (dailyUsage[s.id] ?? 0) >= DAILY_LIMIT
                            const disabled = isActive || status === 'connecting' || scenarioLimitReached
                            const isClient = subcat === 'Clients'
                            const usedToday = isFreePlan ? (dailyUsage[s.id] ?? 0) : 0
                            const displayName = lang === 'ar' ? (s.nameAr ?? s.name ?? s.label) : (s.name || s.label)
                            const displayJob  = lang === 'ar' ? (s.jobAr  ?? s.job  ?? '') : (s.job  ?? '')
                            const displayTag  = lang === 'ar' ? (s.tagAr  ?? s.tag  ?? '') : (s.tag  ?? '')
                            const displayCtx  = lang === 'ar' ? (s.contextAr ?? s.context ?? '') : (s.context ?? '')
                            const displayGoal = lang === 'ar' ? (s.practiceGoalAr ?? s.practiceGoal ?? '') : (s.practiceGoal ?? '')

                            return (
                              <button
                                key={s.id}
                                onClick={() => { if (!disabled) { setSelectedScenario(s.id); setPanelOpen(false) } }}
                                disabled={disabled}
                                style={{
                                  display: 'block', width: '100%', textAlign: 'unset',
                                  background: selected ? 'rgba(215,255,0,0.06)' : 'rgba(255,255,255,0.02)',
                                  border: selected ? '1px solid rgba(215,255,0,0.45)' : '1px solid rgba(255,255,255,0.06)',
                                  boxShadow: selected ? '0 0 28px rgba(215,255,0,0.10)' : 'none',
                                  borderRadius: 16, padding: '22px 18px 18px',
                                  cursor: disabled ? 'not-allowed' : 'pointer',
                                  opacity: disabled ? 0.35 : 1,
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {/* Circular photo — 88px */}
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                                  <div style={{
                                    width: 88, height: 88, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                                    border: '2px solid rgba(215,255,0,0.45)',
                                    boxShadow: '0 0 22px rgba(215,255,0,0.18), 0 6px 20px rgba(0,0,0,0.6)',
                                  }}>
                                    <img
                                      src={AVATAR[s.id] ?? ''}
                                      alt={displayName}
                                      style={{
                                        width: '100%', height: '100%',
                                        objectFit: 'cover',
                                        objectPosition: AVATAR_POSITION[s.id] ?? 'center',
                                        display: 'block',
                                      }}
                                    />
                                  </div>
                                </div>

                                {/* Name + AI badge */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                                  <span style={{ color: '#fff', fontSize: 14, fontWeight: 700, lineHeight: 1.2, fontFamily: "'Montserrat', sans-serif" }}>
                                    {displayName}
                                  </span>
                                  <span style={{
                                    background: 'rgba(215,255,0,0.15)', color: '#D7FF00',
                                    border: '1px solid rgba(215,255,0,0.3)',
                                    borderRadius: 5, padding: '1px 6px', fontSize: 9, fontWeight: 700,
                                    fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.05em', flexShrink: 0,
                                  }}>
                                    AI
                                  </span>
                                </div>

                                {/* Job title */}
                                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.38)', fontSize: 11, marginBottom: 12, fontFamily: "'Montserrat', sans-serif" }}>
                                  {displayJob}
                                </p>

                                {/* Tag chips */}
                                <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
                                  <span style={{
                                    background: isClient ? 'rgba(215,255,0,0.09)' : 'rgba(255,255,255,0.05)',
                                    color: isClient ? 'rgba(215,255,0,0.75)' : 'rgba(255,255,255,0.32)',
                                    border: isClient ? '1px solid rgba(215,255,0,0.2)' : '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: 20, padding: '3px 10px',
                                    fontSize: 10, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600,
                                  }}>
                                    {isClient ? t('practiceClients') : t('practiceEducational')}
                                  </span>
                                  {displayTag && (
                                    <span style={{
                                      background: isClient ? 'rgba(215,255,0,0.09)' : 'rgba(255,255,255,0.05)',
                                      color: isClient ? 'rgba(215,255,0,0.75)' : 'rgba(255,255,255,0.32)',
                                      border: isClient ? '1px solid rgba(215,255,0,0.2)' : '1px solid rgba(255,255,255,0.08)',
                                      borderRadius: 20, padding: '3px 10px',
                                      fontSize: 10, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600,
                                    }}>
                                      {displayTag}
                                    </span>
                                  )}
                                </div>

                                {/* CTA button */}
                                <div style={{
                                  width: '100%', background: '#D7FF00', color: '#000',
                                  borderRadius: 24, padding: '10px 14px', fontWeight: 700,
                                  fontSize: 12, fontFamily: "'Montserrat', sans-serif",
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                                }}>
                                  <span style={{ fontSize: 14 }}>+</span>
                                  {t('practiceStartWith')} {displayName}
                                </div>

                                {isFreePlan && (
                                  <div style={{ textAlign: 'center', marginTop: 8 }}>
                                    <span style={{
                                      background: scenarioLimitReached ? 'rgba(255,60,60,0.12)' : 'rgba(255,255,255,0.05)',
                                      color: scenarioLimitReached ? 'rgba(255,100,100,0.9)' : 'rgba(255,255,255,0.38)',
                                      borderRadius: 4, padding: '3px 7px', fontSize: 9, lineHeight: 1.5,
                                      fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600,
                                      border: scenarioLimitReached ? '1px solid rgba(255,60,60,0.25)' : '1px solid rgba(255,255,255,0.08)',
                                      display: 'inline-block',
                                    }}>
                                      {scenarioLimitReached ? 'Limit reached' : `${DAILY_LIMIT - usedToday}/${DAILY_LIMIT} left today`}
                                    </span>
                                  </div>
                                )}

                                {/* Description */}
                                <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                                  <p style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.13em', color: 'rgba(255,255,255,0.22)', marginBottom: 5, fontFamily: "'Space Grotesk', sans-serif" }}>
                                    {isClient ? t('practiceScenarioLabel') : t('practiceAskAbout')}
                                  </p>
                                  <p style={{ fontSize: lang === 'ar' ? 13.5 : 11.5, color: 'rgba(255,255,255,0.52)', lineHeight: 1.65, marginBottom: 10, fontFamily: "'Montserrat', sans-serif" }}>
                                    {displayCtx}
                                  </p>
                                  <p style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.13em', color: 'rgba(255,255,255,0.22)', marginBottom: 5, fontFamily: "'Space Grotesk', sans-serif" }}>
                                    {isClient ? t('practiceWhatToPractice') : t('practiceHowToUse')}
                                  </p>
                                  <p style={{ fontSize: lang === 'ar' ? 13.5 : 11.5, color: 'rgba(255,255,255,0.52)', lineHeight: 1.65, fontFamily: "'Montserrat', sans-serif" }}>
                                    {displayGoal}
                                  </p>
                                </div>
                              </button>
                            )
                          })}
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        </div>
      </div>

      {/* ── TOGGLE BAR (always visible) ─────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, padding: '9px 14px',
        borderBottom: '1px solid rgba(215,255,0,0.08)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button
          onClick={() => setPanelOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'rgba(215,255,0,0.05)', border: '1px solid rgba(215,255,0,0.18)',
            borderRadius: 7, padding: '5px 10px', cursor: 'pointer',
            color: 'rgba(255,255,255,0.65)', fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', flexShrink: 0,
            transition: 'all 0.15s',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/>
          </svg>
          {t('practiceScenarios')}
        </button>
        {currentScenario && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10.5, fontFamily: "'Montserrat', sans-serif", fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {lang === 'ar' ? (currentScenario.nameAr ?? currentScenario.name ?? currentScenario.label) : (currentScenario.name || currentScenario.label)}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 10 }}>·</span>
            <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10, fontFamily: "'Montserrat', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {lang === 'ar' ? (currentScenario.jobAr ?? currentScenario.job) : currentScenario.job}
            </span>
          </div>
        )}
        {!currentScenario && (
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, fontFamily: "'Space Grotesk', sans-serif", fontStyle: 'italic' }}>
            {t('practiceNoScenario')}
          </span>
        )}
      </div>

      {/* ── ORB SECTION (center) ────────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center py-2" style={{ flexShrink: 0 }}>
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

        {downloadUrl && (
          <a
            href={downloadUrl.url}
            download={downloadUrl.filename}
            className="mt-2 text-xs underline"
            style={{ color: '#d7ff00' }}
            onClick={() => {
              setTimeout(() => {
                URL.revokeObjectURL(downloadUrl.url)
                setDownloadUrl(null)
              }, 2000)
            }}
          >
            ⬇ Download recording
          </a>
        )}
        {status === 'idle' && saveStatus === 'saving' && (
          <p className="mt-2 text-xs" style={{ color: 'rgba(215,255,0,0.5)' }}>Uploading session…</p>
        )}
        {status === 'idle' && saveStatus === 'saved' && (
          <p className="mt-2 text-xs" style={{ color: '#26D701' }}>✓ Session saved</p>
        )}
        {status === 'idle' && saveStatus === 'error' && (
          <p className="mt-2 text-xs" style={{ color: '#ef4444' }}>
            {saveError ? `Save failed: ${saveError}` : 'Upload failed — saved locally'}
          </p>
        )}
      </div>

      {/* ── TRANSCRIPT (scrollable middle) ──────────────────────────────────── */}
      <div
        ref={transcriptRef}
        className="flex-1 min-h-50 overflow-y-auto px-6 space-y-3 pb-4"
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

        {toolCallNote && (
          <div className="flex justify-center">
            <div
              className="px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5"
              style={{ background: 'rgba(215,255,0,0.06)', border: '1px solid rgba(215,255,0,0.2)', color: 'rgba(215,255,0,0.55)' }}
            >
              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
              Searching: {toolCallNote}
            </div>
          </div>
        )}

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
            {t('practiceNew')}
          </button>
        ) : (
          <div />
        )}

        {status === 'idle' || status === 'error' ? (
          <button
            onClick={startSession}
            disabled={!selectedScenario || (isFreePlan && (dailyUsage[selectedScenario] ?? 0) >= DAILY_LIMIT)}
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
            {saveStatus === 'saving' ? t('practiceSaving') : t('practiceStart')}
          </button>
        ) : status === 'connecting' || status === 'ending' ? (
          <button
            disabled
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm opacity-60 cursor-not-allowed"
            style={{ background: 'rgba(215,255,0,0.2)', color: '#D7FF00', border: '1px solid rgba(215,255,0,0.3)', fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
            {status === 'ending' ? t('practiceStatusEnding') : t('practiceStatusConnecting')}
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
            {t('practiceEndSession')}
          </button>
        )}
      </div>
    </div>
  )
}
