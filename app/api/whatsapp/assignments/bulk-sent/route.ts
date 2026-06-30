import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { assignmentIds, message_text } = body as { assignmentIds?: string[]; message_text?: string }

  if (!Array.isArray(assignmentIds) || assignmentIds.length === 0) {
    return NextResponse.json({ error: 'No assignment ids provided' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // .eq('agent_id', user.id) ensures an agent can only bulk-mark their own assignments
  const { data, error } = await adminClient
    .from('whatsapp_assignments')
    .update({ sent_at: new Date().toISOString(), message_text: message_text ?? null })
    .in('id', assignmentIds)
    .eq('agent_id', user.id)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, updated: data?.length ?? 0 })
}
