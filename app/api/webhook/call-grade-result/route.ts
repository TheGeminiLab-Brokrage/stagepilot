import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const expectedSecret = process.env.N8N_CALLBACK_SECRET

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret.trim()}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { callbackId, callbackType, grade } = await request.json() as {
    callbackId?: string
    callbackType?: 'exam' | 'practice'
    grade?: Record<string, unknown>
  }

  if (!callbackId || !callbackType || !grade) {
    return NextResponse.json({ error: 'Missing callbackId, callbackType or grade' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (callbackType === 'exam') {
    const { error } = await admin
      .from('exam_results')
      .update({ call_grade: grade })
      .eq('id', callbackId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (callbackType === 'practice') {
    const { error } = await admin
      .from('practice_sessions')
      .update({ call_grade: grade })
      .eq('id', callbackId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    return NextResponse.json({ error: 'Invalid callbackType' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
