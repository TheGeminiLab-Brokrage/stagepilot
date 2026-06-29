import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WhatsAppClient from './WhatsAppClient'

export default async function WhatsAppPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'agent') redirect('/dashboard')

  return <WhatsAppClient />
}
