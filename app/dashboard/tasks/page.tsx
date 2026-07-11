import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TasksClient from './TasksClient'
import type { ChatRole } from '../chatTypes'

const TASKS_ELIGIBLE_ROLES = ['agent', 'team_leader', 'super_admin']

export default async function TasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile || !TASKS_ELIGIBLE_ROLES.includes(profile.role) || !profile.company_id) {
    redirect('/dashboard')
  }

  return (
    <TasksClient
      currentUserId={user.id}
      companyId={profile.company_id}
      role={profile.role as ChatRole}
    />
  )
}
