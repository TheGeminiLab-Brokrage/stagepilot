import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WhatsAppClient from './WhatsAppClient'

export default async function WhatsAppPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'agent') redirect('/dashboard')

  const { data: rawAssignments } = await supabase
    .from('whatsapp_assignments')
    .select(`
      id, cycle, message_text, sent_at, response_status,
      contact:whatsapp_contacts!contact_id(id, phone, client_name),
      sheet:whatsapp_sheets!sheet_id(id, name, current_cycle)
    `)
    .eq('agent_id', user.id)
    .order('created_at', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignments = (rawAssignments ?? []).map((a: any) => ({
    ...a,
    contact: Array.isArray(a.contact) ? a.contact[0] : a.contact,
    sheet: Array.isArray(a.sheet) ? a.sheet[0] : a.sheet,
  })).filter(a => a.contact && a.sheet)

  return <WhatsAppClient initialAssignments={assignments} />
}
