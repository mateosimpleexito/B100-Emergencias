import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendFCMToToken, sendPushToSubscription } from '@/lib/push'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-test-secret')
  if (secret !== process.env.SCRAPER_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const payload = {
    title: '🚨 PRUEBA — Incendio Estructura',
    body: '🚒 B-100 AUTO BOMBA\n📍 Av. Conquistadores 1099, San Isidro',
    url: '/',
    tag: 'test-' + Date.now(),
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
