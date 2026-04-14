import { NextResponse } from 'next/server'
import { SCENARIOS } from '@/lib/gemini-scenarios'

// Returns only id, label, defaultVoice, and description — prompts never leave the server via this route
export async function GET() {
  const list = SCENARIOS.map(({ id, label, defaultVoice, description }) => ({ id, label, defaultVoice, description }))
  return NextResponse.json(list)
}
