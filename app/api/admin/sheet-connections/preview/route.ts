import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractSheetId, getSheetTabs, getSheetHeaders, getServiceAccountEmail } from '@/lib/sheet-sync'

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') return { error: 'Forbidden', status: 403 }
  return { error: null, status: 200 }
}

// POST /api/admin/sheet-connections/preview
// body: { sheet_url: string, tab_name?: string }
// returns: { service_account_email, tabs?, headers? }
export async function POST(req: Request) {
  const { error, status } = await requireSuperAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const body = await req.json()
  const { sheet_url, tab_name, header_row } = body

  const serviceAccountEmail = getServiceAccountEmail()
  if (!serviceAccountEmail) {
    return NextResponse.json({
      error: 'Google service account not configured. Add GOOGLE_SERVICE_ACCOUNT_KEY to your environment variables.',
    }, { status: 503 })
  }

  if (!sheet_url) {
    return NextResponse.json({ service_account_email: serviceAccountEmail })
  }

  const sheetId = extractSheetId(sheet_url)

  try {
    if (tab_name) {
      const headers = await getSheetHeaders(sheetId, tab_name, header_row ?? 1)
      return NextResponse.json({ service_account_email: serviceAccountEmail, headers })
    } else {
      const tabs = await getSheetTabs(sheetId)
      return NextResponse.json({ service_account_email: serviceAccountEmail, tabs })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const isPermission = msg.includes('403') || msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('not found')
    return NextResponse.json({
      error: isPermission
        ? `Cannot access this sheet. Share it with: ${serviceAccountEmail}`
        : msg,
      service_account_email: serviceAccountEmail,
    }, { status: 422 })
  }
}
