import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as {
    assignmentId?: string
    phones?: string[]
    message?: string
    imageBase64?: string
    imageMimeType?: string
  }
  const { assignmentId, phones, message, imageBase64, imageMimeType } = body
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

  const evoUrl = process.env.EVOLUTION_API_URL!
  const evoKey = process.env.EVOLUTION_API_KEY!
  // Agent's Supabase UID is the Evolution API instance name — one persistent socket per agent number
  const instanceName = user.id

  // Verify instance is connected before attempting send
  const stateRes = await fetch(`${evoUrl}/instance/connectionState/${instanceName}`, {
    headers: { apikey: evoKey },
  }).catch(() => null)
  const stateData = await stateRes?.json().catch(() => ({}))
  if (!stateRes?.ok || stateData?.instance?.state !== 'open') {
    return NextResponse.json(
      { error: 'Not connected. Scan the QR code in the Login tab first.' },
      { status: 400 }
    )
  }

  try {
    for (const phone of phones) {
      const digits = phone.replace(/\D/g, '')
      // Egyptian numbers: 01XXXXXXXXXX → 201XXXXXXXXXX
      const normalizedPhone = digits.startsWith('0') ? '20' + digits.slice(1) : digits

      let evoRes: Response
      if (imageBase64) {
        evoRes = await fetch(`${evoUrl}/message/sendMedia/${instanceName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evoKey },
          body: JSON.stringify({
            number: normalizedPhone,
            mediatype: 'image',
            media: imageBase64,
            mimetype: imageMimeType,
            caption: message,
          }),
        })
      } else {
        evoRes = await fetch(`${evoUrl}/message/sendText/${instanceName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evoKey },
          body: JSON.stringify({ number: normalizedPhone, text: message }),
        })
      }

      if (!evoRes.ok) {
        const err = await evoRes.json().catch(() => ({}))
        throw new Error(`Evolution API ${evoRes.status}: ${JSON.stringify(err)}`)
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Send failed — please try again' },
      { status: 500 }
    )
  }

  // Mark assignment as sent in the database
  await adminClient
    .from('whatsapp_assignments')
    .update({ sent_at: new Date().toISOString(), message_text: message })
    .eq('id', assignmentId)

  return NextResponse.json({ success: true })
}
