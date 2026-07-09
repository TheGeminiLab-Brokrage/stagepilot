import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ReportsClient from './ReportsClient'

export interface Report {
  id: string
  company_id: string
  type: 'daily' | 'weekly' | 'monthly'
  report_date: string
  week_number: number | null
  data: Record<string, unknown>
  created_at: string
}

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['super_admin', 'team_leader'].includes(profile.role)) redirect('/dashboard')

  const adminClient = createAdminClient()
  const { data: reports } = await adminClient
    .from('reports')
    .select('id, company_id, type, report_date, week_number, data, created_at')
    .eq('company_id', profile.company_id)
    .order('report_date', { ascending: false })

  return (
    <div className="max-w-5xl pb-8">
      <ReportsClient reports={(reports ?? []) as Report[]} />
    </div>
  )
}
