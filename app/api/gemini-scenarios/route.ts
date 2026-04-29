import { NextResponse } from 'next/server'
import { SCENARIOS } from '@/lib/gemini-scenarios'

// Returns scenario metadata — prompts never leave the server via this route
export async function GET() {
  const list = SCENARIOS.map(({ id, label, defaultVoice, description, category, subcategory, name, job, tag, iconType }) => ({
    id, label, defaultVoice, description, category, subcategory, name, job, tag, iconType,
  }))
  return NextResponse.json(list)
}
