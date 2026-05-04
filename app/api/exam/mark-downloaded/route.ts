import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'exam' && profile.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { resultId } = await request.json()
  if (!resultId) return NextResponse.json({ error: 'Missing resultId' }, { status: 400 })

  const admin = createAdminClient()
  const query = admin
    .from('exam_results')
    .update({ report_downloaded_at: new Date().toISOString() })
    .eq('id', resultId)

  // Exam users can only mark their own results; admins can mark any
  if (profile.role === 'exam') {
    query.eq('user_id', user.id)
  }

  const { error } = await query
  if (error) return NextResponse.json({ error: 'Failed to mark download' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
