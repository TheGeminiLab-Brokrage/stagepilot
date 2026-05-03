import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ExamClient from './ExamClient'

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

  return (
    <ExamClient
      userId={user.id}
      companyId={profile.company_id}
      userName={profile.full_name}
      userEmail={user.email ?? ''}
    />
  )
}
