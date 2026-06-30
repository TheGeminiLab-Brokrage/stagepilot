import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { action, message_text } = body as { action?: string; message_text?: string }

  if (!action || !['sent', 'answered', 'not_answered'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Ownership check — only the assigned agent can update this row
  const { data: assignment } = await adminClient
    .from('whatsapp_assignments')
    .select('id, contact_id, agent_id')
    .eq('id', id)
    .eq('agent_id', user.id)
    .single()

  if (!assignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  }

  const now = new Date().toISOString()

  if (action === 'sent') {
    const { error: updateErr } = await adminClient
      .from('whatsapp_assignments')
      .update({ sent_at: now, message_text: message_text ?? null })
      .eq('id', id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // action is 'answered' or 'not_answered'
  const { error: updateErr } = await adminClient
    .from('whatsapp_assignments')
    .update({ response_status: action, responded_at: now })
    .eq('id', id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  if (action === 'answered') {
    // First-response-wins: only backfill if no agent has been credited yet
    const { data: contact } = await adminClient
      .from('whatsapp_contacts')
      .select('id, first_response_agent_id')
      .eq('id', assignment.contact_id)
      .single()

    if (contact && !contact.first_response_agent_id) {
      await adminClient
        .from('whatsapp_contacts')
        .update({ first_response_agent_id: user.id, first_response_at: now })
        .eq('id', contact.id)
    }
  }

  return NextResponse.json({ success: true })
}
