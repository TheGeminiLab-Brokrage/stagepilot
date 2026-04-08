import { NextResponse } from 'next/server'
import { SCENARIOS } from '@/lib/gemini-scenarios'

// Returns only id + label — prompts never leave the server via this route
export async function GET() {
  const list = SCENARIOS.map(({ id, label, defaultVoice }) => ({ id, label, defaultVoice }))
  return NextResponse.json(list)
}
