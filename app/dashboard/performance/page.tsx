import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PerformanceDashboard from './PerformanceDashboard'

export default async function PerformancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, team_name, full_name')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'agent'

  // Trainees/exam users are redirected by the layout, but guard here too
  if (role === 'trainee' || role === 'exam') redirect('/dashboard')

  // RLS automatically scopes call_records to the user's company and role
  const { data: rawCalls } = await supabase
    .from('call_records')
    .select('id, client_name, campaign, stage, stage_corrected, agent_stage, status, uploaded_at, agent_id, team_name')
    .eq('status', 'done')
    .order('uploaded_at', { ascending: false })

  // Fetch full names for all agents referenced in the returned calls
  const agentIds = [...new Set((rawCalls ?? []).map((c: { agent_id: string }) => c.agent_id).filter(Boolean))]
  const { data: profileRows } = agentIds.length > 0
    ? await supabase.from('profiles').select('id, full_name, team_name').in('id', agentIds)
    : { data: [] }

  const agentMap: Record<string, string> = {}
  for (const p of profileRows ?? []) agentMap[p.id] = p.full_name

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calls = (rawCalls ?? []).map((c: any) => ({
    ...c,
    agent_full_name: agentMap[c.agent_id] ?? null,
  }))

  // Load the most recently saved CRM export (for Leads Over Stages chart)
  const admin = createAdminClient()
  const { data: crmExportRow } = await admin
    .from('crm_exports')
    .select('date_from, date_to, data, saved_at')
    .order('saved_at', { ascending: false })
    .limit(1)
    .single()

  const crmExport = crmExportRow
    ? { data: crmExportRow.data as Record<string, unknown>[], dateFrom: crmExportRow.date_from, dateTo: crmExportRow.date_to }
    : null

  return (
    <PerformanceDashboard calls={calls} role={role} crmExport={crmExport} fullName={profile?.full_name ?? null} />
  )
}
