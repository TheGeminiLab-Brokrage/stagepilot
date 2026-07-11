import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCaller } from '@/lib/assessment/server-auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error, status, caller } = await requireCaller()
  if (!caller) return NextResponse.json({ error }, { status })

  const supabase = await createClient()

  // Fast path: caller owns the session — RLS-scoped client is sufficient.
  const { data: ownSession } = await supabase
    .from('assessment_sessions')
    .select('*')
    .eq('id', id)
    .eq('user_id', caller.id)
    .maybeSingle()

  if (ownSession) {
    const { data: answers } = await supabase
      .from('assessment_answers')
      .select('*')
      .eq('session_id', id)
      .order('created_at')
    return NextResponse.json({ session: { ...ownSession, full_name: caller.full_name }, answers: answers ?? [] })
  }

  // Otherwise, only a manager/admin viewing an in-scope agent's session may proceed.
  if (!['team_leader', 'super_admin'].includes(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: session } = await admin
    .from('assessment_sessions')
    .select('*, profiles!assessment_sessions_user_id_fkey(full_name, company_id, team_name)')
    .eq('id', id)
    .maybeSingle()

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const owner = session.profiles as { full_name: string; company_id: string; team_name: string | null }
  const inScope = owner.company_id === caller.company_id
    && (caller.role === 'super_admin' || owner.team_name === caller.team_name)
  if (!inScope) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: answers } = await admin
    .from('assessment_answers')
    .select('*')
    .eq('session_id', id)
    .order('created_at')

  const sessionOnly = { id: session.id, user_id: session.user_id, full_name: owner.full_name, region: session.region, started_at: session.started_at, completed_at: session.completed_at }
  return NextResponse.json({ session: sessionOnly, answers: answers ?? [] })
}
