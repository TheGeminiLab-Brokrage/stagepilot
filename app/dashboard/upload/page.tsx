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
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Upload Call Recording</h1>
        <p className="text-sm text-gray-500 mt-1">
          Your recording will be transcribed and categorized automatically. Audio is never stored.
        </p>
        <p className="text-xs text-gray-600 mt-1">
          Uploading as <span className="text-gray-400">{profile.full_name}</span>
          {profile.team_name && <> &middot; <span className="text-gray-400">{profile.team_name} team</span></>}
        </p>
      </div>
      <UploadForm />
    </div>
  )
}
