import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function loadCallerAndGroup(supabase: Awaited<ReturnType<typeof createClient>>, groupId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 } as const

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, company_id, team_name')
    .eq('id', user.id)
    .single()

  if (!callerProfile) return { error: 'Forbidden', status: 403 } as const

  const { data: group } = await supabase
    .from('chat_groups')
    .select('id, created_by, company_id')
    .eq('id', groupId)
    .eq('company_id', callerProfile.company_id)
    .single()

  if (!group) return { error: 'Not found', status: 404 } as const

  const isCreatorOrAdmin = callerProfile.role === 'super_admin' || group.created_by === user.id
  if (!isCreatorOrAdmin) return { error: 'Forbidden', status: 403 } as const

  return { error: null, user, callerProfile, group } as const
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params
  const supabase = await createClient()
  const result = await loadCallerAndGroup(supabase, groupId)
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status })
  const { user, callerProfile } = result

  const { memberIds } = await request.json()
  const uniqueMemberIds: string[] = Array.isArray(memberIds)
    ? Array.from(new Set(memberIds.filter((m: unknown) => typeof m === 'string')))
    : []

  if (uniqueMemberIds.length === 0) {
    return NextResponse.json({ error: 'At least one member is required' }, { status: 400 })
  }

  // Defense-in-depth: same partner rule as chat-groups creation / is_chat_partner_of().
  const { data: memberProfiles } = await supabase
    .from('profiles')
    .select('id, role, team_name')
    .eq('company_id', callerProfile.company_id)
    .in('id', uniqueMemberIds)

  const validMemberIds = new Set(
    (memberProfiles ?? [])
      .filter(p =>
        callerProfile.role === 'super_admin'
          ? ['agent', 'team_leader', 'super_admin'].includes(p.role)
          : p.role === 'super_admin' || p.role === 'team_leader' || p.team_name === callerProfile.team_name
      )
      .map(p => p.id)
  )

  if (validMemberIds.size !== uniqueMemberIds.length) {
    return NextResponse.json({ error: 'One or more members are not addable by you' }, { status: 400 })
  }

  const { error } = await supabase
    .from('chat_group_members')
    .upsert(
      uniqueMemberIds.map(member_id => ({ group_id: groupId, member_id, added_by: user.id })),
      { onConflict: 'group_id,member_id', ignoreDuplicates: true }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params
  const supabase = await createClient()
  const result = await loadCallerAndGroup(supabase, groupId)
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status })

  const { memberIds } = await request.json()
  const uniqueMemberIds: string[] = Array.isArray(memberIds)
    ? Array.from(new Set(memberIds.filter((m: unknown) => typeof m === 'string')))
    : []

  if (uniqueMemberIds.length === 0) {
    return NextResponse.json({ error: 'At least one member is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('chat_group_members')
    .delete()
    .eq('group_id', groupId)
    .in('member_id', uniqueMemberIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
