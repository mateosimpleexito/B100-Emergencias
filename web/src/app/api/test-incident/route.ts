import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { buildIncidentPayload, sendPushToSubscription } from '@/lib/push'
import { B100_UNITS } from '@/types'

// Inserts a fake incident and fires push notifications — for testing only
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-scraper-secret')
  if (secret !== process.env.SCRAPER_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const nro_parte = `TEST-${Date.now()}`

  const { data: inserted, error } = await supabase
    .from('incidents')
    .insert({
      nro_parte,
      type: 'INCENDIO / ESTRUCTURA',
      address: 'AV. CONQUISTADORES 1140',
      district: 'SAN ISIDRO',
      lat: -12.0977,
      lng: -77.0531,
      status: 'ATENDIENDO',
      dispatched_at: new Date().toISOString(),
      units: [B100_UNITS[0], B100_UNITS[1]],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('active', true)

  let sent = 0
  if (subs && subs.length > 0) {
    const payload = buildIncidentPayload(inserted)
    const results = await Promise.allSettled(
      subs.map(s => sendPushToSubscription(s, payload))
    )
    sent = results.filter(r => r.status === 'fulfilled').length
  }

  return NextResponse.json({ incident: inserted, notifications_sent: sent })
}
