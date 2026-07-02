import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSupabaseAuthState, hasSession, clearSession } from '@/lib/whatsapp/session'
import { getBaileysVersion } from '@/lib/whatsapp/version'

// 20s connection timeout + send time + 5s SERVER_ACK window
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
    const logger = pino({ level: 'warn' })

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
          console.log('[WA-SEND] opened, user:', socket!.user?.id ?? 'NONE')
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

    if (!socket!.user?.id) {
      throw new Error('WhatsApp session credentials not accepted — please re-scan the QR code in the Login tab')
    }

    // Send to each phone number for this contact
    const sentIds = new Set<string>()
    for (const phone of phones) {
      const digits = phone.replace(/\D/g, '')
      // Egyptian numbers: 01XXXXXXXXXX → 201XXXXXXXXXX@s.whatsapp.net
      const normalized = digits.startsWith('0') ? '20' + digits.slice(1) : digits
      const msgContent = imageBase64
        ? { image: Buffer.from(imageBase64, 'base64'), mimetype: imageMimeType as string, caption: message }
        : { text: message }
      const result = await socket.sendMessage(`${normalized}@s.whatsapp.net`, msgContent)
      if (result?.key?.id) sentIds.add(result.key.id)
      console.log('[WA-SEND] queued to', normalized, 'msgId:', result?.key?.id)
    }

    // Wait for WhatsApp SERVER_ACK (status >= 2) on every sent message, up to 5s.
    // This confirms the message reached WhatsApp's servers, not just Baileys' local
    // queue — catching the "ghost connection" case where sendMessage resolves but
    // the session is stale and the message is silently dropped.
    const remaining = new Set(sentIds)
    await new Promise<void>(resolve => {
      const t = setTimeout(resolve, 5000)
      if (remaining.size === 0) { clearTimeout(t); resolve(); return }
      socket!.ev.on('messages.update', updates => {
        for (const { key, update } of updates) {
          if (key?.id && remaining.has(key.id) && (update?.status ?? 0) >= 2) {
            remaining.delete(key.id)
            if (remaining.size === 0) { clearTimeout(t); resolve() }
          }
        }
      })
    })

    console.log('[WA-SEND] post-wait, unacked:', remaining.size, 'dropError:', String(dropError))
    if (dropError) throw dropError
    // If WhatsApp never ACKed the message (e.g. error 463 — recipient has restrictions,
    // or ghost-connection where session accepted the socket but dropped the message),
    // surface it as an error so the contact is NOT marked sent in the DB.
    if (remaining.size > 0) {
      throw new Error('Message was not delivered — the recipient may have restrictions on receiving messages, or your WhatsApp session needs re-scanning')
    }
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
