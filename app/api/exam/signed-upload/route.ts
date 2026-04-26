import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const audioPath = `${user.id}/${Date.now()}.mp3`
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from('exam-recordings')
    .createSignedUploadUrl(audioPath)

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed to create signed URL' }, { status: 500 })
  return NextResponse.json({ signedUrl: data.signedUrl, audioPath })
}
