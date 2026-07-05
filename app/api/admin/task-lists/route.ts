import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, company_id, team_name')
    .eq('id', user.id)
    .single()

  if (!callerProfile || !['super_admin', 'team_leader'].includes(callerProfile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { title, items, recipientIds } = await request.json()

  const trimmedTitle = typeof title === 'string' ? title.trim() : ''
  const trimmedItems: string[] = Array.isArray(items)
    ? items.map((i: unknown) => (typeof i === 'string' ? i.trim() : '')).filter(Boolean)
    : []
  const uniqueRecipientIds: string[] = Array.isArray(recipientIds)
    ? Array.from(new Set(recipientIds.filter((r: unknown) => typeof r === 'string')))
    : []

  if (!trimmedTitle || trimmedItems.length === 0 || uniqueRecipientIds.length === 0) {
    return NextResponse.json({ error: 'Title, at least one item, and at least one recipient are required' }, { status: 400 })
  }

  // Defense-in-depth: verify every recipient is a valid target for this caller's
  // role before writing anything, mirroring the is_task_assignable() RLS check.
  const { data: recipientProfiles } = await supabase
    .from('profiles')
    .select('id, role, team_name')
    .eq('company_id', callerProfile.company_id)
    .in('id', uniqueRecipientIds)

  const validRecipientIds = new Set(
    (recipientProfiles ?? [])
      .filter(p =>
        callerProfile.role === 'super_admin'
          ? ['agent', 'team_leader'].includes(p.role)
          : p.role === 'agent' && p.team_name === callerProfile.team_name
      )
      .map(p => p.id)
  )

  if (validRecipientIds.size !== uniqueRecipientIds.length) {
    return NextResponse.json({ error: 'One or more recipients are not assignable by you' }, { status: 400 })
  }

  const { data: taskList, error: listError } = await supabase
    .from('task_lists')
    .insert({ company_id: callerProfile.company_id, created_by: user.id, title: trimmedTitle })
    .select('id, title, created_at')
    .single()

  if (listError || !taskList) {
    return NextResponse.json({ error: listError?.message ?? 'Failed to create list' }, { status: 500 })
  }

  const { error: itemsError } = await supabase
    .from('task_list_items')
    .insert(trimmedItems.map((body, position) => ({ task_list_id: taskList.id, body, position })))

  if (itemsError) {
    await supabase.from('task_lists').delete().eq('id', taskList.id)
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  const { error: recipientsError } = await supabase
    .from('task_list_recipients')
    .insert(uniqueRecipientIds.map(recipient_id => ({ task_list_id: taskList.id, recipient_id })))

  if (recipientsError) {
    await supabase.from('task_lists').delete().eq('id', taskList.id)
    return NextResponse.json({ error: recipientsError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    taskList: {
      id: taskList.id,
      title: taskList.title,
      createdAt: taskList.created_at,
      itemsTotal: trimmedItems.length,
    },
  })
}
