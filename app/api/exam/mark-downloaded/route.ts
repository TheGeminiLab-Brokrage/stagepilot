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

  if (!profile || profile.role !== 'exam') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { resultId } = await request.json()
  if (!resultId) return NextResponse.json({ error: 'Missing resultId' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('exam_results')
    .update({ report_downloaded_at: new Date().toISOString() })
    .eq('id', resultId)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'Failed to mark download' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
