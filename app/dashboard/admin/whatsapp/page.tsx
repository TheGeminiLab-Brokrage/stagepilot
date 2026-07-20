import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import WhatsAppAdminClient from './WhatsAppAdminClient'

export default async function WhatsAppAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin' && profile?.role !== 'team_leader') redirect('/dashboard')

  const adminClient = createAdminClient()

  const { data: sheets } = await adminClient
    .from('whatsapp_sheets')
    .select('id, name, current_cycle, created_at')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })

  // Exact count per sheet — a single unpaginated select silently caps at
  // 1000 rows and undercounts every sheet once total contacts exceed that.
  const sheetsWithCounts = await Promise.all(
    (sheets ?? []).map(async s => {
      const { count } = await adminClient
        .from('whatsapp_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('sheet_id', s.id)
      return { ...s, contactCount: count ?? 0 }
    })
  )

  let agentsQuery = adminClient
    .from('profiles')
    .select('id, full_name, team_name, whatsapp_active')
    .eq('company_id', profile.company_id)
    .eq('role', 'agent')
    .order('full_name')
  // Team leaders only manage their own team's agents
  if (profile.role === 'team_leader') agentsQuery = agentsQuery.eq('team_name', profile.full_name)

  const { data: agents } = await agentsQuery

  return <WhatsAppAdminClient initialSheets={sheetsWithCounts} initialAgents={agents ?? []} role={profile.role as 'super_admin' | 'team_leader'} />
}
