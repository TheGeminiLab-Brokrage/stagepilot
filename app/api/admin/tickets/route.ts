import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent']

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

  const { title, description, priority, dueDate, assigneeIds } = await request.json()

  const trimmedTitle = typeof title === 'string' ? title.trim() : ''
  const trimmedDescription = typeof description === 'string' ? description.trim() : ''
  const validPriority = VALID_PRIORITIES.includes(priority) ? priority : 'medium'
  const normalizedDueDate = typeof dueDate === 'string' && dueDate.trim() ? dueDate.trim() : null
  const uniqueAssigneeIds: string[] = Array.isArray(assigneeIds)
    ? Array.from(new Set(assigneeIds.filter((r: unknown) => typeof r === 'string')))
    : []

  if (!trimmedTitle || uniqueAssigneeIds.length === 0) {
    return NextResponse.json({ error: 'Title and at least one assignee are required' }, { status: 400 })
  }

  // Defense-in-depth: verify every assignee is a valid target for this caller's
  // role before writing anything, mirroring the is_ticket_assignable() RLS check.
  const { data: candidateProfiles } = await supabase
    .from('profiles')
    .select('id, role, team_name')
    .eq('company_id', callerProfile.company_id)
    .in('id', uniqueAssigneeIds)

  const validAssigneeIds = new Set(
    (candidateProfiles ?? [])
      .filter(p =>
        callerProfile.role === 'super_admin'
          ? ['agent', 'team_leader'].includes(p.role)
          : p.role === 'agent' && p.team_name === callerProfile.team_name
      )
      .map(p => p.id)
  )

  if (validAssigneeIds.size !== uniqueAssigneeIds.length) {
    return NextResponse.json({ error: 'One or more assignees are not assignable by you' }, { status: 400 })
  }

  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .insert({
      company_id: callerProfile.company_id,
      created_by: user.id,
      title: trimmedTitle,
      description: trimmedDescription,
      priority: validPriority,
      due_date: normalizedDueDate,
    })
    .select('id, title, description, priority, due_date, created_at')
    .single()

  if (ticketError || !ticket) {
    return NextResponse.json({ error: ticketError?.message ?? 'Failed to create ticket' }, { status: 500 })
  }

  const { error: assigneesError } = await supabase
    .from('ticket_assignees')
    .insert(uniqueAssigneeIds.map(assignee_id => ({ ticket_id: ticket.id, assignee_id })))

  if (assigneesError) {
    await supabase.from('tickets').delete().eq('id', ticket.id)
    return NextResponse.json({ error: assigneesError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    ticket: {
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      dueDate: ticket.due_date,
      createdAt: ticket.created_at,
      assigneeCount: uniqueAssigneeIds.length,
    },
  })
}
