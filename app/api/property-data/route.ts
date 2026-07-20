import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'property-data'

// Serves the property dataset: the admin-uploaded copy in Storage when one
// exists, otherwise the JSON bundled in /public. Redirects (rather than
// streaming) so the 13MB payload never passes through a serverless function.
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: signed } = await admin.storage
    .from(BUCKET)
    .createSignedUrl('latest.json', 3600)

  if (signed?.signedUrl) {
    return NextResponse.redirect(signed.signedUrl, 307)
  }

  // No admin upload yet — fall back to the repo-bundled dataset
  return NextResponse.redirect(new URL('/property-data.json', req.url), 307)
}
