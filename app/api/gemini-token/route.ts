import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

  // Get user's company
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  let fullPrompt = scenario.prompt

  if (profile?.company_id) {
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
    tools: [CLINIC_SEARCH_TOOL],
  })
}
