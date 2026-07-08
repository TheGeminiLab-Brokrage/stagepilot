import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAgent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401, companyId: null, userId: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'agent') return { error: 'Forbidden', status: 403, companyId: null, userId: null }
  return { error: null, status: 200, companyId: profile.company_id as string, userId: user.id }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, companyId, userId } = await requireAgent()
  if (error) return NextResponse.json({ error }, { status })

  const { id } = await params
  const adminClient = createAdminClient()

  // Scoped by uploaded_by as well as company — an agent can only ever delete
  // a sheet they uploaded themselves, never another agent's or an admin's.
  const { data: sheet, error: sheetErr } = await adminClient
    .from('whatsapp_sheets')
    .select('id')
    .eq('id', id)
    .eq('company_id', companyId!)
    .eq('uploaded_by', userId!)
    .single()

  if (sheetErr || !sheet) return NextResponse.json({ error: 'Sheet not found' }, { status: 404 })

  const { error: deleteErr } = await adminClient
    .from('whatsapp_sheets')
    .delete()
    .eq('id', id)

  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
