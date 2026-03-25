import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// n8n calls this endpoint after processing a call, with the results.
// Secured with a shared secret in the Authorization header (N8N_CALLBACK_SECRET).
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const expectedSecret = process.env.N8N_CALLBACK_SECRET

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const {
    callRecordId,
    clientName,
    clientPhone,
    campaign,
    stage,
    reasoning,
    transcriptSummary,
    error: processingError,
  } = body

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

  const { error } = await admin
    .from('call_records')
    .update({
      client_name: clientName,
      client_phone: clientPhone,
      campaign,
      stage,
      reasoning,
      transcript_summary: transcriptSummary,
      status: 'done',
      processed_at: new Date().toISOString(),
    })
    .eq('id', callRecordId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
