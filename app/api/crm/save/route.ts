import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function authorise() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role === 'super_admin' ? user : null
}

// GET — load the most recently saved CRM export
export async function GET() {
  const user = await authorise()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('crm_exports')
    .select('id, saved_at, date_from, date_to, source, row_count, data')
    .order('saved_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return NextResponse.json({ ok: false, data: null })

  return NextResponse.json({ ok: true, export: data })
}

// DELETE — remove a saved CRM export by id
export async function DELETE(request: NextRequest) {
  const user = await authorise()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await request.json().catch(() => ({})) as { id?: number }
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('crm_exports').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// POST — save a new CRM export snapshot
export async function POST(request: NextRequest) {
  const user = await authorise()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body?.data || !body?.dateFrom || !body?.dateTo) {
    return NextResponse.json({ error: 'Missing dateFrom, dateTo, or data' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('crm_exports')
    .insert({
      date_from: body.dateFrom,
      date_to:   body.dateTo,
      source:    body.source ?? 'file',
      row_count: Array.isArray(body.data) ? body.data.length : 0,
      data:      body.data,
    })
    .select('id, saved_at, row_count')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.id, savedAt: data.saved_at, rowCount: data.row_count })
}
