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
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', fontFamily: "'Montserrat', sans-serif", letterSpacing: '-0.02em' }}>Upload Call Recording</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 6, lineHeight: 1.6 }}>
          Your recording will be transcribed and categorized automatically. Audio is never stored.
        </p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 4, fontFamily: "'Space Grotesk', sans-serif" }}>
          Uploading as <span style={{ color: 'rgba(215,255,0,0.6)' }}>{profile.full_name}</span>
          {profile.team_name && <> &middot; <span style={{ color: 'rgba(215,255,0,0.6)' }}>{profile.team_name} team</span></>}
        </p>
      </div>
      <UploadForm />
    </div>
  )
}
