import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'property-data'

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

// POST — returns a signed upload URL so the (large) dataset file goes straight
// from the admin's browser to Supabase Storage, bypassing Vercel's request
// body limit. The current file is backed up first, so a bad upload is
// recoverable from the timestamped copies.
export async function POST() {
  const { error, status } = await requireSuperAdmin()
  if (error) return NextResponse.json({ error }, { status })

  const admin = createAdminClient()

  // Idempotent bucket setup — private; files are served via signed URLs only
  await admin.storage.createBucket(BUCKET, { public: false }).catch(() => {})

  // Best-effort backup of the current dataset before it gets overwritten
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  await admin.storage.from(BUCKET).copy('latest.json', `backups/${stamp}.json`).catch(() => {})

  const { data, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl('latest.json', { upsert: true })

  if (signErr || !data) {
    return NextResponse.json({ error: signErr?.message ?? 'Failed to create upload URL' }, { status: 500 })
  }

  return NextResponse.json({ path: data.path, token: data.token, bucket: BUCKET })
}
