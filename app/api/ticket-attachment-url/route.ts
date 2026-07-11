import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ticketId = request.nextUrl.searchParams.get('ticketId')
  if (!ticketId) {
    return NextResponse.json({ error: 'Missing ticketId' }, { status: 400 })
  }

  const { data: callerProfile } = await supabase.from('profiles').select('role, company_id').eq('id', user.id).single()

  const [{ data: ownedTicket }, { data: assigneeRow }, { data: companyTicket }] = await Promise.all([
    supabase.from('tickets').select('id').eq('id', ticketId).eq('created_by', user.id).maybeSingle(),
    supabase.from('ticket_assignees').select('id').eq('ticket_id', ticketId).eq('assignee_id', user.id).maybeSingle(),
    callerProfile?.role === 'super_admin'
      ? supabase.from('tickets').select('id').eq('id', ticketId).eq('company_id', callerProfile.company_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  if (!ownedTicket && !assigneeRow && !companyTicket) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: attachments } = await supabase
    .from('ticket_attachments')
    .select('id, storage_path, kind')
    .eq('ticket_id', ticketId)

  if (!attachments || attachments.length === 0) {
    return NextResponse.json({ attachments: [] })
  }

  const admin = createAdminClient()
  const signed = await Promise.all(
    attachments.map(async a => {
      const { data, error } = await admin.storage
        .from('ticket-attachments')
        .createSignedUrl(a.storage_path, 3600)
      if (error || !data?.signedUrl) return null
      return { id: a.id, url: data.signedUrl, kind: a.kind as 'photo' | 'voice' }
    })
  )

  return NextResponse.json({
    attachments: signed.filter((a): a is { id: string; url: string; kind: 'photo' | 'voice' } => a !== null),
  })
}
