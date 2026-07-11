import { createClient } from '@/lib/supabase/server'

export interface CallerProfile {
  id: string
  role: string
  company_id: string
  team_name: string | null
  full_name: string
}

export type AuthResult =
  | { error: string; status: number; caller: null }
  | { error: null; status: 200; caller: CallerProfile }

export async function requireCaller(): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401, caller: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id, team_name, full_name')
    .eq('id', user.id)
    .single()

  if (!profile) return { error: 'Unauthorized', status: 401, caller: null }

  return { error: null, status: 200, caller: { id: user.id, ...profile } }
}

export async function requireManagerOrAdmin(): Promise<AuthResult> {
  const result = await requireCaller()
  if (!result.caller) return result
  if (!['team_leader', 'super_admin'].includes(result.caller.role)) {
    return { error: 'Forbidden', status: 403, caller: null }
  }
  return result
}

export async function requireSuperAdmin(): Promise<AuthResult> {
  const result = await requireCaller()
  if (!result.caller) return result
  if (result.caller.role !== 'super_admin') {
    return { error: 'Forbidden', status: 403, caller: null }
  }
  return result
}
