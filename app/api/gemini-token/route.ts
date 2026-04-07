import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getScenarioById, SCENARIOS } from '@/lib/gemini-scenarios'

export async function POST(req: Request) {
  // Require authenticated session — key is never in the browser bundle,
  // only reachable by logged-in users via this server route.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
  }

  // Resolve system prompt from scenario ID (falls back to first scenario)
  let scenarioId: string | undefined
  try {
    const body = await req.json()
    scenarioId = body?.scenario
  } catch {
    // no body — use default
  }

  const scenario = (scenarioId ? getScenarioById(scenarioId) : undefined) ?? SCENARIOS[0]

  return NextResponse.json({ token: apiKey, systemPrompt: scenario.prompt })
}
