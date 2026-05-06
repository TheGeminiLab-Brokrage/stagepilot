import { google } from 'googleapis'
import { createAdminClient } from '@/lib/supabase/admin'

type Category = 'clinic_project' | 'product_fact' | 'common_question'

export interface SheetConnection {
  id: string
  company_id: string
  sheet_id: string
  tab_name: string
  header_row?: number
  scenario_ids: string[]
  category: Category
  column_mapping: Record<string, string>
}

export interface SyncResult {
  synced: number
  skipped: number
  deactivated: number
  error?: string
}

export function extractSheetId(urlOrId: string): string {
  const m = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  return m ? m[1] : urlOrId
}

function getGoogleAuth() {
  const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!keyRaw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not configured')
  const credentials = JSON.parse(Buffer.from(keyRaw, 'base64').toString('utf-8'))
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

export function getServiceAccountEmail(): string {
  const keyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!keyRaw) return ''
  try {
    const creds = JSON.parse(Buffer.from(keyRaw, 'base64').toString('utf-8'))
    return creds.client_email ?? ''
  } catch {
    return ''
  }
}

export async function getSheetTabs(sheetId: string): Promise<string[]> {
  const auth = getGoogleAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
  return (meta.data.sheets ?? [])
    .map((s) => s.properties?.title ?? '')
    .filter(Boolean)
}

export async function getSheetHeaders(sheetId: string, tabName: string, headerRow = 1): Promise<string[]> {
  const auth = getGoogleAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${tabName}'!A${headerRow}:Z${headerRow}`,
  })
  return (response.data.values?.[0] ?? []) as string[]
}

function buildClinicContent(fields: Record<string, string>): string {
  return [
    fields.developer ?? '',
    fields.projectName ?? '',
    fields.location ?? '',
    fields.size ?? '',
    fields.price ?? '',
    fields.pricePerSqm ?? '',
    `Delivery: ${fields.delivery ?? ''}`,
    `Down: ${fields.down ?? ''}`,
    `Install: ${fields.install ?? ''}`,
  ].join(' | ')
}

export async function syncSheetConnection(connection: SheetConnection): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, skipped: 0, deactivated: 0 }

  try {
    const auth = getGoogleAuth()
    const sheets = google.sheets({ version: 'v4', auth })
    const adminClient = createAdminClient()

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: connection.sheet_id,
      range: `'${connection.tab_name}'!A:Z`,
    })

    const rows = response.data.values ?? []
    const headerIdx = (connection.header_row ?? 1) - 1
    if (rows.length <= headerIdx) return result

    const headers = rows[headerIdx] as string[]
    const dataRows = rows.slice(headerIdx + 1)

    const fieldToIndex: Record<string, number> = {}
    for (const [field, header] of Object.entries(connection.column_mapping)) {
      const idx = headers.indexOf(header)
      if (idx !== -1) fieldToIndex[field] = idx
    }

    const refPrefix = `sheet:${connection.sheet_id}:tab:${encodeURIComponent(connection.tab_name)}:`
    const { data: existingEntries } = await adminClient
      .from('knowledge_entries')
      .select('id, source_ref, title, content, is_active')
      .like('source_ref', `${refPrefix}%`)
      .eq('company_id', connection.company_id)

    const existingByRef = new Map(
      (existingEntries ?? []).map((e) => [e.source_ref as string, e])
    )
    const seenRefs = new Set<string>()

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] as string[]
      const sourceRef = `${refPrefix}row:${i + headerIdx + 2}`
      seenRefs.add(sourceRef)

      const fields: Record<string, string> = {}
      for (const [field, idx] of Object.entries(fieldToIndex)) {
        fields[field] = (row[idx] ?? '').trim()
      }

      let title: string
      let content: string

      if (connection.category === 'clinic_project') {
        title = fields.projectName || fields.title || `Row ${i + 2}`
        content = buildClinicContent(fields)
      } else {
        title = fields.title || `Row ${i + 2}`
        content = fields.content || ''
      }

      if (!title.trim() && !content.trim()) {
        result.skipped++
        continue
      }

      const existing = existingByRef.get(sourceRef)
      const scenarioIds = connection.scenario_ids.length > 0 ? connection.scenario_ids : null

      if (existing) {
        if (existing.title !== title || existing.content !== content || !existing.is_active) {
          await adminClient
            .from('knowledge_entries')
            .update({ title, content, scenario_ids: scenarioIds, is_active: true, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
          result.synced++
        } else {
          result.skipped++
        }
      } else {
        await adminClient
          .from('knowledge_entries')
          .insert({
            company_id: connection.company_id,
            category: connection.category,
            title,
            content,
            scenario_ids: scenarioIds,
            is_active: true,
            source_ref: sourceRef,
          })
        result.synced++
      }
    }

    for (const [ref, entry] of existingByRef) {
      if (!seenRefs.has(ref) && entry.is_active) {
        await adminClient
          .from('knowledge_entries')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', entry.id)
        result.deactivated++
      }
    }

    return result
  } catch (err: unknown) {
    result.error = err instanceof Error ? err.message : String(err)
    return result
  }
}
