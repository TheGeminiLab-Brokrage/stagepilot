import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PropertyDashboardClient from './PropertyDashboardClient'
import PropertyViewerClient from './PropertyViewerClient'

export default async function FindPropertyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'property_viewer') {
    return (
      <PropertyViewerClient
        userId={user.id}
        companyId={profile.company_id}
      />
    )
  }

  return <PropertyDashboardClient userId={user.id} />
}
