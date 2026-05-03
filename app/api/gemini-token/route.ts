import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getScenarioById, SCENARIOS } from '@/lib/gemini-scenarios'
import { buildKnowledgeBlock, CLINIC_SEARCH_TOOL, type KnowledgeEntry } from '@/lib/knowledge-utils'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
  }

  let scenarioId: string | undefined
  try {
    const body = await req.json()
    scenarioId = body?.scenario
  } catch {
    // no body — use default
  }

  const scenario = (scenarioId ? getScenarioById(scenarioId) : undefined) ?? SCENARIOS[0]

  // Get user's company and role
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  // Enforce free-plan daily limit for trainee accounts (exempt trainee@test.com)
  if (profile?.role === 'trainee' && user.email !== 'trainee@test.com') {
    const admin = createAdminClient()
    const now = new Date()
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const tomorrowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))

    const { count } = await admin
      .from('practice_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('scenario_id', scenario.id)
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', tomorrowStart.toISOString())

    if ((count ?? 0) >= 3) {
      return NextResponse.json({ error: 'DAILY_LIMIT_REACHED', remaining: 0 }, { status: 429 })
    }
  }

  let fullPrompt = scenario.prompt
  const isEducational = scenario.subcategory === 'Educational'

  if (isEducational && profile?.company_id) {
    // Fetch product_fact and common_question entries for injection at session start.
    // clinic_project entries are NOT injected — they're fetched on demand via search_clinic_projects tool.
    const { data: entries } = await supabase
      .from('knowledge_entries')
      .select('category, title, content')
      .eq('company_id', profile.company_id)
      .eq('is_active', true)
      .in('category', ['product_fact', 'common_question'])
      .or(`scenario_ids.is.null,scenario_ids.cs.{"${scenario.id}"}`)

    if (entries && entries.length > 0) {
      const block = buildKnowledgeBlock(entries as KnowledgeEntry[])
      if (block) {
        fullPrompt = scenario.prompt + '\n\n---\n\n' + block
      }
    }
  }

  return NextResponse.json({
    token: apiKey,
    systemPrompt: fullPrompt,
    ...(isEducational && { tools: [CLINIC_SEARCH_TOOL] }),
  })
}
