import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from './LogoutButton'

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
  const isLeader = role === 'team_leader' || role === 'super_admin'

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-white font-bold tracking-tight">StagePilot</span>
            <nav className="flex gap-1">
              <a
                href="/dashboard"
                className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-md hover:bg-gray-800 transition-colors"
              >
                {role === 'agent' ? 'My Calls' : 'Team Calls'}
              </a>
              {role === 'agent' && (
                <a
                  href="/dashboard/upload"
                  className="text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-md hover:bg-gray-800 transition-colors"
                >
                  Upload Call
                </a>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              {profile?.full_name} · <span className="capitalize">{role.replace('_', ' ')}</span>
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        {children}
      </main>
    </div>
  )
}
