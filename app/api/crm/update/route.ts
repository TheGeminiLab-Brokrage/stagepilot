import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

// Allow up to 5 minutes — CRM exports can take ~90s
export const maxDuration = 300

const CRM_HOST = 'geminilab.8xcrm.com'
const CRM_UI   = 'https://geminilab.8xcrm.net'
const CRM_EMAIL    = process.env.CRM_EMAIL    ?? 'seifsameh@thegeminilab.com'
const CRM_PASSWORD = process.env.CRM_PASSWORD ?? '1234567'

// ── Direct CRM API helper ─────────────────────────────────────────────────────

async function crmFetch(path: string, method: string, token: string | null, body?: object) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
    'x-localization': 'en',
    'User-Agent':   'Mozilla/5.0',
    'Referer':      `${CRM_UI}/`,
    'Connection':   'close',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`https://${CRM_HOST}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  return res.json().catch(() => null)
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Auth — super_admin only
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { dateFrom, dateTo } = body as { dateFrom?: string; dateTo?: string }

  if (!dateFrom || !dateTo) {
    return NextResponse.json({ error: 'dateFrom and dateTo are required' }, { status: 400 })
  }

  try {
    // 2. Login — get Bearer token directly from CRM API
    const loginData = await crmFetch('/api/v2/auth/login', 'POST', null, {
      email: CRM_EMAIL,
      password: CRM_PASSWORD,
    })

    const token = loginData?.data?.token as string | undefined
    if (!token) {
      return NextResponse.json({
        error: 'CRM login failed — check credentials',
        detail: loginData,
      }, { status: 502 })
    }

    // 3. Snapshot existing job IDs so we can identify the new one
    const preSnapshot = await crmFetch('/api/v2/exports/exports-requests', 'GET', token)
    const existingJobs = (preSnapshot?.data?.data ?? []) as Array<{ id: number; export_type?: string; status?: string }>
    const maxIdBefore = Math.max(0, ...existingJobs.map(j => j.id ?? 0))

    // 4. Trigger the Status Changes export
    const triggerData = await crmFetch(
      '/api/v2/exports/export-smart-status-changes',
      'POST', token,
      {}
    )
    const exportJobId = (triggerData?.data?.id ?? null) as number | null

    // 5. Poll for completion (up to 4 minutes)
    const deadline = Date.now() + 240_000
    let downloadUrl: string | null = null
    let lastJobList: unknown[] = []
    let lastJob: unknown = null

    while (Date.now() < deadline) {
      await sleep(5000)

      const jobs = await crmFetch('/api/v2/exports/exports-requests', 'GET', token)
      const list = (jobs?.data?.data ?? []) as Array<{ id: number; status?: string; export_type?: string }>
      lastJobList = list.slice(0, 5) // keep the 5 most recent for diagnostics

      const job = exportJobId
        ? list.find(j => j.id === exportJobId)
        : list
            .filter(j => j.export_type?.toLowerCase().includes('status') && j.id > maxIdBefore)
            .sort((a, b) => b.id - a.id)[0]

      if (job) lastJob = job

      if (!job) continue

      const status = job.status?.toLowerCase()

      if (status === 'failed') {
        return NextResponse.json({ error: `CRM export job #${job.id} failed on server` }, { status: 502 })
      }

      if (status === 'completed') {
        const linkRes = await crmFetch(
          '/api/v2/exports/exports/generate-download-link',
          'POST', token,
          { id: job.id }
        )
        downloadUrl = linkRes?.data?.download_url ?? linkRes?.data?.url ?? null
        if (downloadUrl) break
      }
    }

    if (!downloadUrl) {
      return NextResponse.json({
        error: 'Export did not complete within 4 minutes',
        debug: {
          triggerResponse: triggerData,
          exportJobId,
          maxIdBefore,
          lastJob,
          recentJobs: lastJobList,
        }
      }, { status: 504 })
    }

    // 6. Download the Excel file
    const dlRes = await fetch(downloadUrl)
    if (!dlRes.ok) {
      return NextResponse.json({ error: `Excel download failed: HTTP ${dlRes.status}` }, { status: 502 })
    }
    const buffer = await dlRes.arrayBuffer()

    // 7. Parse and filter by the requested date range
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
    const sheet    = workbook.Sheets[workbook.SheetNames[0]]
    const allRows  = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[]

    const fromMs = new Date(dateFrom + 'T00:00:00Z').getTime()
    const toMs   = new Date(dateTo   + 'T23:59:59Z').getTime()

    const records = allRows.filter(row => {
      const raw = (row['CREATED_AT'] ?? row['Created At'] ?? row['created_at'] ?? '') as string
      if (!raw) return true
      const ts = new Date(raw).getTime()
      return !isNaN(ts) && ts >= fromMs && ts <= toMs
    })

    return NextResponse.json({ ok: true, count: records.length, dateFrom, dateTo, data: records })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
