'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mp3Encoder } from '@breezystack/lamejs'
import AiOrb from '../practice/AiOrb'

const MODEL = 'models/gemini-3.1-flash-live-preview'
const WS_BASE = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'
const MIC_SAMPLE_RATE = 16000
const OUT_SAMPLE_RATE = 24000
const BUFFER_SIZE = 4096

type Status = 'idle' | 'connecting' | 'listening' | 'speaking' | 'ending' | 'error'

interface Turn { role: 'user' | 'assistant'; text: string }

interface AiChunk {
  wallStart: number
  samples: Float32Array
}

// ─── Pure helpers ───────────────────────────────────────────────────────────

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
  } catch { return null }
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

  return new Blob(mp3Parts as unknown as BlobPart[], { type: 'audio/mpeg' })
}


// ─── Goodbye detection ─────────────────────────────────────────────────────

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

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void
  onRecordingSaved?: (audioPath: string) => void
}

export default function ExamPhase3({ onComplete, onRecordingSaved }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [turns, setTurns] = useState<Turn[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [audioLevel, setAudioLevel] = useState(0)
  const [canFinish, setCanFinish] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')
  const [downloadUrl, setDownloadUrl] = useState<{ url: string; filename: string } | null>(null)
  const [sessionUsed, setSessionUsed] = useState(false)

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
  const transcriptRef = useRef<HTMLDivElement | null>(null)
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ringCtxRef = useRef<AudioContext | null>(null)
  const ringStoppedRef = useRef(true)
  const ringMinEndTimeRef = useRef(0)
  const goodbyeTriggeredRef = useRef(false)
  const lastAssistantTextRef = useRef('')
  const closeSessionRef = useRef<() => void>(() => {})

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

  const saveRecording = useCallback(async (chunks: AiChunk[], mic: Float32Array[], startMs: number) => {
    if (chunks.length === 0 && mic.length === 0) return
    const durationSeconds = Math.round((Date.now() - startMs) / 1000)

    let blob: Blob
    try {
      blob = await createStereoWavBlob(chunks, mic, startMs, OUT_SAMPLE_RATE)
      console.log('[SAVE] exam blob created, size:', blob.size)
    } catch (encErr) {
      const msg = encErr instanceof Error ? encErr.message : String(encErr)
      console.error('[SAVE] exam encoding failed:', msg)
      setSaveStatus('error')
      setSaveError(msg)
      return
    }

    // Store blob URL in state so a visible download button appears in the UI.
    try {
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const localUrl = URL.createObjectURL(blob)
      setDownloadUrl({ url: localUrl, filename: `exam-session-${ts}.mp3` })
      console.log('[SAVE] exam download URL set')
    } catch (downloadErr) {
      console.error('[SAVE] exam local download failed:', downloadErr)
    }

    setSaveStatus('saving')
    try {
      const urlRes = await fetch('/api/exam/signed-upload', { method: 'POST' })
      if (!urlRes.ok) throw new Error('Could not get upload URL')
      const { signedUrl, audioPath } = await urlRes.json()

      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'audio/mpeg' },
        body: blob,
      })
      if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`)

      await fetch('/api/exam/save-recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioPath, durationSeconds }),
      })
      setSaveStatus('saved')
      onRecordingSaved?.(audioPath)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setSaveStatus('error')
      setSaveError(msg)
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

    // Reset UI immediately
    aiChunksRef.current = []
    micSamplesRef.current = []
    setStatusSync('idle')
    setTurns([])
    setErrorMsg('')

    // Defer heavy MP3 encoding so the UI state update flushes first
    if (chunks.length > 0 || mic.length > 0) {
      setTimeout(async () => {
        try {
          await saveRecording(chunks, mic, startMs)
        } catch (e) {
          console.error('[ExamPhase3] MP3 encoding failed:', e)
        }
      }, 50)
    }
  }, [stopMic, stopPlayback, saveRecording, setStatusSync])

  useEffect(() => {
    return () => {
      closeSession()
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current)
    }
  }, [closeSession])

  // Stop ring when no longer connecting — delay until minimum ring duration has elapsed
  useEffect(() => {
    if (status === 'connecting') return
    const delay = Math.max(0, ringMinEndTimeRef.current - Date.now())
    const t = setTimeout(stopRingSound, delay)
    return () => clearTimeout(t)
  }, [status, stopRingSound])

  const isActive = status === 'listening' || status === 'speaking'

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
  }, [])

  const handleMessage = useCallback(
    (raw: string) => {
      let msg: Record<string, unknown>
      try { msg = JSON.parse(raw) } catch { return }

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
          if (typeof part.text === 'string' && part.text.trim()) appendAssistant(part.text)
        }
      }

      const outTx = sc.outputTranscription as Record<string, unknown> | undefined
      if (outTx?.text) appendAssistant(outTx.text as string)

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

  const startMic = useCallback((ws: WebSocket) => {
    navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(stream => {
      streamRef.current = stream
      const ctx = new AudioContext({ sampleRate: MIC_SAMPLE_RATE })
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      sourceRef.current = source
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1)
      processorRef.current = processor

      micStartWallRef.current = Date.now()

      processor.onaudioprocess = (e) => {
        const channelData = e.inputBuffer.getChannelData(0)
        micSamplesRef.current.push(new Float32Array(channelData))

        let sum = 0
        for (let i = 0; i < channelData.length; i++) sum += channelData[i] * channelData[i]
        const rms = Math.sqrt(sum / channelData.length)
        setAudioLevel(Math.min(1, rms * 8))

        if (ws.readyState !== WebSocket.OPEN) return
        const pcm = floatTo16BitPCM(channelData)
        ws.send(JSON.stringify({ realtimeInput: { audio: { data: arrayBufferToBase64(pcm), mimeType: `audio/pcm;rate=${MIC_SAMPLE_RATE}` } } }))
      }

      source.connect(processor)
      processor.connect(ctx.destination)
    }).catch(() => {
      setErrorMsg('Microphone access denied')
      setStatusSync('error')
    })
  }, [setStatusSync])

  const startSession = useCallback(async () => {
    setSessionUsed(true)
    setStatusSync('connecting')
    startRingSound()
    setErrorMsg('')
    setTurns([])
    setSaveStatus('idle')
    intentionalCloseRef.current = false
    aiChunksRef.current = []
    micSamplesRef.current = []
    micStartWallRef.current = 0
    ctxCreatedAtWallRef.current = 0
    lastTurnCompleteRef.current = true
    goodbyeTriggeredRef.current = false
    lastAssistantTextRef.current = ''
    stopPlayback()

    try {
      const tokenRes = await fetch('/api/gemini-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: 'dr_yasmine' }),
      })
      if (!tokenRes.ok) throw new Error('Could not get session token')
      const { token, systemPrompt } = await tokenRes.json()

      const ws = new WebSocket(`${WS_BASE}?key=${token}`)
      wsRef.current = ws

      ws.onopen = () => {
        ws.send(JSON.stringify({
          setup: {
            model: MODEL,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
            },
            systemInstruction: { parts: [{ text: systemPrompt }] },
            realtimeInputConfig: { automaticActivityDetection: {} },
          }
        }))
      }

      ws.onmessage = (e) => {
        const process = (text: string) => {
          let msg: Record<string, unknown>
          try { msg = JSON.parse(text) } catch { return }
          if ('setupComplete' in msg || 'setup_complete' in msg) {
            setStatusSync('listening')
            startMic(ws)
            finishTimerRef.current = setTimeout(() => setCanFinish(true), 30000)
            return
          }
          handleMessage(text)
        }
        if (typeof e.data === 'string') process(e.data)
        else if (e.data instanceof Blob) e.data.text().then(process).catch(() => {})
      }

      ws.onerror = () => {
        if (!intentionalCloseRef.current) { setStatusSync('error'); setErrorMsg('Connection error') }
      }
      ws.onclose = () => {
        if (!intentionalCloseRef.current && !goodbyeTriggeredRef.current) setStatusSync('idle')
        stopMic()
        setCanFinish(true)
      }
    } catch (e) {
      setStatusSync('error')
      setErrorMsg(e instanceof Error ? e.message : 'Failed to start session')
    }
  }, [setStatusSync, handleMessage, startMic, stopMic, stopPlayback, startRingSound])

  const statusLabels: Record<Status, string> = {
    idle: 'جاهز للمرحلة الثالثة',
    connecting: 'بيسمعك…',
    listening: 'بيسمعك…',
    speaking: 'بيتكلم…',
    ending: 'جاري الإنهاء…',
    error: 'خطأ في الاتصال',
  }

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: "'Space Grotesk', sans-serif" }}>
          المرحلة الثالثة — محاكاة الكول
        </span>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
          د. ياسمين — Cold Call
        </span>
      </div>

      {/* Instructions (before start) */}
      {status === 'idle' && turns.length === 0 && (
        <div style={{ background: 'rgba(215,255,0,0.05)', border: '1px solid rgba(215,255,0,0.15)', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.7 }}>
            هتتكلم مع د. ياسمين — دكتورة أسنان بعتت اهتمام في وحدة عيادية في التجمع الخامس. الـ AI هيلعب دورها وأنت تلعب دور الـ agent. جرب تعرض المشاريع المناسبة وتتعامل مع أسئلتها.
          </p>
        </div>
      )}

      {/* Orb */}
      <div className="flex justify-center" style={{ marginBottom: 12 }}>
        <AiOrb status={status} audioLevel={audioLevel} />
      </div>

      {/* Status label */}
      <div className="text-center mb-4">
        <span style={{ fontSize: 13, fontWeight: 600, color: status === 'error' ? '#f87171' : status === 'idle' ? 'rgba(255,255,255,0.3)' : '#D7FF00', fontFamily: "'Space Grotesk', sans-serif" }}>
          {statusLabels[status]}
        </span>
        {downloadUrl && (
          <a
            href={downloadUrl.url}
            download={downloadUrl.filename}
            style={{ color: '#d7ff00', fontSize: 12, marginTop: 4, display: 'block', textDecoration: 'underline' }}
            onClick={() => {
              setTimeout(() => {
                URL.revokeObjectURL(downloadUrl.url)
                setDownloadUrl(null)
              }, 2000)
            }}
          >
            ⬇ تحميل التسجيل
          </a>
        )}
        {saveStatus === 'saving' && <div style={{ color: 'rgba(215,255,0,0.5)', fontSize: 12, marginTop: 4 }}>جاري حفظ التسجيل…</div>}
        {saveStatus === 'saved' && <div style={{ color: '#26D701', fontSize: 12, marginTop: 4 }}>✓ تم حفظ التسجيل</div>}
        {saveStatus === 'error' && (
          <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>
            {saveError ? `خطأ: ${saveError}` : 'فشل الرفع — تم التحميل محلياً'}
          </div>
        )}
        {errorMsg && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errorMsg}</div>}
      </div>

      {/* Transcript — in RTL: justify-start = RIGHT (user), justify-end = LEFT (AI) */}
      {turns.length > 0 && (
        <div ref={transcriptRef} className="flex-1 overflow-y-auto space-y-3 mb-4" style={{ maxHeight: 200 }}>
          {turns.map((turn, i) => (
            <div key={i} className={`flex ${turn.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div style={{
                maxWidth: '80%', padding: '8px 14px', borderRadius: 10, fontSize: 13, lineHeight: 1.6,
                background: turn.role === 'user' ? 'rgba(215,255,0,0.12)' : 'rgba(255,255,255,0.06)',
                border: turn.role === 'user' ? '1px solid rgba(215,255,0,0.2)' : '1px solid rgba(255,255,255,0.08)',
                color: turn.role === 'user' ? 'rgba(215,255,0,0.9)' : 'rgba(255,255,255,0.8)',
              }}>
                {turn.text}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 justify-center mt-auto">
        {status === 'idle' && !sessionUsed && (
          <button
            onClick={startSession}
            style={{ background: '#D7FF00', color: '#000', fontWeight: 700, borderRadius: 10, padding: '12px 32px', fontSize: 14, border: 'none', cursor: 'pointer' }}
          >
            ابدأ المكالمة
          </button>
        )}

        {(status === 'listening' || status === 'speaking' || status === 'connecting') && (
          <button
            onClick={closeSession}
            style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', fontWeight: 700, borderRadius: 10, padding: '10px 24px', fontSize: 13, cursor: 'pointer' }}
          >
            إنهاء المكالمة
          </button>
        )}

        {canFinish && (
          <button
            onClick={onComplete}
            style={{ background: '#D7FF00', color: '#000', fontWeight: 700, borderRadius: 10, padding: '12px 32px', fontSize: 14, border: 'none', cursor: 'pointer' }}
          >
            إنهاء الامتحان ✓
          </button>
        )}
      </div>
    </div>
  )
}
