import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  // 1. Authenticate user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Get user profile (company_id, team_name)
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, team_name, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
  }

  if (profile.role !== 'agent') {
    return NextResponse.json({ error: 'Only agents can upload calls' }, { status: 403 })
  }

  // 3. Parse the multipart form data
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const fileName = formData.get('fileName') as string
  const agentName = formData.get('agentName') as string
  const team = formData.get('team') as string

  if (!file || !fileName) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }

  // 4. Create a call_record with status=processing (using admin to bypass RLS insert check for company_id)
  const admin = createAdminClient()
  const { data: callRecord, error: insertError } = await admin
    .from('call_records')
    .insert({
      company_id: profile.company_id,
      agent_id: user.id,
      team_name: profile.team_name ?? team,
      file_name: fileName,
      status: 'processing',
    })
    .select('id')
    .single()

  if (insertError || !callRecord) {
    return NextResponse.json({ error: 'Failed to create call record' }, { status: 500 })
  }

  // 5. Forward the file + metadata to n8n webhook
  // n8n processes it and will call back our /api/webhook/n8n-result endpoint with results
  const n8nForm = new FormData()
  n8nForm.append('file', file, fileName)
  n8nForm.append('fileName', fileName)
  n8nForm.append('agentName', agentName)
  n8nForm.append('team', team)
  n8nForm.append('callRecordId', callRecord.id)  // n8n will use this to update the record

  const webhookUrl = process.env.N8N_WEBHOOK_URL
  if (!webhookUrl) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  // Fire and forget — n8n processes async and calls back with results
  fetch(webhookUrl, { method: 'POST', body: n8nForm }).catch(err => {
    console.error('n8n webhook error:', err)
  })

  return NextResponse.json({ success: true, callRecordId: callRecord.id })
}
