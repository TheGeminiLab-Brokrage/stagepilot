import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SERVICE_URL = process.env.WHATSAPP_SERVICE_URL!
const SERVICE_SECRET = process.env.WHATSAPP_SERVICE_SECRET!

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as {
    assignmentId?: string
    phones?: string[]
    message?: string
  }
  const { assignmentId, phones, message } = body

  if (!assignmentId || !phones?.length || !message) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Verify this assignment belongs to the requesting agent
  const adminClient = createAdminClient()
  const { data: assignment } = await adminClient
    .from('whatsapp_assignments')
    .select('id')
    .eq('id', assignmentId)
    .eq('agent_id', user.id)
    .single()

  if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

  // Send to every phone number for this contact via the Baileys service
  const results = await Promise.allSettled(
    phones.map(phone =>
      fetch(`${SERVICE_URL}/send/${user.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SERVICE_SECRET}`,
        },
        body: JSON.stringify({ phone, message }),
        signal: AbortSignal.timeout(12000),
      }).then(r => r.json())
    )
  )

  const anySucceeded = results.some(
    r => r.status === 'fulfilled' && (r.value as { success?: boolean }).success
  )

  if (!anySucceeded) {
    const first = results[0]
    const msg =
      first.status === 'rejected'
        ? (first.reason as Error).message
        : ((first.value as { error?: string }).error ?? 'Send failed')
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Mark assignment as sent in the database
  const now = new Date().toISOString()
  await adminClient
    .from('whatsapp_assignments')
    .update({ sent_at: now, message_text: message })
    .eq('id', assignmentId)

  return NextResponse.json({ success: true })
}
