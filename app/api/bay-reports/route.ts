import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_ROLES = ['agent', 'team_leader', 'super_admin']

async function authorise() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || !ALLOWED_ROLES.includes(profile.role)) return null
  return { user, profile: profile as { role: string; company_id: string; full_name: string } }
}

// GET — fetch all bay reports for the current user
export async function GET() {
  const auth = await authorise()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('bay_reports')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('report_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, reports: data ?? [] })
}

// POST — upsert a bay report (one per user per day)
export async function POST(request: NextRequest) {
  const auth = await authorise()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  // Default to Cairo today (UTC+2)
  const cairoNow = new Date(Date.now() + 2 * 60 * 60 * 1000)
  const todayStr = cairoNow.toISOString().split('T')[0]
  const reportDate: string = body.report_date ?? todayStr

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('bay_reports')
    .upsert({
      user_id:            auth.user.id,
      company_id:         auth.profile.company_id,
      full_name:          auth.profile.full_name,
      report_date:        reportDate,
      sheets:             Number(body.sheets)      || 0,
      posts:              Number(body.posts)       || 0,
      requests:           Number(body.requests)    || 0,
      followups:          Number(body.followups)   || 0,
      total_leads:        Number(body.total_leads) || 0,
      reached:            Number(body.reached)     || 0,
      not_reached:        Number(body.not_reached) || 0,
      crm_actions:        Number(body.crm_actions) || 0,
      uploaded:           Number(body.uploaded)    || 0,
      not_uploaded:       Number(body.not_uploaded)|| 0,
      crm_confirm:        Boolean(body.crm_confirm),
      has_missed_uploads: Boolean(body.has_missed_uploads),
      missed_calls:       Array.isArray(body.missed_calls) ? body.missed_calls : [],
      summary:            String(body.summary ?? ''),
    }, { onConflict: 'user_id,report_date' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, report: data })
}
