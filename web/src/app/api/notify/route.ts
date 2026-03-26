import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { buildIncidentPayload, sendPushToSubscription } from '@/lib/push'
import type { Incident } from '@/types'

// Called by the scraper worker when a new B100 incident is detected
// Protected by SCRAPER_SECRET to prevent unauthorized calls
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-scraper-secret')
  if (secret !== process.env.SCRAPER_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const incident: Incident = await req.json()
  const supabase = createServiceClient()

  // Fetch all active push subscriptions
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 })

  const payload = buildIncidentPayload(incident)

  // Send to all subscribers in parallel
  const results = await Promise.allSettled(
    subs.map(sub => sendPushToSubscription(sub, payload))
  )

  // Clean up expired subscriptions
  const expiredEndpoints = subs
    .filter((_, i) => {
      const r = results[i]
      return r.status === 'fulfilled' && r.value.expired
    })
    .map(s => s.endpoint)

  if (expiredEndpoints.length > 0) {
    await supabase
      .from('push_subscriptions')
      .update({ active: false })
      .in('endpoint', expiredEndpoints)
  }

  const sent = results.filter(r => r.status === 'fulfilled' && (r.value as { sent: boolean }).sent).length
  const failed = results.length - sent

  return NextResponse.json({ sent, failed, expired: expiredEndpoints.length })
}
