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

// Linear resample — used to bring mic (16kHz) up to AI sample rate (24kHz)
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

// Stereo WAV: channel 0 = AI (left), channel 1 = mic (right), both at sampleRate
function createStereoWavBlob(
  aiSamples: Float32Array[],
  micSamples: Float32Array[],
  sampleRate: number,
): Blob {
  const ai = concatFloat32(aiSamples)
  const micRaw = concatFloat32(micSamples)
  // Resample mic from MIC_SAMPLE_RATE → sampleRate
  const mic = resampleLinear(micRaw, MIC_SAMPLE_RATE, sampleRate)

  const len = Math.max(ai.length, mic.length)
  const interleaved = new Int16Array(len * 2)  // stereo interleaved
  for (let i = 0; i < len; i++) {
    const aiVal = ai[i] ?? 0
    const micVal = mic[i] ?? 0
    interleaved[i * 2]     = Math.max(-32768, Math.min(32767, Math.round(aiVal  * 32767)))
    interleaved[i * 2 + 1] = Math.max(-32768, Math.min(32767, Math.round(micVal * 32767)))
  }

  const dataLen = interleaved.buffer.byteLength
  const buf = new ArrayBuffer(44 + dataLen)
  const v = new DataView(buf)
  v.setUint32(0, 0x52494646, false)        // 'RIFF'
  v.setUint32(4, 36 + dataLen, true)
  v.setUint32(8, 0x57415645, false)        // 'WAVE'
  v.setUint32(12, 0x666d7420, false)       // 'fmt '
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)                 // PCM
  v.setUint16(22, 2, true)                 // stereo
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2 * 2, true) // byte rate
  v.setUint16(32, 4, true)                 // block align (2ch × 2 bytes)
  v.setUint16(34, 16, true)
  v.setUint32(36, 0x64617461, false)       // 'data'
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
  // Fix 2: voice preview state
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewPlaying, setPreviewPlaying] = useState(false)

  // Ref mirrors for stale-closure-safe WS handlers
  const statusRef = useRef<Status>('idle')
  const setStatusSync = useCallback((s: Status) => { statusRef.current = s; setStatus(s) }, [])

  // Audio refs
  const wsRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const playbackCtxRef = useRef<AudioContext | null>(null)
  const nextPlayTimeRef = useRef(0)
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([])  // for barge-in stop
  const aiSamplesRef = useRef<Float32Array[]>([])               // AI audio for WAV (with silence gaps)
  const micSamplesRef = useRef<Float32Array[]>([])              // mic audio for WAV
  // Fix 5: track AI recording frame count and session start time for silence gaps
  const aiRecordingFramesRef = useRef(0)
  const sessionStartTimeRef = useRef(0)
  // Fix 2: preview audio context + WS
  const previewCtxRef = useRef<AudioContext | null>(null)
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const previewWsRef = useRef<WebSocket | null>(null)
  // Suppress false WS errors when we intentionally close the session
  const intentionalCloseRef = useRef(false)

  // Stable refs for values used inside WS callbacks
  const selectedVoiceRef = useRef(selectedVoice)
  const selectedScenarioRef = useRef(selectedScenario)
  useEffect(() => { selectedVoiceRef.current = selectedVoice }, [selectedVoice])
  useEffect(() => { selectedScenarioRef.current = selectedScenario }, [selectedScenario])

  const transcriptRef = useRef<HTMLDivElement | null>(null)

  // Load scenarios on mount
  useEffect(() => {
    fetch('/api/gemini-scenarios')
      .then((r) => r.json())
      .then((list: ScenarioOption[]) => {
        setScenarios(list)
        if (list.length > 0) setSelectedScenario(list[0].id)
      })
      .catch(console.error)
  }, [])

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [turns])

  // ── Stop mic ──────────────────────────────────────────────────────────────────
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

  // ── Stop all scheduled playback (barge-in) ────────────────────────────────────
  const stopPlayback = useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try { src.stop() } catch { /* already ended */ }
    }
    activeSourcesRef.current = []
    nextPlayTimeRef.current = 0
  }, [])

  // ── Save recording and trigger download ───────────────────────────────────────
  const saveRecording = useCallback(() => {
    if (aiSamplesRef.current.length === 0) return
    const blob = createStereoWavBlob(aiSamplesRef.current, micSamplesRef.current, OUT_SAMPLE_RATE)
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    triggerDownload(blob, `gemini-session-${ts}.wav`)
    aiSamplesRef.current = []
    micSamplesRef.current = []
    aiRecordingFramesRef.current = 0
    setHasRecording(false)
  }, [])

  // ── Close session ─────────────────────────────────────────────────────────────
  const closeSession = useCallback(() => {
    // Save recording before tearing down
    if (aiSamplesRef.current.length > 0) saveRecording()
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

  // Cleanup on unmount
  useEffect(() => { return () => closeSession() }, [closeSession])

  // ── Fix 2: Voice preview (uses the same Live API as main session) ──────────────
  const stopPreview = useCallback(() => {
    previewWsRef.current?.close()
    previewWsRef.current = null
    try { previewSourceRef.current?.stop() } catch { /* ended */ }
    previewSourceRef.current = null
    previewCtxRef.current?.close().catch(() => {})
    previewCtxRef.current = null
    setPreviewPlaying(false)
    setPreviewLoading(false)
  }, [])

  const playVoicePreview = useCallback(async () => {
    if (previewPlaying || previewLoading) { stopPreview(); return }
    setPreviewLoading(true)

    let token: string
    try {
      const res = await fetch('/api/gemini-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: selectedScenarioRef.current }),
      })
      if (!res.ok) throw new Error('Token fetch failed')
      token = (await res.json()).token
    } catch (e) {
      console.error('[VoicePreview] token error', e)
      setPreviewLoading(false)
      return
    }

    // Create AudioContext immediately (within user-gesture context)
    const ctx = new AudioContext({ sampleRate: OUT_SAMPLE_RATE })
    previewCtxRef.current = ctx
    let nextPlayTime = 0
    let setupDone = false
    let receivedAudio = false

    const ws = new WebSocket(`${WS_BASE}?key=${token}`)
    previewWsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({
        setup: {
          model: MODEL,
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } } },
          },
        },
      }))
    }

    ws.onmessage = async (e) => {
      const raw = typeof e.data === 'string' ? e.data : await (e.data as Blob).text()
      let msg: Record<string, unknown>
      try { msg = JSON.parse(raw) } catch { return }

      if ('setupComplete' in msg || 'setup_complete' in msg) {
        setupDone = true
        ws.send(JSON.stringify({
          clientContent: {
            turns: [{ role: 'user', parts: [{ text: 'Say: "Hello! I\'m ready for today\'s training session."' }] }],
            turnComplete: true,
          },
        }))
        return
      }

      const sc = msg.serverContent as Record<string, unknown> | undefined
      if (!sc || !setupDone) return

      // Stream audio chunks as they arrive (same pattern as main session)
      const parts = ((sc.modelTurn as Record<string, unknown> | undefined)?.parts as Array<Record<string, unknown>>) ?? []
      for (const p of parts) {
        const data = ((p.inlineData as Record<string, unknown> | undefined)?.data) as string | undefined
        if (!data) continue
        const samples = base64ToFloat32(data)
        if (!samples?.length) continue

        if (!receivedAudio) {
          receivedAudio = true
          setPreviewLoading(false)
          setPreviewPlaying(true)
        }

        const buf = ctx.createBuffer(1, samples.length, OUT_SAMPLE_RATE)
        buf.copyToChannel(new Float32Array(samples), 0)
        const src = ctx.createBufferSource()
        src.buffer = buf
        src.connect(ctx.destination)
        const startAt = Math.max(ctx.currentTime, nextPlayTime)
        src.start(startAt)
        nextPlayTime = startAt + buf.duration
        previewSourceRef.current = src
      }

      // When model turn is done, schedule cleanup after last chunk finishes
      if (sc.turnComplete) {
        ws.close()
        previewWsRef.current = null
        const msRemaining = Math.max(0, (nextPlayTime - ctx.currentTime) * 1000) + 300
        setTimeout(() => {
          setPreviewPlaying(false)
          ctx.close().catch(() => {})
          if (previewCtxRef.current === ctx) previewCtxRef.current = null
        }, msRemaining)
        if (!receivedAudio) { setPreviewLoading(false) }
      }
    }

    ws.onerror = () => stopPreview()
    ws.onclose = () => { if (!receivedAudio) stopPreview() }
  }, [selectedVoice, previewPlaying, previewLoading, stopPreview])

  // Stop preview when voice changes
  useEffect(() => { stopPreview() }, [selectedVoice, stopPreview])

  // ── Audio playback ─────────────────────────────────────────────────────────────
  const playAudioChunk = useCallback((b64: string) => {
    const samples = base64ToFloat32(b64)
    if (!samples || samples.length === 0) return

    if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
      playbackCtxRef.current = new AudioContext({ sampleRate: OUT_SAMPLE_RATE })
      sessionStartTimeRef.current = playbackCtxRef.current.currentTime
      nextPlayTimeRef.current = 0
      aiRecordingFramesRef.current = 0
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

    // Fix 5: insert silence into AI recording track to match playback timing
    const startFrame = Math.round((startAt - sessionStartTimeRef.current) * OUT_SAMPLE_RATE)
    const silenceNeeded = startFrame - aiRecordingFramesRef.current
    if (silenceNeeded > 0) {
      aiSamplesRef.current.push(new Float32Array(silenceNeeded))
      aiRecordingFramesRef.current += silenceNeeded
    }
    aiSamplesRef.current.push(new Float32Array(samples))
    aiRecordingFramesRef.current += samples.length
    setHasRecording(true)

    // Track for barge-in
    activeSourcesRef.current.push(src)
    src.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== src)
      if (activeSourcesRef.current.length === 0) {
        setStatus((prev) => (prev === 'speaking' ? 'listening' : prev))
      }
    }

    setStatus((prev) => (prev === 'listening' || prev === 'connecting' ? 'speaking' : prev))
  }, [])

  // ── WebSocket message handler ─────────────────────────────────────────────────
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

      // Barge-in: server tells us it stopped speaking
      if (sc.interrupted) {
        stopPlayback()
        setStatusSync('listening')
        return
      }

      // Model audio + text
      const modelTurn = sc.modelTurn as Record<string, unknown> | undefined
      if (modelTurn) {
        const parts = (modelTurn.parts as Array<Record<string, unknown>>) ?? []
        for (const part of parts) {
          const inlineData = part.inlineData as Record<string, unknown> | undefined
          if (inlineData?.data) playAudioChunk(inlineData.data as string)
          if (typeof part.text === 'string' && part.text.trim()) {
            setTurns((prev) => {
              const last = prev[prev.length - 1]
              if (last?.role === 'assistant') {
                return [...prev.slice(0, -1), { role: 'assistant', text: last.text + part.text }]
              }
              return [...prev, { role: 'assistant', text: part.text as string }]
            })
          }
        }
      }

      // Fix 3: outputTranscription — APPEND (was incorrectly replacing)
      const outTx = sc.outputTranscription as Record<string, unknown> | undefined
      if (outTx?.text) {
        setTurns((prev) => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant') {
            return [...prev.slice(0, -1), { role: 'assistant', text: last.text + (outTx.text as string) }]
          }
          return [...prev, { role: 'assistant', text: outTx.text as string }]
        })
      }

      // Fix 4: inputTranscription — insert user turn BEFORE last assistant turn if AI already responded
      const inTx = sc.inputTranscription as Record<string, unknown> | undefined
      if (inTx?.text) {
        setTurns((prev) => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant') {
            // AI already responded — place user turn before the AI turn
            return [...prev.slice(0, -1), { role: 'user', text: inTx.text as string }, last]
          }
          return [...prev, { role: 'user', text: inTx.text as string }]
        })
      }
    },
    [playAudioChunk, stopPlayback, setStatusSync]
  )

  // ── Start session ─────────────────────────────────────────────────────────────
  const startSession = useCallback(async () => {
    stopPreview()
    setStatusSync('connecting')
    setOpen(true)
    setErrorMsg('')
    setTurns([])
    setHasRecording(false)
    aiSamplesRef.current = []
    micSamplesRef.current = []
    aiRecordingFramesRef.current = 0
    stopPlayback()

    // 1. Auth-gated token + system prompt
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

    // 2. WebSocket
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
      if (intentionalCloseRef.current) return  // suppress errors from deliberate close
      console.error('[GeminiVoice] WS error', e)
      setStatusSync('error')
      setErrorMsg('WebSocket error — check browser console.')
    }

    ws.onclose = (e) => {
      const wasIntentional = intentionalCloseRef.current
      intentionalCloseRef.current = false
      if (wasIntentional) { stopMic(); return }  // clean exit, no error state
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

    // 3. Microphone
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

      processor.onaudioprocess = (ev) => {
        const channelData = ev.inputBuffer.getChannelData(0)
        // Collect mic samples for recording
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

  // ── New conversation — reset to idle+open so user can change scenario/voice ───
  const newConversation = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    stopMic()
    stopPlayback()
    playbackCtxRef.current?.close().catch(() => {})
    playbackCtxRef.current = null
    aiSamplesRef.current = []
    micSamplesRef.current = []
    aiRecordingFramesRef.current = 0
    setHasRecording(false)
    setTurns([])
    setErrorMsg('')
    setStatusSync('idle')
    setOpen(true)   // keep panel open — controls reappear, user picks scenario/voice then clicks mic
  }, [stopMic, stopPlayback, setStatusSync])

  // ── Status helpers ────────────────────────────────────────────────────────────
  const isActive = status === 'listening' || status === 'speaking'
  const statusLabel: Record<Status, string> = {
    idle: 'Start session',
    connecting: 'Connecting…',
    listening: 'Listening…',
    speaking: 'Speaking…',
    error: 'Error — tap to retry',
  }
  const isPulsing = status === 'listening' || status === 'speaking'

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-105 rounded-xl border border-gray-700 bg-gray-900 shadow-2xl flex flex-col overflow-hidden">

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                status === 'listening' ? 'bg-green-400' :
                status === 'speaking'  ? 'bg-blue-400' :
                status === 'connecting' ? 'bg-yellow-400 animate-pulse' :
                status === 'error'     ? 'bg-red-400' : 'bg-gray-500'
              }`} />
              <span className="text-sm font-medium text-white">Gemini Voice</span>
            </div>
            <div className="flex items-center gap-2">
              {isActive && (
                <button
                  onClick={newConversation}
                  className="text-gray-400 hover:text-white text-xs transition-colors px-1.5 py-0.5 rounded border border-gray-700 hover:border-gray-500"
                  title="Start new conversation"
                >
                  ↺ New
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

          {/* ── Controls (shown when idle) ── */}
          {!isActive && status !== 'connecting' && (
            <div className="px-4 py-3 border-b border-gray-700 space-y-2">
              {/* Scenario selector */}
              {scenarios.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Scenario</label>
                  <select
                    value={selectedScenario}
                    onChange={(e) => setSelectedScenario(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
                  >
                    {scenarios.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Voice selector with preview button */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Voice</label>
                <div className="flex gap-2">
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
                  >
                    {VOICES.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  {/* Fix 2: Preview button */}
                  <button
                    onClick={playVoicePreview}
                    disabled={previewLoading}
                    title={previewPlaying ? 'Stop preview' : 'Preview this voice'}
                    className="flex items-center justify-center w-8 h-8 rounded-md bg-gray-800 border border-gray-700 hover:border-violet-500 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    {previewLoading ? (
                      <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    ) : previewPlaying ? (
                      // Stop icon
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="4" y="4" width="16" height="16" rx="2"/>
                      </svg>
                    ) : (
                      // Play icon
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              {/* Fix 1: Prominent Start button in controls area */}
              <button
                onClick={startSession}
                className="w-full mt-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
                  <path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.07A7 7 0 0 0 19 11Z" />
                </svg>
                Start Session
              </button>
            </div>
          )}

          {/* ── Transcript ── */}
          <div
            ref={transcriptRef}
            className="flex-1 overflow-y-auto p-3 space-y-2 min-h-40 max-h-120 text-sm"
          >
            {turns.length === 0 && !errorMsg && (
              <p className="text-gray-500 text-xs text-center mt-6">
                {status === 'connecting' ? 'Connecting…' : 'Start speaking…'}
              </p>
            )}
            {turns.map((t, i) => (
              <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${
                  t.role === 'user'
                    ? 'max-w-[75%] bg-violet-700 text-white'
                    : 'w-full bg-gray-700 text-gray-100'
                }`}>
                  {t.text}
                </div>
              </div>
            ))}
            {errorMsg && (
              <p className="text-red-400 text-xs text-center px-2">{errorMsg}</p>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-between gap-2">
            {/* Fix 1: Prominent Stop button when session is active */}
            {isActive || status === 'connecting' ? (
              <button
                onClick={closeSession}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors"
                title="Stop session and save recording"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                  <rect x="4" y="4" width="16" height="16" rx="2"/>
                </svg>
                Stop Session
              </button>
            ) : (
              <span className="text-xs text-gray-400">{statusLabel[status]}</span>
            )}
            {hasRecording && isActive && (
              <button
                onClick={saveRecording}
                className="text-xs text-gray-400 hover:text-white transition-colors ml-auto"
                title="Download recording now"
              >
                ⬇ Save recording
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Floating button: mic to open/start, red stop square when active ── */}
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
          // Stop icon (square)
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 relative">
            <rect x="5" y="5" width="14" height="14" rx="2"/>
          </svg>
        ) : (
          // Mic icon
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 relative">
            <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
            <path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.07A7 7 0 0 0 19 11Z" />
          </svg>
        )}
      </button>
    </div>
  )
}
