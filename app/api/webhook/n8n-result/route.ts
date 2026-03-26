import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// n8n calls this endpoint after processing a call, with the results
// Secured with a shared secret in the Authorization header
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const expectedSecret = process.env.N8N_CALLBACK_SECRET

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret.trim()}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  const text = await request.text()
  try {
    body = JSON.parse(text)
  } catch {
    body = Object.fromEntries(new URLSearchParams(text).entries())
  }
  const {
    callRecordId,
    clientName,
    clientPhone,
    campaign,
    stage,
    reasoning,
    transcriptSummary,
    painPoints,
    tripleC,
    agentFeedback,
    error: processingError,
  } = body as Record<string, unknown>

  if (!callRecordId) {
    return NextResponse.json({ error: 'Missing callRecordId' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (processingError) {
    await admin
      .from('call_records')
      .update({ status: 'error', error_message: processingError, processed_at: new Date().toISOString() })
      .eq('id', callRecordId)
    return NextResponse.json({ success: true })
  }

  // Parse tripleC — n8n sends it as a JSON object or stringified JSON
  let tripleCParsed: unknown = null
  if (tripleC) {
    try {
      tripleCParsed = typeof tripleC === 'string' ? JSON.parse(tripleC) : tripleC
    } catch {
      tripleCParsed = null
    }
  }

  const { error } = await admin
    .from('call_records')
    .update({
      client_name: clientName as string ?? null,
      client_phone: clientPhone as string ?? null,
      campaign: campaign as string ?? null,
      stage: stage as string ?? null,
      reasoning: reasoning as string ?? null,
      transcript_summary: transcriptSummary as string ?? null,
      pain_points: painPoints as string ?? null,
      triple_c: tripleCParsed,
      agent_feedback: agentFeedback as string ?? null,
      status: 'done',
      processed_at: new Date().toISOString(),
    })
    .eq('id', callRecordId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
