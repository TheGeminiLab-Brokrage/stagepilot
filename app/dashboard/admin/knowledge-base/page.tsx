import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import KnowledgeBaseManager from './KnowledgeBaseManager'

export default async function KnowledgeBasePage() {
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
  const { data: entries } = await adminClient
    .from('knowledge_entries')
    .select('id, category, title, content, scenario_ids, tags, is_active, created_at, updated_at')
    .eq('company_id', profile.company_id)
    .order('category')
    .order('title')

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Knowledge Base</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage the data the AI retrieves during sessions — clinic projects, product facts, and common client questions.
          </p>
        </div>
      </div>
      <KnowledgeBaseManager initialEntries={entries ?? []} />
    </div>
  )
}
