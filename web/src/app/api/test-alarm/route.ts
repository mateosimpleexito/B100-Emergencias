import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendFCMToToken, sendPushToSubscription } from '@/lib/push'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-test-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.SCRAPER_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Use the latest real incident so voice announcement works when notification is tapped
  const { data: latestIncident } = await supabase
    .from('incidents')
    .select('nro_parte, type, address, district, units')
    .order('dispatched_at', { ascending: false })
    .limit(1)
    .single()

  const nroParte = latestIncident?.nro_parte ?? 'test-' + Date.now()

  const payload = {
    title: '🚨 PRUEBA — Emergencia B100',
    body: `📍 ${latestIncident?.address ?? 'Av. Conquistadores 1099, San Isidro'}`,
    url: `/incidents/${nroParte}`,
    tag: nroParte,
    icon: '/icons/icon-192.png',
  }

  // FCM
  const { data: fcmTokens } = await supabase.from('fcm_tokens').select('token').eq('active', true)
  let fcmSent = 0
  if (fcmTokens && fcmTokens.length > 0) {
    const results = await Promise.allSettled(
      fcmTokens.map((t: { token: string }) => sendFCMToToken(t.token, payload))
    )
    fcmSent = results.filter(r => r.status === 'fulfilled' && (r.value as { sent: boolean }).sent).length
  }

  // Web Push
  const { data: subs } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth').eq('active', true)
  let webSent = 0
  if (subs && subs.length > 0) {
    const results = await Promise.allSettled(subs.map(s => sendPushToSubscription(s, payload)))
    webSent = results.filter(r => r.status === 'fulfilled' && (r.value as { sent: boolean }).sent).length
  }

  return NextResponse.json({ fcmSent, webSent, fcmTokens: fcmTokens?.length ?? 0, subs: subs?.length ?? 0 })
}
