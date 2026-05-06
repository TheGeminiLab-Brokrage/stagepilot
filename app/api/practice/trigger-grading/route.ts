import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SCENARIOS } from '@/lib/gemini-scenarios'

const N8N_GRADER_URL = 'https://ahmedshaheen19.app.n8n.cloud/webhook/stagepilot-call-grader'
const APP_URL = 'https://stagepilot-inky.vercel.app'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId, audioPath, scenarioId } = await req.json() as {
    sessionId?: string
    audioPath?: string
    scenarioId?: string
  }

  if (!sessionId || !audioPath || !scenarioId) {
    return NextResponse.json({ error: 'Missing sessionId, audioPath or scenarioId' }, { status: 400 })
  }

  const scenario = SCENARIOS.find(s => s.id === scenarioId)
  if (!scenario || scenario.subcategory !== 'Clients') {
    // Educational bots are not graded
    return NextResponse.json({ ok: true, skipped: true })
  }

  const scenarioContext =
    `Client persona: ${scenario.name} — ${scenario.job}. ` +
    `${scenario.description} ` +
    `Context: ${scenario.context} ` +
    `Practice goal: ${scenario.practiceGoal} ` +
    `The sales agent is the person who called the client. Evaluate the agent (not the client).`

  const admin = createAdminClient()
  const { data: signedData, error: signedError } = await admin.storage
    .from('practice-recordings')
    .createSignedUrl(audioPath, 3600)

  if (signedError || !signedData?.signedUrl) {
    return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 })
  }

  await fetch(N8N_GRADER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callbackId: sessionId,
      callbackType: 'practice',
      signedUrl: signedData.signedUrl,
      scenarioContext,
      callbackUrl: `${APP_URL}/api/webhook/call-grade-result`,
      callbackSecret: process.env.N8N_CALLBACK_SECRET ?? '',
    }),
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
