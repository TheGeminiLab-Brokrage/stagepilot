import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import UploadForm from './UploadForm'

export default async function UploadPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, team_name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'agent') redirect('/dashboard')

  return (
    <div className="max-w-lg">
      <UploadForm agentName={profile.full_name} teamName={profile.team_name ?? null} />
    </div>
  )
}
