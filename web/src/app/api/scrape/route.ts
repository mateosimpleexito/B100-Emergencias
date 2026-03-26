import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parseIncidentsPage, filterB100Rows } from '@/lib/parse-incident'
import { buildIncidentPayload, sendPushToSubscription, sendFCMToToken } from '@/lib/push'

const SGO_URL = 'https://sgonorte.bomberosperu.gob.pe/24horas'
const FETCH_TIMEOUT_MS = 15_000

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-scraper-secret')
  if (secret !== process.env.SCRAPER_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Fetch SGO Norte with timeout
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  let html: string
  try {
    const res = await fetch(SGO_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept-Language': 'es-PE,es;q=0.9',
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!res.ok) {
      return NextResponse.json({ error: `SGO Norte returned ${res.status}` }, { status: 502 })
    }
    html = await res.text()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown fetch error'
    return NextResponse.json({ error: `SGO fetch failed: ${msg}` }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }

  const allRows = parseIncidentsPage(html)
  const b100Rows = filterB100Rows(allRows)

  if (b100Rows.length === 0) {
    return NextResponse.json({ new: 0, updated: 0 })
  }

  // Get existing nro_partes from DB to detect new ones
  const nroParts = b100Rows.map(r => r.nro_parte)
  const { data: existing } = await supabase
    .from('incidents')
    .select('nro_parte, status')
    .in('nro_parte', nroParts)

  const existingMap = new Map((existing ?? []).map(e => [e.nro_parte, e.status]))

  let newCount = 0
  let updatedCount = 0

  for (const row of b100Rows) {
    const existingStatus = existingMap.get(row.nro_parte)

    if (!existingStatus) {
      // New incident — insert and notify
      const { data: inserted, error } = await supabase
        .from('incidents')
        .insert(row)
        .select()
        .single()

      if (error) continue
      if (inserted) {
        newCount++

        // Fire push notifications & clean up expired subscriptions
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth')
          .eq('active', true)

        const payload = buildIncidentPayload(inserted)

        // Web Push (PWA subscribers)
        if (subs && subs.length > 0) {
          const results = await Promise.allSettled(
            subs.map(async (s) => {
              const result = await sendPushToSubscription(s, payload)
              if (result.expired) {
                await supabase
                  .from('push_subscriptions')
                  .update({ active: false })
                  .eq('endpoint', s.endpoint)
              }
              return result
            })
          )
          const sent = results.filter(r => r.status === 'fulfilled' && (r.value as { sent: boolean }).sent).length
          console.log(`[scrape] Web Push sent: ${sent}/${subs.length}`)
        }

        // FCM Push (native APK subscribers)
        const { data: fcmTokens } = await supabase
          .from('fcm_tokens')
          .select('token')
          .eq('active', true)

        if (fcmTokens && fcmTokens.length > 0) {
          const fcmResults = await Promise.allSettled(
            fcmTokens.map(async (t: { token: string }) => {
              const result = await sendFCMToToken(t.token, payload)
              if (result.expired) {
                await supabase.from('fcm_tokens').update({ active: false }).eq('token', t.token)
              }
              return result
            })
          )
          const fcmSent = fcmResults.filter(r => r.status === 'fulfilled' && (r.value as { sent: boolean }).sent).length
          console.log(`[scrape] FCM sent: ${fcmSent}/${fcmTokens.length}`)
        }
      }
    } else if (existingStatus !== row.status) {
      // Status changed (e.g. ATENDIENDO → CERRADO)
      await supabase
        .from('incidents')
        .update({ status: row.status, updated_at: new Date().toISOString() })
        .eq('nro_parte', row.nro_parte)
      updatedCount++
    }
  }

  return NextResponse.json({ new: newCount, updated: updatedCount })
}

// Support GET for Vercel Cron
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const fakeReq = new NextRequest(req.url, {
    method: 'POST',
    headers: { 'x-scraper-secret': process.env.SCRAPER_SECRET ?? '' },
  })
  return POST(fakeReq)
}
