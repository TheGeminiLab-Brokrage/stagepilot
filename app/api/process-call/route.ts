import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const VALID_STAGES = [
  'interested / follow up',
  'potential to close',
  'meeting scheduled',
  'not interested',
  'low budget',
]

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

  // 3. Parse metadata — the file is sent directly to n8n and Storage from the browser
  //    to avoid Vercel's ~4.5 MB serverless body limit
  const formData = await request.formData()
  const fileName = formData.get('fileName') as string
  const agentStage = formData.get('agentStage') as string

  if (!fileName) {
    return NextResponse.json({ error: 'Missing fileName' }, { status: 400 })
  }

  if (!agentStage || !VALID_STAGES.includes(agentStage)) {
    return NextResponse.json({ error: 'Missing or invalid agentStage' }, { status: 400 })
  }

  // 4. Pre-compute the storage path using a UUID so we can insert everything in one shot
  const newId = randomUUID()
  const ext = fileName.split('.').pop()?.toLowerCase() ?? 'mp3'
  const audioPath = `${profile.company_id}/${newId}.${ext}`

  // 5. Create call_record (admin client to bypass RLS insert check for company_id)
  const admin = createAdminClient()
  const { data: callRecord, error: insertError } = await admin
    .from('call_records')
    .insert({
      id: newId,
      company_id: profile.company_id,
      agent_id: user.id,
      team_name: profile.team_name ?? null,
      file_name: fileName,
      agent_stage: agentStage,
      audio_url: audioPath,
      status: 'processing',
    })
    .select('id')
    .single()

  if (insertError || !callRecord) {
    return NextResponse.json({ error: 'Failed to create call record' }, { status: 500 })
  }

  // 6. Return callRecordId + audioPath — browser uploads file to Storage and n8n in parallel
  return NextResponse.json({ success: true, callRecordId: callRecord.id, audioPath })
}
