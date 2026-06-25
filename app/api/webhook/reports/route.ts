import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const expectedSecret = process.env.REPORTS_WEBHOOK_SECRET

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret.trim()}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  const text = await request.text()
  try {
    body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { company_id, type, report_date, data, week_number } = body as Record<string, unknown>

  if (!company_id || typeof company_id !== 'string') {
    return NextResponse.json({ error: 'Missing company_id' }, { status: 400 })
  }
  if (!type || !['daily', 'weekly', 'monthly'].includes(type as string)) {
    return NextResponse.json({ error: 'type must be daily, weekly, or monthly' }, { status: 400 })
  }
  if (!report_date || typeof report_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(report_date)) {
    return NextResponse.json({ error: 'report_date must be YYYY-MM-DD' }, { status: 400 })
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return NextResponse.json({ error: 'data must be an object' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { error } = await admin.from('reports').upsert(
    {
      company_id,
      type,
      report_date,
      week_number: typeof week_number === 'number' ? week_number : null,
      data,
    },
    { onConflict: 'company_id,type,report_date' }
  )

  if (error) {
    console.error('reports upsert error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
