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

  const { name, memberIds } = await request.json()

  const trimmedName = typeof name === 'string' ? name.trim() : ''
  const uniqueMemberIds: string[] = Array.isArray(memberIds)
    ? Array.from(new Set(memberIds.filter((m: unknown) => typeof m === 'string' && m !== user.id)))
    : []

  if (!trimmedName || uniqueMemberIds.length === 0) {
    return NextResponse.json({ error: 'Name and at least one member are required' }, { status: 400 })
  }

  // Defense-in-depth: verify every member is a valid chat partner for this
  // caller, mirroring the is_chat_partner_of()/is_chat_eligible() RLS check.
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

  const { data: group, error: groupError } = await supabase
    .from('chat_groups')
    .insert({ company_id: callerProfile.company_id, created_by: user.id, name: trimmedName })
    .select('id, name, created_at')
    .single()

  if (groupError || !group) {
    return NextResponse.json({ error: groupError?.message ?? 'Failed to create group' }, { status: 500 })
  }

  const allMemberIds = Array.from(new Set([...uniqueMemberIds, user.id]))
  const { error: membersError } = await supabase
    .from('chat_group_members')
    .insert(allMemberIds.map(member_id => ({ group_id: group.id, member_id, added_by: user.id })))

  if (membersError) {
    await supabase.from('chat_groups').delete().eq('id', group.id)
    return NextResponse.json({ error: membersError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    group: {
      id: group.id,
      name: group.name,
      createdBy: user.id,
      createdAt: group.created_at,
      memberCount: allMemberIds.length,
    },
  })
}
