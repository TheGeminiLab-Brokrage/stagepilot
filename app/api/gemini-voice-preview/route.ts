import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SAMPLE_TEXT = 'مرحبا، أنا جاهز للحديث معك اليوم. كيف يمكنني مساعدتك؟'
const TTS_MODEL = 'gemini-2.5-flash-preview-05-20'

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

  // gemini-3.1-flash-live-preview is WebSocket-only (Live API).
  // For REST-based TTS preview we use the dedicated TTS model.
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${apiKey}`

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
    console.error('[gemini-voice-preview] Gemini TTS error:', errText)
    return NextResponse.json({ error: 'Gemini TTS failed', detail: errText }, { status: 502 })
  }

  const json = await geminiRes.json()

  // Extract audio from response
  const parts = json?.candidates?.[0]?.content?.parts ?? []
  for (const part of parts) {
    if (part?.inlineData?.data) {
      return NextResponse.json({
        audio: part.inlineData.data as string,
        mimeType: (part.inlineData.mimeType as string) ?? 'audio/pcm;rate=24000',
      })
    }
  }

  return NextResponse.json({ error: 'No audio in response' }, { status: 502 })
}
