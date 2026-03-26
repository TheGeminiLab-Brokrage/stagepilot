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

  // 3. Parse metadata only — the file is sent directly to n8n from the browser
  //    to avoid Vercel's ~4.5 MB serverless body limit
  const formData = await request.formData()
  const fileName = formData.get('fileName') as string

  if (!fileName) {
    return NextResponse.json({ error: 'Missing fileName' }, { status: 400 })
  }

  // 4. Create a call_record with status=processing (using admin to bypass RLS insert check for company_id)
  const admin = createAdminClient()
  const { data: callRecord, error: insertError } = await admin
    .from('call_records')
    .insert({
      company_id: profile.company_id,
      agent_id: user.id,
      team_name: profile.team_name ?? null,
      file_name: fileName,
      status: 'processing',
    })
    .select('id')
    .single()

  if (insertError || !callRecord) {
    return NextResponse.json({ error: 'Failed to create call record' }, { status: 500 })
  }

  // 5. Return the callRecordId — the browser will POST the file directly to n8n
  //    n8n will call back /api/webhook/n8n-result with the results when done
  return NextResponse.json({ success: true, callRecordId: callRecord.id })
}
