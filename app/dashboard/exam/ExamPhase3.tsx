'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import AiOrb from '../practice/AiOrb'

const MODEL = 'models/gemini-3.1-flash-live-preview'
const WS_BASE = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'
const MIC_SAMPLE_RATE = 16000
const OUT_SAMPLE_RATE = 24000
const BUFFER_SIZE = 4096

type Status = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error'

interface Turn { role: 'user' | 'assistant'; text: string }

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

interface Props {
  onComplete: () => void
}

export default function ExamPhase3({ onComplete }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [turns, setTurns] = useState<Turn[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [audioLevel, setAudioLevel] = useState(0)
  const [canFinish, setCanFinish] = useState(false)

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
  const intentionalCloseRef = useRef(false)
  const lastTurnCompleteRef = useRef(true)
  const audioLevelRafRef = useRef<number>(0)
  const transcriptRef = useRef<HTMLDivElement | null>(null)
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      try { src.stop() } catch { /* ended */ }
    }
    activeSourcesRef.current = []
    nextPlayTimeRef.current = 0
  }, [])

  const closeSession = useCallback(() => {
    intentionalCloseRef.current = true
    wsRef.current?.close()
    wsRef.current = null
    stopMic()
    stopPlayback()
    playbackCtxRef.current?.close().catch(() => {})
    playbackCtxRef.current = null
    setStatusSync('idle')
    setTurns([])
    setErrorMsg('')
  }, [stopMic, stopPlayback, setStatusSync])

  useEffect(() => { return () => { closeSession(); if (finishTimerRef.current) clearTimeout(finishTimerRef.current) } }, [closeSession])

  const playAudioChunk = useCallback((b64: string) => {
    const samples = base64ToFloat32(b64)
    if (!samples || samples.length === 0) return

    if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
      playbackCtxRef.current = new AudioContext({ sampleRate: OUT_SAMPLE_RATE })
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
    activeSourcesRef.current.push(src)
    src.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== src)
      if (activeSourcesRef.current.length === 0 && statusRef.current === 'speaking') {
        setStatusSync('listening')
      }
    }
  }, [setStatusSync])

  const handleMessage = useCallback((event: MessageEvent) => {
    let msg: Record<string, unknown>
    try { msg = JSON.parse(event.data) } catch { return }

    const sc = msg.serverContent as Record<string, unknown> | undefined
    if (!sc) return

    const modelTurn = sc.modelTurn as Record<string, unknown> | undefined
    if (modelTurn) {
      const parts = (modelTurn.parts as Record<string, unknown>[]) ?? []
      for (const part of parts) {
        const inlineData = part.inlineData as Record<string, unknown> | undefined
        if (inlineData?.data) {
          setStatusSync('speaking')
          playAudioChunk(inlineData.data as string)
        }
      }
    }

    const inputTx = sc.inputTranscription as Record<string, unknown> | undefined
    const outputTx = sc.outputTranscription as Record<string, unknown> | undefined
    if (inputTx?.text) setTurns(t => [...t, { role: 'user', text: inputTx.text as string }])
    if (outputTx?.text) setTurns(t => [...t, { role: 'assistant', text: outputTx.text as string }])

    if (sc.turnComplete) {
      lastTurnCompleteRef.current = true
      if (statusRef.current !== 'speaking') setStatusSync('listening')
    }
    if (sc.interrupted) lastTurnCompleteRef.current = false
  }, [setStatusSync, playAudioChunk])

  const startSession = useCallback(async () => {
    setStatusSync('connecting')
    setErrorMsg('')
    setTurns([])
    intentionalCloseRef.current = false

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
            generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } } },
            systemInstruction: { parts: [{ text: systemPrompt }] },
            realtimeInputConfig: { automaticActivityDetection: {} },
          }
        }))
      }

      const processMessage = (text: string) => {
        let msg: Record<string, unknown>
        try { msg = JSON.parse(text) } catch { return }
        if (msg.setupComplete) {
          setStatusSync('listening')
          startMic()
          finishTimerRef.current = setTimeout(() => setCanFinish(true), 30000)
          return
        }
        handleMessage({ data: text } as MessageEvent)
      }

      ws.onmessage = (e) => {
        if (typeof e.data === 'string') processMessage(e.data)
        else if (e.data instanceof Blob) e.data.text().then(processMessage).catch(() => {})
      }

      ws.onerror = () => {
        if (!intentionalCloseRef.current) { setStatusSync('error'); setErrorMsg('Connection error') }
      }
      ws.onclose = () => {
        if (!intentionalCloseRef.current) { setStatusSync('idle') }
        stopMic()
        setCanFinish(true)
      }
    } catch (e) {
      setStatusSync('error')
      setErrorMsg(e instanceof Error ? e.message : 'Failed to start session')
    }
  }, [setStatusSync, handleMessage, stopMic])

  function startMic() {
    navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(stream => {
      streamRef.current = stream
      const ctx = new AudioContext({ sampleRate: MIC_SAMPLE_RATE })
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      sourceRef.current = source
      const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0)
        const pcm = floatTo16BitPCM(inputData)
        const b64 = arrayBufferToBase64(pcm)
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ realtimeInput: { audio: { data: b64, mimeType: 'audio/pcm;rate=16000' } } }))
        }

        // audio level for orb
        let sum = 0
        for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i]
        const rms = Math.sqrt(sum / inputData.length)
        const level = Math.min(1, rms * 8)
        setAudioLevel(level)
      }

      source.connect(processor)
      processor.connect(ctx.destination)
    }).catch(() => {
      setErrorMsg('Microphone access denied')
    })
  }

  const statusLabels: Record<Status, string> = {
    idle: 'جاهز للمرحلة الثالثة',
    connecting: 'جاري الاتصال…',
    listening: 'بيسمعك…',
    speaking: 'بيتكلم…',
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
        <div
          style={{
            background: 'rgba(215,255,0,0.05)', border: '1px solid rgba(215,255,0,0.15)',
            borderRadius: 12, padding: '16px 20px', marginBottom: 16,
          }}
        >
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
        <span
          style={{
            fontSize: 13, fontWeight: 600,
            color: status === 'error' ? '#f87171' : status === 'idle' ? 'rgba(255,255,255,0.3)' : '#D7FF00',
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {statusLabels[status]}
        </span>
        {errorMsg && <div style={{ color: '#f87171', fontSize: 12, marginTop: 4 }}>{errorMsg}</div>}
      </div>

      {/* Transcript */}
      {turns.length > 0 && (
        <div
          ref={transcriptRef}
          className="flex-1 overflow-y-auto space-y-3 mb-4"
          style={{ maxHeight: 200 }}
        >
          {turns.map((turn, i) => (
            <div key={i} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                style={{
                  maxWidth: '80%', padding: '8px 14px', borderRadius: 10, fontSize: 13, lineHeight: 1.6,
                  background: turn.role === 'user' ? 'rgba(215,255,0,0.12)' : 'rgba(255,255,255,0.06)',
                  border: turn.role === 'user' ? '1px solid rgba(215,255,0,0.2)' : '1px solid rgba(255,255,255,0.08)',
                  color: turn.role === 'user' ? 'rgba(215,255,0,0.9)' : 'rgba(255,255,255,0.8)',
                }}
              >
                {turn.text}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 justify-center mt-auto">
        {status === 'idle' && (
          <button
            onClick={startSession}
            style={{
              background: '#D7FF00', color: '#000', fontWeight: 700, borderRadius: 10,
              padding: '12px 32px', fontSize: 14, border: 'none', cursor: 'pointer',
            }}
          >
            ابدأ المكالمة
          </button>
        )}

        {(status === 'listening' || status === 'speaking' || status === 'connecting') && (
          <button
            onClick={closeSession}
            style={{
              background: 'rgba(248,113,113,0.15)', color: '#f87171',
              border: '1px solid rgba(248,113,113,0.3)', fontWeight: 700, borderRadius: 10,
              padding: '10px 24px', fontSize: 13, cursor: 'pointer',
            }}
          >
            إنهاء المكالمة
          </button>
        )}

        {canFinish && (
          <button
            onClick={onComplete}
            style={{
              background: '#D7FF00', color: '#000', fontWeight: 700, borderRadius: 10,
              padding: '12px 32px', fontSize: 14, border: 'none', cursor: 'pointer',
            }}
          >
            إنهاء الامتحان ✓
          </button>
        )}
      </div>
    </div>
  )
}
