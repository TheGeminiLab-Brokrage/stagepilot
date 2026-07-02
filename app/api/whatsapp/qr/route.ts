import { createClient } from '@/lib/supabase/server'
import { createSupabaseAuthState, clearSession } from '@/lib/whatsapp/session'
import { getBaileysVersion } from '@/lib/whatsapp/version'
import qrcode from 'qrcode'

// Allow up to 60s — enough time for the user to scan the QR code
export const maxDuration = 60

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const encoder = new TextEncoder()
  const send = (ctrl: ReadableStreamDefaultController, data: object) => {
    try { ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch { /* stream closed */ }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const { default: makeWASocket, DisconnectReason } =
        await import('@whiskeysockets/baileys')
      const { default: pino } = await import('pino')
      const logger = pino({ level: 'silent' })

      const { state, saveCreds } = await createSupabaseAuthState(user.id)
      const version = await getBaileysVersion()

      const socket = makeWASocket({
        version,
        auth: state,
        logger,
        printQRInTerminal: false,
        browser: ['StagePilot', 'Chrome', '120.0.0'],
        getMessage: async () => undefined,
      })

      // Track the latest save so we can await it before confirming connection
      let lastSave: Promise<void> = Promise.resolve()
      socket.ev.on('creds.update', () => { lastSave = saveCreds() })

      await new Promise<void>((resolve) => {
        socket.ev.on('connection.update', async ({ connection, qr, lastDisconnect }) => {
          if (qr) {
            try {
              const url = await qrcode.toDataURL(qr, { width: 300, margin: 2 })
              send(controller, { qr: url })
            } catch { /* ignore */ }
          }

          if (connection === 'open') {
            // Wait for the credential save to finish before telling the client
            // they're connected — otherwise a page reload before the DB write
            // commits will show the QR screen again.
            await lastSave.catch(() => {})
            const phone = socket.user?.id?.split('@')[0]?.split(':')[0] ?? null
            send(controller, { connected: true, phone })
            resolve()
          }

          if (connection === 'close') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const code = (lastDisconnect?.error as any)?.output?.statusCode
            if (code === DisconnectReason.loggedOut) {
              await clearSession(user.id)
              // Tell client this was a real logout so it stops retrying
              send(controller, { error: 'loggedout' })
            } else {
              // Transient close (network hiccup, server restart, etc.) —
              // tell client to reconnect and get a fresh QR
              send(controller, { error: 'timeout' })
            }
            resolve()
          }
        })

        // Timeout just before Vercel's 60s limit
        setTimeout(() => {
          send(controller, { error: 'timeout' })
          resolve()
        }, 55000)
      })

      try { socket.end(new Error('stream done')) } catch { /* ignore */ }
      try { controller.close() } catch { /* already closed */ }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
