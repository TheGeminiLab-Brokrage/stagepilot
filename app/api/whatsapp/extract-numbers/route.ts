import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })

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

  const client = new OpenAI({ apiKey })

  let rawText = '[]'
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        ],
      }],
    })
    rawText = response.choices[0]?.message?.content ?? '[]'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `AI error: ${msg}` }, { status: 502 })
  }

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
