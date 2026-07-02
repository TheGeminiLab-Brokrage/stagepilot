import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSupabaseAuthState, hasSession, clearSession } from '@/lib/whatsapp/session'
import { getBaileysVersion } from '@/lib/whatsapp/version'

// 20s connection timeout + send time + 2s flush window
export const maxDuration = 30

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

  const connected = await hasSession(user.id)
  if (!connected) {
    return NextResponse.json(
      { error: 'Not connected. Scan the QR code in the Login tab first.' },
      { status: 400 }
    )
  }

  let socket: Awaited<ReturnType<typeof import('@whiskeysockets/baileys').default>> | null = null

  try {
    const { default: makeWASocket, DisconnectReason } = await import('@whiskeysockets/baileys')
    const { default: pino } = await import('pino')
    const logger = pino({ level: 'silent' })

    const { state, saveCreds } = await createSupabaseAuthState(user.id)
    const version = await getBaileysVersion()

    socket = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: false,
      browser: ['StagePilot', 'Chrome', '120.0.0'],
      getMessage: async () => undefined,
    })

    socket.ev.on('creds.update', saveCreds)

    // dropError captures connection drops that happen AFTER the socket opens —
    // WhatsApp sends an immediate close when a session has expired, which arrives
    // after the 'open' event and causes sendMessage to silently fail to deliver.
    let dropError: Error | null = null

    await new Promise<void>((resolve, reject) => {
      let opened = false
      const timeout = setTimeout(() => reject(new Error('Connection timeout — try again')), 20000)

      socket!.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
        if (connection === 'open') {
          clearTimeout(timeout)
          opened = true
          resolve()
          return
        }
        if (connection === 'close') {
          clearTimeout(timeout)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const code = (lastDisconnect?.error as any)?.output?.statusCode
          const loggedOut = code === DisconnectReason.loggedOut

          if (loggedOut) {
            // Stale session — wipe it so UI transitions to disconnected on next check
            await clearSession(user.id).catch(() => {})
          }

          const msg = loggedOut
            ? 'WhatsApp session expired — please re-scan the QR code in the Login tab'
            : 'Connection closed — please try again or re-scan the QR code'

          if (!opened) {
            reject(new Error(msg))
          } else {
            // Dropped right after connecting; capture so we can surface it after send
            dropError = new Error(msg)
          }
        }
      })
    })

    // Send to each phone number for this contact
    for (const phone of phones) {
      const digits = phone.replace(/\D/g, '')
      // Egyptian numbers: 01XXXXXXXXXX → 201XXXXXXXXXX@s.whatsapp.net
      const normalized = digits.startsWith('0') ? '20' + digits.slice(1) : digits
      const msgContent = imageBase64
        ? { image: Buffer.from(imageBase64, 'base64'), mimetype: imageMimeType as string, caption: message }
        : { text: message }
      await socket.sendMessage(`${normalized}@s.whatsapp.net`, msgContent)
    }

    // Wait 2s so Baileys can flush outbound WebSocket data AND so any pending
    // connection.update close events have time to arrive and set dropError.
    await new Promise(r => setTimeout(r, 2000))

    if (dropError) throw dropError
  } catch (err) {
    try { socket?.end(new Error('error')) } catch { /* ignore */ }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Send failed — please try again' },
      { status: 500 }
    )
  }

  try { socket?.end(new Error('done')) } catch { /* ignore */ }

  // Mark assignment as sent in the database
  await adminClient
    .from('whatsapp_assignments')
    .update({ sent_at: new Date().toISOString(), message_text: message })
    .eq('id', assignmentId)

  return NextResponse.json({ success: true })
}
