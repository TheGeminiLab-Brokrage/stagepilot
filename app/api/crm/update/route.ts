import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const CRM_SERVER_URL = process.env.CRM_SERVER_URL ?? 'http://localhost:3001'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { dateFrom, dateTo } = body as { dateFrom?: string; dateTo?: string }

  if (!dateFrom || !dateTo) {
    return NextResponse.json({ error: 'dateFrom and dateTo are required' }, { status: 400 })
  }

  let crmRes: Response
  try {
    crmRes = await fetch(`${CRM_SERVER_URL}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateFrom, dateTo }),
      // CRM export can take up to 4 minutes; no signal timeout here — Next.js
      // has its own 5-min function timeout which is enough
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `CRM server unreachable: ${msg}. Make sure "npm run crm-server" is running.` },
      { status: 502 }
    )
  }

  const data = await crmRes.json().catch(() => ({ ok: false, error: 'Invalid response from CRM server' }))
  return NextResponse.json(data, { status: crmRes.status })
}
