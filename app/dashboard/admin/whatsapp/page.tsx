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
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') redirect('/dashboard')

  const adminClient = createAdminClient()

  const { data: sheets } = await adminClient
    .from('whatsapp_sheets')
    .select('id, name, current_cycle, created_at')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })

  const { data: contactCounts } = await adminClient
    .from('whatsapp_contacts')
    .select('sheet_id')
    .eq('company_id', profile.company_id)

  const counts: Record<string, number> = {}
  for (const c of contactCounts ?? []) {
    counts[c.sheet_id] = (counts[c.sheet_id] ?? 0) + 1
  }

  const sheetsWithCounts = (sheets ?? []).map(s => ({ ...s, contactCount: counts[s.id] ?? 0 }))

  const { data: agents } = await adminClient
    .from('profiles')
    .select('id, full_name, team_name, whatsapp_active')
    .eq('company_id', profile.company_id)
    .eq('role', 'agent')
    .order('full_name')

  return <WhatsAppAdminClient initialSheets={sheetsWithCounts} initialAgents={agents ?? []} />
}
