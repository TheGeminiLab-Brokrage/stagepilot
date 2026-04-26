import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatProjectResults, type KnowledgeEntry } from '@/lib/knowledge-utils'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { query } = await req.json()
  if (!query || typeof query !== 'string') {
    return NextResponse.json({ error: 'Missing query' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) {
    return NextResponse.json({ result: 'No project data available.' })
  }

  // Search clinic projects by title or content (case-insensitive)
  const term = query.trim()
  const { data: entries } = await supabase
    .from('knowledge_entries')
    .select('category, title, content')
    .eq('company_id', profile.company_id)
    .eq('category', 'clinic_project')
    .eq('is_active', true)
    .or(`title.ilike.%${term}%,content.ilike.%${term}%`)
    .limit(10)

  const result = formatProjectResults((entries ?? []) as KnowledgeEntry[])
  return NextResponse.json({ result })
}
