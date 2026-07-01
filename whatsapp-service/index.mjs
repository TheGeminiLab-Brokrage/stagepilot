import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import express from 'express'
import qrcode from 'qrcode'
import pino from 'pino'
import { mkdirSync, existsSync, rmSync, readdirSync } from 'fs'
import { join } from 'path'

const app = express()
app.use(express.json())

const SECRET = process.env.WHATSAPP_SERVICE_SECRET ?? 'dev-secret'
const PORT = process.env.PORT ?? 3001
const SESSIONS_DIR = './sessions'
const silentLogger = pino({ level: 'silent' })

mkdirSync(SESSIONS_DIR, { recursive: true })

// sessions: Map<agentId, { socket, qrCode, connected, phone }>
const sessions = new Map()

// Bearer token guard
app.use((req, res, next) => {
  if (req.headers.authorization !== `Bearer ${SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
})

async function createSession(agentId) {
  const sessDir = join(SESSIONS_DIR, agentId)
  mkdirSync(sessDir, { recursive: true })

  const { state, saveCreds } = await useMultiFileAuthState(sessDir)
  const { version } = await fetchLatestBaileysVersion()

  const socket = makeWASocket({
    version,
    auth: state,
    logger: silentLogger,
    browser: ['StagePilot', 'Chrome', '120.0.0'],
    printQRInTerminal: false,
    // Required to avoid missing-message-store errors when receiving
    getMessage: async () => undefined,
  })

  const session = { socket, qrCode: null, connected: false, phone: null }
  sessions.set(agentId, session)

  socket.ev.on('creds.update', saveCreds)

  socket.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrcode.toDataURL(qr, { width: 300, margin: 2 }, (err, url) => {
        if (!err) session.qrCode = url
      })
    }

    if (connection === 'open') {
      session.connected = true
      session.qrCode = null
      // socket.user.id is "phoneNumber:deviceId@s.whatsapp.net"
      session.phone = socket.user?.id?.split('@')[0]?.split(':')[0] ?? null
      console.log(`[${agentId}] Connected — phone: ${session.phone}`)
    }

    if (connection === 'close') {
      session.connected = false
      const code = lastDisconnect?.error?.output?.statusCode
      const loggedOut = code === DisconnectReason.loggedOut
      sessions.delete(agentId)
      console.log(`[${agentId}] Disconnected (code ${code}, loggedOut=${loggedOut})`)
      if (!loggedOut) {
        // Reconnect after 5 seconds
        setTimeout(() => createSession(agentId), 5000)
      }
    }
  })

  return session
}

// On startup: restore any existing sessions from saved auth files
const existingAgents = existsSync(SESSIONS_DIR)
  ? readdirSync(SESSIONS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
  : []

for (const agentId of existingAgents) {
  console.log(`Restoring session for agent ${agentId}`)
  createSession(agentId).catch(err => console.error(`Failed to restore ${agentId}:`, err))
}

// GET /qr/:agentId — returns { qr } when not connected, or { connected: true, phone }
app.get('/qr/:agentId', async (req, res) => {
  const { agentId } = req.params
  let session = sessions.get(agentId)

  if (!session) {
    session = await createSession(agentId)
  }

  if (session.connected) {
    return res.json({ connected: true, phone: session.phone })
  }

  // Wait up to 15s for QR to be generated
  const deadline = Date.now() + 15000
  while (!session.qrCode && !session.connected && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 300))
  }

  if (session.connected) return res.json({ connected: true, phone: session.phone })
  if (!session.qrCode) return res.status(408).json({ error: 'QR timeout — please try again' })
  return res.json({ qr: session.qrCode })
})

// GET /status/:agentId
app.get('/status/:agentId', (req, res) => {
  const { agentId } = req.params
  const session = sessions.get(agentId)
  if (!session || !session.connected) return res.json({ connected: false })
  return res.json({ connected: true, phone: session.phone })
})

// POST /send/:agentId   body: { phone, message }
app.post('/send/:agentId', async (req, res) => {
  const { agentId } = req.params
  const { phone, message } = req.body

  const session = sessions.get(agentId)
  if (!session?.connected) {
    return res.status(400).json({ error: 'Not connected. Scan the QR code in the Login tab first.' })
  }

  // Normalize to WhatsApp JID format
  // Egyptian numbers: 01XXXXXXXXXX → 201XXXXXXXXXX → 201XXXXXXXXXX@s.whatsapp.net
  const digits = String(phone).replace(/\D/g, '')
  const withCountry = digits.startsWith('0') ? '20' + digits.slice(1) : digits
  const jid = `${withCountry}@s.whatsapp.net`

  try {
    await session.socket.sendMessage(jid, { text: message })
    return res.json({ success: true })
  } catch (err) {
    console.error(`[${agentId}] Send failed to ${jid}:`, err?.message)
    return res.status(500).json({ error: err?.message ?? 'Send failed' })
  }
})

// DELETE /session/:agentId — logout and clear session files
app.delete('/session/:agentId', async (req, res) => {
  const { agentId } = req.params
  const session = sessions.get(agentId)

  if (session) {
    try { await session.socket.logout() } catch { /* ignore if already disconnected */ }
    sessions.delete(agentId)
  }

  const sessDir = join(SESSIONS_DIR, agentId)
  if (existsSync(sessDir)) rmSync(sessDir, { recursive: true, force: true })

  return res.json({ success: true })
})

app.listen(PORT, () => console.log(`WhatsApp service running on port ${PORT}`))
