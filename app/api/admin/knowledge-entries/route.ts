import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401, supabase: null, companyId: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') return { error: 'Forbidden', status: 403, supabase: null, companyId: null }
  return { error: null, status: 200, supabase, companyId: profile.company_id as string }
}

export async function GET() {
  const { error, status, supabase, companyId } = await requireSuperAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const { data, error: dbErr } = await supabase!
    .from('knowledge_entries')
    .select('id, category, title, content, scenario_ids, tags, is_active, created_at, updated_at')
    .eq('company_id', companyId!)
    .order('category')
    .order('title')

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const { error, status, companyId } = await requireSuperAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const body = await req.json()
  const { category, title, content, scenario_ids, tags } = body

  if (!category || !title || !content) {
    return NextResponse.json({ error: 'category, title, and content are required' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data, error: dbErr } = await adminClient
    .from('knowledge_entries')
    .insert({ company_id: companyId, category, title, content, scenario_ids: scenario_ids ?? null, tags: tags ?? null })
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
