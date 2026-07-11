import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export interface AssessmentProfile {
  userId: string
  fullName: string
  role: string
}

/** Server-component auth+role gate shared by every /dashboard/assessment/** page.tsx. */
export async function requireAssessmentAccess(allowedRoles: string[]): Promise<AssessmentProfile> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (!profile || !allowedRoles.includes(profile.role)) redirect('/dashboard')

  return { userId: user.id, fullName: profile.full_name, role: profile.role }
}

export const AGENT_ROLES = ['agent', 'team_leader', 'super_admin']
export const MANAGER_ROLES = ['team_leader', 'super_admin']
export const ADMIN_ROLES = ['super_admin']
