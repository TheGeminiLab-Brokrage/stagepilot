import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PracticeClient from './PracticeClient'

export default async function PracticePage() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (!user || authError) {
    redirect('/auth/login')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, company_id')
    .eq('id', user.id)
    .single()

  if (!profile || profileError) {
    redirect('/auth/login')
  }

  return (
    <PracticeClient
      userId={user.id}
      companyId={profile.company_id}
      userName={profile.full_name}
    />
  )
}
