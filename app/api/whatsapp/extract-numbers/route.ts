import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })

  const formData = await req.formData()
  const image = formData.get('image') as File | null
  if (!image) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

  const arrayBuffer = await image.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const mimeType = image.type || 'image/jpeg'

  const prompt =
    'Extract every phone number visible in this image. Return ONLY a valid JSON array of strings, ' +
    'for example ["+971501234567", "+971551234567"]. ' +
    'Include the country code. If a number has no country code, prefix it with +971. ' +
    'No explanation, no markdown fences, just the raw JSON array.'

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        }],
        generationConfig: { temperature: 0, maxOutputTokens: 512 },
      }),
    }
  )

  if (!geminiRes.ok) {
    const err = await geminiRes.text()
    return NextResponse.json({ error: `Gemini error: ${err}` }, { status: 502 })
  }

  const geminiJson = await geminiRes.json()
  const rawText: string = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]'

  // Strip markdown fences if Gemini wraps with ```json
  const cleaned = rawText.replace(/```[a-z]*\n?/gi, '').trim()

  let numbers: string[] = []
  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) {
      numbers = parsed.filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
    }
  } catch {
    return NextResponse.json({ error: 'Could not parse numbers from image. Try a clearer photo.' }, { status: 422 })
  }

  return NextResponse.json({ numbers })
}
