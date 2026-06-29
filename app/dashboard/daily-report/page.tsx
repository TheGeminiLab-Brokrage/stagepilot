import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import DailyReportClient from './DailyReportClient'

export interface BayReport {
  id: string
  user_id: string
  company_id: string
  full_name: string
  report_date: string
  sheets: number
  posts: number
  requests: number
  followups: number
  total_leads: number
  reached: number
  not_reached: number
  crm_actions: number
  uploaded: number
  not_uploaded: number
  crm_confirm: boolean
  has_missed_uploads: boolean
  missed_calls: { name: string; phone: string; reason: string }[]
  summary: string
  created_at: string
}

export default async function DailyReportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id, full_name')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'agent'
  if (!['agent', 'team_leader', 'super_admin'].includes(role)) {
    redirect('/dashboard')
  }

  const admin = createAdminClient()
  const { data: reports } = await admin
    .from('bay_reports')
    .select('*')
    .eq('user_id', user.id)
    .order('report_date', { ascending: false })

  return (
    <div className="max-w-5xl pb-8">
      <DailyReportClient
        reports={(reports ?? []) as BayReport[]}
        fullName={profile?.full_name ?? ''}
      />
    </div>
  )
}
