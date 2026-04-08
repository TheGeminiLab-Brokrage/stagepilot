import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Dedicated TTS model — supports responseModalities: ['AUDIO'] via REST
const TTS_MODEL = 'gemini-2.5-flash-preview-tts'
const TTS_ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

// Short Arabic sample — enough to hear the voice character
const SAMPLE_TEXT = 'مرحبا، أنا هنا لمساعدتك.'

// ─── Server-side audio cache ──────────────────────────────────────────────────
// Keyed by voice name. Populated on first request per voice, served instantly
// after that. Eliminates repeated Gemini API calls and quota exhaustion.
const audioCache = new Map<string, string>()   // voice → base64 PCM

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
  }

  let voice = 'Puck'
  try {
    const body = await req.json()
    if (body?.voice) voice = body.voice
  } catch {
    // use default
  }

  // Return cached audio instantly if available
  const cached = audioCache.get(voice)
  if (cached) {
    return NextResponse.json({ audio: cached, cached: true })
  }

  // First request for this voice — call Gemini TTS
  const endpoint = `${TTS_ENDPOINT_BASE}/${TTS_MODEL}:generateContent?key=${apiKey}`

  const geminiRes = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: SAMPLE_TEXT }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    }),
  })

  if (!geminiRes.ok) {
    const errText = await geminiRes.text()
    console.error('[gemini-voice-preview] Gemini error:', errText)

    // Pass quota errors through with the retry delay Gemini tells us to use
    if (geminiRes.status === 429) {
      let retryDelay = 30
      try {
        const errJson = JSON.parse(errText)
        const retryInfo = (errJson?.error?.details ?? []).find(
          (d: Record<string, unknown>) => String(d['@type'] ?? '').includes('RetryInfo')
        ) as Record<string, unknown> | undefined
        if (retryInfo?.retryDelay) retryDelay = parseInt(String(retryInfo.retryDelay)) || 30
      } catch { /* use default */ }
      return NextResponse.json({ error: 'Rate limited', retryDelay }, { status: 429 })
    }

    return NextResponse.json({ error: 'Gemini TTS failed', detail: errText }, { status: 502 })
  }

  const json = await geminiRes.json()

  // Extract audio from response
  const parts = (json?.candidates?.[0]?.content?.parts ?? []) as Array<Record<string, unknown>>
  for (const part of parts) {
    const inlineData = part.inlineData as Record<string, unknown> | undefined
    if (inlineData?.data) {
      const audio = inlineData.data as string
      audioCache.set(voice, audio)   // cache for all future requests
      return NextResponse.json({ audio })
    }
  }

  console.error('[gemini-voice-preview] No audio in response:', JSON.stringify(json).slice(0, 500))
  return NextResponse.json({ error: 'No audio in Gemini response' }, { status: 502 })
}
