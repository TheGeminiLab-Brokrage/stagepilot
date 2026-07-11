import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_REGIONS = ['north_coast', 'capital_r8', 'capital_r7']

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { region } = await req.json()
  if (!VALID_REGIONS.includes(region)) {
    return NextResponse.json({ error: 'Invalid region' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('assessment_sessions')
    .insert({ user_id: user.id, region })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}
