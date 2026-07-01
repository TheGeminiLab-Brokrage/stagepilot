import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SERVICE_URL = process.env.WHATSAPP_SERVICE_URL!
const SERVICE_SECRET = process.env.WHATSAPP_SERVICE_SECRET!

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const res = await fetch(`${SERVICE_URL}/qr/${user.id}`, {
    headers: { Authorization: `Bearer ${SERVICE_SECRET}` },
    // Allow up to 20s — the service polls up to 15s internally for QR generation
    signal: AbortSignal.timeout(22000),
  }).catch(() => null)

  if (!res) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  const data = await res.json()
  return NextResponse.json(data, { status: res.ok ? 200 : res.status })
}
