import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PropertyDataUploader from './PropertyDataUploader'

export default async function PropertyDataAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') redirect('/dashboard')

  return <PropertyDataUploader />
}
