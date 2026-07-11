import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/assessment/server-auth'

// GET ?capitalType=r7|standard — returns all submissions with manager name
export async function GET(req: NextRequest) {
  const { error, status } = await requireSuperAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const admin = createAdminClient()
  const capitalType = req.nextUrl.searchParams.get('capitalType') ?? 'standard'

  const { data: answers, error: qe } = await admin
    .from('assessment_zone_answers')
    .select('*')
    .eq('capital_type', capitalType)
    .order('zone_id', { ascending: true })

  if (qe) return NextResponse.json({ error: qe.message }, { status: 500 })

  const submitterIds = [...new Set((answers ?? []).map(a => a.submitted_by).filter(Boolean))]
  const profileMap: Record<string, string> = {}

  if (submitterIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name')
      .in('id', submitterIds)
    for (const p of profiles ?? []) {
      profileMap[p.id] = p.full_name ?? 'Unknown'
    }
  }

  const enriched = (answers ?? []).map(a => ({
    ...a,
    manager_name: a.submitted_by ? (profileMap[a.submitted_by] ?? 'Unknown') : 'Unknown',
  }))

  return NextResponse.json({ data: enriched })
}

// POST { answer_id } — admin approves one answer for a zone (toggles off if already approved)
export async function POST(req: NextRequest) {
  const { error, status } = await requireSuperAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const admin = createAdminClient()
  const { answer_id } = await req.json()
  if (!answer_id) return NextResponse.json({ error: 'answer_id is required.' }, { status: 400 })

  const { data: target, error: fetchErr } = await admin
    .from('assessment_zone_answers')
    .select('id, zone_id, capital_type, is_approved')
    .eq('id', answer_id)
    .single()

  if (fetchErr || !target) return NextResponse.json({ error: 'Answer not found.' }, { status: 404 })

  if (target.is_approved) {
    const { error: ue } = await admin
      .from('assessment_zone_answers')
      .update({ is_approved: false })
      .eq('id', answer_id)
    if (ue) return NextResponse.json({ error: ue.message }, { status: 500 })
    return NextResponse.json({ success: true, approved: false })
  }

  const { error: clearErr } = await admin
    .from('assessment_zone_answers')
    .update({ is_approved: false })
    .eq('zone_id', target.zone_id)
    .eq('capital_type', target.capital_type)
  if (clearErr) return NextResponse.json({ error: clearErr.message }, { status: 500 })

  const { error: approveErr } = await admin
    .from('assessment_zone_answers')
    .update({ is_approved: true })
    .eq('id', answer_id)
  if (approveErr) return NextResponse.json({ error: approveErr.message }, { status: 500 })

  return NextResponse.json({ success: true, approved: true })
}
