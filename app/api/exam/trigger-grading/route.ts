import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const N8N_GRADER_URL = 'https://ahmedshaheen19.app.n8n.cloud/webhook/stagepilot-call-grader'
const APP_URL = 'https://stagepilot-inky.vercel.app'

const DR_YASMINE_CONTEXT =
  'Client: Dr. Yasmine, a dentist who submitted a Facebook ad form about a clinic unit in El Tagamo3 El Khamis. ' +
  'She is at work between patients — distracted and neutral. She does not know who is calling or from which company. ' +
  'Hidden layer: the clinic is actually for her son who is finishing his dentistry degree — she will not reveal this unless the agent asks the right personal questions. ' +
  'The sales agent is the person who called her. Evaluate the agent (not the client).'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { audioPath } = await req.json() as { audioPath?: string }
  if (!audioPath) {
    return NextResponse.json({ error: 'Missing audioPath' }, { status: 400 })
  }

  // Look up the most recent exam result for this user (just saved by save-result before this call)
  const { data: result } = await supabase
    .from('exam_results')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!result?.id) {
    return NextResponse.json({ error: 'No exam result found' }, { status: 404 })
  }

  const admin = createAdminClient()
  const { data: signedData, error: signedError } = await admin.storage
    .from('exam-recordings')
    .createSignedUrl(audioPath, 3600)

  if (signedError || !signedData?.signedUrl) {
    return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 })
  }

  await fetch(N8N_GRADER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callbackId: result.id,
      callbackType: 'exam',
      signedUrl: signedData.signedUrl,
      scenarioContext: DR_YASMINE_CONTEXT,
      callbackUrl: `${APP_URL}/api/webhook/call-grade-result`,
      callbackSecret: process.env.N8N_CALLBACK_SECRET ?? '',
    }),
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
