import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from './LogoutButton'
import GeminiVoiceButton from './components/GeminiVoiceButton'
import Navbar from './Navbar'
import LanguageWrapper from './LanguageWrapper'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, team_name')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'agent'

  // Trainee redirect: they only access /dashboard/practice
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''
  if (role === 'trainee' && !pathname.startsWith('/dashboard/practice')) {
    redirect('/dashboard/practice')
  }
  if (role === 'exam' && !pathname.startsWith('/dashboard/exam')) {
    redirect('/dashboard/exam')
  }

  return (
    <LanguageWrapper>
      <Navbar role={role} fullName={profile?.full_name} rightSlot={<LogoutButton />} />

      <div className="flex-1 overflow-y-auto flex flex-col">
        <main className="flex-1 min-h-0 max-w-6xl mx-auto w-full px-6 py-6 flex flex-col">
          {children}
        </main>
      </div>

      {role !== 'trainee' && role !== 'exam' && <GeminiVoiceButton />}
    </LanguageWrapper>
  )
}
