import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PracticeClient from './PracticeClient'

export default async function PracticePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, company_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')

  return (
    <PracticeClient
      userId={user.id}
      companyId={profile.company_id}
      userName={profile.full_name}
    />
  )
}
