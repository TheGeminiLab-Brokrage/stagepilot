import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'exam' && profile.role !== 'agent')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: results, error } = await admin
    .from('exam_results')
    .select('id, phase1_score, phase1_max, phase2_score, phase2_max, phase3_completed, phase1_details, phase2_details, created_at, report_downloaded_at, call_grade')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 })

  return NextResponse.json({ results: results ?? [] })
}
