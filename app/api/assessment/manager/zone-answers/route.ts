import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCaller } from '@/lib/assessment/server-auth'

export async function GET(req: NextRequest) {
  const { error, status, caller } = await requireCaller()
  if (!caller) return NextResponse.json({ error }, { status })

  const supabase = await createClient()
  const capitalType = req.nextUrl.searchParams.get('capitalType') ?? 'standard'
  const onlyMine = req.nextUrl.searchParams.get('onlyMine') === 'true'

  let query = supabase
    .from('assessment_zone_answers')
    .select('*')
    .eq('capital_type', capitalType)

  if (onlyMine) query = query.eq('submitted_by', caller.id)

  const { data, error: qe } = await query
  if (qe) return NextResponse.json({ error: qe.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { error, status, caller } = await requireCaller()
  if (!caller) return NextResponse.json({ error }, { status })
  if (caller.role !== 'team_leader') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()
  const { zone_id, capital_type, price_per_meter, part2_data } = await req.json()
  if (!zone_id || !capital_type) {
    return NextResponse.json({ error: 'zone_id and capital_type are required.' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('assessment_zone_answers')
    .select('id')
    .eq('zone_id', zone_id)
    .eq('capital_type', capital_type)
    .eq('submitted_by', caller.id)
    .maybeSingle()

  if (existing) {
    const updateFields: Record<string, unknown> = {}
    if (price_per_meter !== undefined) updateFields.price_per_meter = price_per_meter
    if (part2_data !== undefined) updateFields.part2_data = part2_data

    const { error: ue } = await supabase
      .from('assessment_zone_answers')
      .update(updateFields)
      .eq('id', existing.id)
    if (ue) return NextResponse.json({ error: ue.message }, { status: 500 })
  } else {
    const insertFields: Record<string, unknown> = { zone_id, capital_type, submitted_by: caller.id }
    if (price_per_meter !== undefined) insertFields.price_per_meter = price_per_meter
    if (part2_data !== undefined) insertFields.part2_data = part2_data

    const { error: ie } = await supabase.from('assessment_zone_answers').insert(insertFields)
    if (ie) return NextResponse.json({ error: ie.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
