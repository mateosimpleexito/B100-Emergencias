import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parseIncidentsPage, filterB100Rows } from '@/lib/parse-incident'
import { buildIncidentPayload, sendPushToSubscription } from '@/lib/push'

const SGO_URL = 'https://sgonorte.bomberosperu.gob.pe/24horas'

// This endpoint is called by the Fly.io worker (or Vercel Cron as fallback)
// It fetches SGO Norte, detects new B100 incidents, and sends push notifications
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-scraper-secret')
  if (secret !== process.env.SCRAPER_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Fetch SGO Norte page — no-store to prevent Next.js caching
  const res = await fetch(SGO_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
      'Accept-Language': 'es-PE,es;q=0.9',
      'Cache-Control': 'no-cache',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    return NextResponse.json({ error: `SGO Norte returned ${res.status}` }, { status: 502 })
  }

  const html = await res.text()
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
  const errors: string[] = []

  for (const row of b100Rows) {
    const existingStatus = existingMap.get(row.nro_parte)

    if (!existingStatus) {
      // New incident — insert and notify
      const { data: inserted, error } = await supabase
        .from('incidents')
        .insert(row)
        .select()
        .single()

      if (error) {
        errors.push(error.message)
        continue
      }
      if (inserted) {
        newCount++

        // Fire push notifications
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth')
          .eq('active', true)

        if (subs && subs.length > 0) {
          const payload = buildIncidentPayload(inserted)
          await Promise.allSettled(subs.map(s => sendPushToSubscription(s, payload)))
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

  return NextResponse.json({
    new: newCount,
    updated: updatedCount,
    ...(errors.length > 0 ? { errors } : {}),
  })
}

// Support GET for Vercel Cron
export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Re-use POST logic with a fake secret header
  const fakeReq = new NextRequest(req.url, {
    method: 'POST',
    headers: { 'x-scraper-secret': process.env.SCRAPER_SECRET ?? '' },
  })
  return POST(fakeReq)
}
