import { createClient } from '@/lib/supabase/server'

// Allow up to 60s — enough time for the user to scan the QR code
export const maxDuration = 60

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const evoUrl = process.env.EVOLUTION_API_URL!
  const evoKey = process.env.EVOLUTION_API_KEY!
  // Agent's Supabase UID is the Evolution API instance name
  const instanceName = user.id

  const encoder = new TextEncoder()
  const send = (ctrl: ReadableStreamDefaultController, data: object) => {
    try { ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch { /* stream closed */ }
  }

  const stream = new ReadableStream({
    async start(controller) {
      // Create instance if it doesn't exist yet (idempotent — safe to call on reconnect)
      await fetch(`${evoUrl}/instance/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evoKey },
        body: JSON.stringify({ instanceName, qrcode: true }),
      }).catch(() => {})

      let done = false

      // Close stream just before Vercel's 60s hard limit
      const timeout = setTimeout(() => {
        done = true
        send(controller, { error: 'timeout' })
        try { controller.close() } catch { /* already closed */ }
      }, 55000)

      while (!done) {
        // Check if the socket is already open (e.g. reconnecting while already linked)
        const stateRes = await fetch(`${evoUrl}/instance/connectionState/${instanceName}`, {
          headers: { apikey: evoKey },
        }).catch(() => null)

        if (stateRes?.ok) {
          const stateData = await stateRes.json().catch(() => ({}))
          if (stateData?.instance?.state === 'open') {
            // Fetch ownerJid to get the linked phone number
            const listRes = await fetch(
              `${evoUrl}/instance/fetchInstances?instanceName=${instanceName}`,
              { headers: { apikey: evoKey } }
            ).catch(() => null)
            let phone: string | null = null
            if (listRes?.ok) {
              const list = await listRes.json().catch(() => [])
              const inst = Array.isArray(list) ? list[0] : list
              // ownerJid: "201234567890@s.whatsapp.net" → "201234567890"
              phone = inst?.ownerJid?.split('@')[0] ?? inst?.instance?.owner ?? null
            }
            clearTimeout(timeout)
            done = true
            send(controller, { connected: true, phone })
            try { controller.close() } catch { /* already closed */ }
            break
          }
        }

        // Not connected yet — request the current QR code
        const qrRes = await fetch(`${evoUrl}/instance/connect/${instanceName}`, {
          headers: { apikey: evoKey },
        }).catch(() => null)

        if (qrRes?.ok) {
          const qrData = await qrRes.json().catch(() => ({}))
          // Evolution API returns the QR as a base64 data URL
          const base64 = qrData?.base64 ?? qrData?.qrcode?.base64
          if (base64) {
            send(controller, { qr: base64 })
          }
        }

        // Poll every 3s — WhatsApp QR codes are valid for ~30s
        await new Promise(r => setTimeout(r, 3000))
      }
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
