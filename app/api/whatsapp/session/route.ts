import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SERVICE_URL = process.env.WHATSAPP_SERVICE_URL!
const SERVICE_SECRET = process.env.WHATSAPP_SERVICE_SECRET!

function serviceHeaders() {
  return { Authorization: `Bearer ${SERVICE_SECRET}` }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const res = await fetch(`${SERVICE_URL}/status/${user.id}`, {
    headers: serviceHeaders(),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null)

  if (!res) return NextResponse.json({ connected: false })
  const data = await res.json()
  return NextResponse.json(data)
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const res = await fetch(`${SERVICE_URL}/session/${user.id}`, {
    method: 'DELETE',
    headers: serviceHeaders(),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null)

  if (!res) return NextResponse.json({ success: true })
  const data = await res.json()
  return NextResponse.json(data)
}
