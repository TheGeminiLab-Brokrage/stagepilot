import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const evoUrl = process.env.EVOLUTION_API_URL!
  const evoKey = process.env.EVOLUTION_API_KEY!

  const stateRes = await fetch(`${evoUrl}/instance/connectionState/${user.id}`, {
    headers: { apikey: evoKey },
  }).catch(() => null)

  if (!stateRes?.ok) {
    return NextResponse.json({ connected: false, phone: null })
  }

  const stateData = await stateRes.json().catch(() => ({}))
  const connected = stateData?.instance?.state === 'open'

  let phone: string | null = null
  if (connected) {
    const listRes = await fetch(
      `${evoUrl}/instance/fetchInstances?instanceName=${user.id}`,
      { headers: { apikey: evoKey } }
    ).catch(() => null)
    if (listRes?.ok) {
      const list = await listRes.json().catch(() => [])
      const inst = Array.isArray(list) ? list[0] : list
      phone = inst?.ownerJid?.split('@')[0] ?? inst?.instance?.owner ?? null
    }
  }

  return NextResponse.json({ connected, phone })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await fetch(`${process.env.EVOLUTION_API_URL}/instance/logout/${user.id}`, {
    method: 'DELETE',
    headers: { apikey: process.env.EVOLUTION_API_KEY! },
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
