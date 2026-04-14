import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PracticeClient from './PracticeClient'

export const dynamic = 'force-dynamic'

export default async function PracticePage() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    console.log('[PracticePage] Auth check:', { userId: user?.id, authError })

    if (!user || authError) {
      console.log('[PracticePage] No user, redirecting to login')
      redirect('/auth/login')
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, company_id')
      .eq('id', user.id)
      .single()

    console.log('[PracticePage] Profile fetch:', { profileFound: !!profile, profileError })

    if (!profile || profileError) {
      console.log('[PracticePage] No profile, redirecting to login')
      redirect('/auth/login')
    }

    return (
      <PracticeClient
        userId={user.id}
        companyId={profile.company_id}
        userName={profile.full_name}
      />
    )
  } catch (error) {
    console.error('[PracticePage] Error:', error)
    redirect('/auth/login')
  }
}
