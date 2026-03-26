import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import CreateUserForm from './CreateUserForm'

type Profile = {
  id: string
  full_name: string
  role: string
  team_name: string | null
  created_at: string
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-purple-500/20 text-purple-300',
  team_leader: 'bg-blue-500/20 text-blue-300',
  agent: 'bg-gray-500/20 text-gray-400',
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') redirect('/dashboard')

  const adminClient = createAdminClient()
  const { data: profiles } = await adminClient
    .from('profiles')
    .select('id, full_name, role, team_name, created_at')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: true })

  const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers()
  const emailMap = Object.fromEntries((authUsers ?? []).map(u => [u.id, u.email]))

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{profiles?.length ?? 0} users in your company</p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Team</th>
              <th className="text-left px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {(profiles as Profile[] ?? []).map(p => (
              <tr key={p.id} className="border-b border-gray-800/50">
                <td className="px-4 py-3 text-white">
                  {p.full_name}
                  {p.id === user.id && <span className="ml-2 text-xs text-gray-600">(you)</span>}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{emailMap[p.id] ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[p.role] ?? 'bg-gray-700 text-gray-300'}`}>
                    {p.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{p.team_name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(p.created_at).toLocaleDateString('en-GB')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-5">
        <h2 className="text-white font-medium mb-4">Add New User</h2>
        <CreateUserForm />
      </div>
    </div>
  )
}
