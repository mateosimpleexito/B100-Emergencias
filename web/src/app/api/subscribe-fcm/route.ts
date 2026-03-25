import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { token } = await req.json()
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Store FCM token — upsert so re-registrations just update the timestamp
  const { error } = await supabase
    .from('fcm_tokens')
    .upsert({ token, active: true, updated_at: new Date().toISOString() }, { onConflict: 'token' })

  if (error) {
    console.error('[subscribe-fcm] DB error:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
