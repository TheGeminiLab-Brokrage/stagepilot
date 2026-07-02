import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSessionInfo, clearSession } from '@/lib/whatsapp/session'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { connected, phone } = await getSessionInfo(user.id)
  return NextResponse.json({ connected, phone })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await clearSession(user.id)
  return NextResponse.json({ success: true })
}
