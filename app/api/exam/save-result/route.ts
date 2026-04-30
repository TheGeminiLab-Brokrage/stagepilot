import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'exam') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { phase1Score, phase1Max, phase2Score, phase2Max, phase3Completed, phase1Details, phase2Details } = await req.json()

  const { error } = await supabase.from('exam_results').insert({
    user_id: user.id,
    company_id: profile.company_id,
    phase1_score: phase1Score,
    phase1_max: phase1Max,
    phase2_score: phase2Score,
    phase2_max: phase2Max,
    phase3_completed: phase3Completed,
    phase1_details: phase1Details ?? null,
    phase2_details: phase2Details ?? null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
