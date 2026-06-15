import { redirect } from 'next/navigation'
import { headers, cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from './LogoutButton'
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

  const cookieStore = await cookies()
  const langCookie = cookieStore.get('sp_lang')?.value
  const initialLang = (langCookie === 'en' || langCookie === 'ar') ? langCookie : 'ar'

  // Trainee redirect: they only access /dashboard/practice and /dashboard/find-property
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''
  if (role === 'trainee' && !pathname.startsWith('/dashboard/practice') && !pathname.startsWith('/dashboard/find-property')) {
    redirect('/dashboard/practice')
  }
  if (role === 'exam' && !pathname.startsWith('/dashboard/exam') && !pathname.startsWith('/dashboard/find-property')) {
    redirect('/dashboard/exam')
  }

  return (
    <LanguageWrapper initialLang={initialLang}>
      <Navbar role={role} fullName={profile?.full_name} rightSlot={<LogoutButton />} />

      <div className="flex-1 overflow-y-auto flex flex-col">
        <main className="flex-1 min-h-0 max-w-6xl mx-auto w-full px-6 py-6 flex flex-col">
          {children}
        </main>
      </div>


    </LanguageWrapper>
  )
}
