import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSupabaseAuthState, hasSession } from '@/lib/whatsapp/session'

// Allow up to 30s for reconnect + send
export const maxDuration = 30

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

  const connected = await hasSession(user.id)
  if (!connected) {
    return NextResponse.json(
      { error: 'Not connected. Scan the QR code in the Login tab first.' },
      { status: 400 }
    )
  }

  const { default: makeWASocket, fetchLatestBaileysVersion } = await import('@whiskeysockets/baileys')
  const { default: pino } = await import('pino')
  const logger = pino({ level: 'silent' })

  const { state, saveCreds } = await createSupabaseAuthState(user.id)
  const { version } = await fetchLatestBaileysVersion()

  const socket = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: ['StagePilot', 'Chrome', '120.0.0'],
    getMessage: async () => undefined,
  })

  socket.ev.on('creds.update', saveCreds)

  // Wait for reconnection using stored credentials (no QR needed)
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Connection timeout')), 20000)
    socket.ev.on('connection.update', ({ connection }) => {
      if (connection === 'open') { clearTimeout(timeout); resolve() }
      if (connection === 'close') { clearTimeout(timeout); reject(new Error('Connection closed')) }
    })
  })

  // Send to each phone number for this contact
  for (const phone of phones) {
    const digits = phone.replace(/\D/g, '')
    // Egyptian numbers: 01XXXXXXXXXX → 201XXXXXXXXXX@s.whatsapp.net
    const normalized = digits.startsWith('0') ? '20' + digits.slice(1) : digits
    await socket.sendMessage(`${normalized}@s.whatsapp.net`, { text: message })
  }

  try { socket.end(new Error('done')) } catch { /* ignore */ }

  // Mark assignment as sent in the database
  await adminClient
    .from('whatsapp_assignments')
    .update({ sent_at: new Date().toISOString(), message_text: message })
    .eq('id', assignmentId)

  return NextResponse.json({ success: true })
}
