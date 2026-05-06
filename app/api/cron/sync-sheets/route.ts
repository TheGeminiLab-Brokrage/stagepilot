import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncSheetConnection } from '@/lib/sheet-sync'

// GET /api/cron/sync-sheets
// Called by Vercel Cron every 15 minutes. Protected by CRON_SECRET.
export async function GET(req: Request) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const { data: connections, error } = await adminClient
    .from('sheet_connections')
    .select('*')
    .eq('is_active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!connections || connections.length === 0) {
    return NextResponse.json({ message: 'No active connections', synced: 0 })
  }

  const results: Record<string, unknown> = {}

  for (const conn of connections) {
    const result = await syncSheetConnection({
      id: conn.id,
      company_id: conn.company_id,
      sheet_id: conn.sheet_id,
      tab_name: conn.tab_name,
      scenario_ids: conn.scenario_ids ?? [],
      category: conn.category,
      column_mapping: conn.column_mapping ?? {},
    })

    await adminClient
      .from('sheet_connections')
      .update({ last_synced_at: new Date().toISOString(), last_sync_result: result })
      .eq('id', conn.id)

    results[conn.id] = result
  }

  return NextResponse.json({ synced: connections.length, results })
}
