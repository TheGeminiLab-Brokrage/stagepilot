import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ExamPageWrapper from './ExamPageWrapper'

export const dynamic = 'force-dynamic'

export default async function ExamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'exam') redirect('/auth/login')

  const admin = createAdminClient()
  const { data: rawResults } = await admin
    .from('exam_results')
    .select('id, phase1_score, phase1_max, phase2_score, phase2_max, phase3_completed, phase1_details, phase2_details, created_at, report_downloaded_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <ExamPageWrapper
      userId={user.id}
      companyId={profile.company_id}
      userName={profile.full_name}
      userEmail={user.email ?? ''}
      initialResults={rawResults ?? []}
    />
  )
}
