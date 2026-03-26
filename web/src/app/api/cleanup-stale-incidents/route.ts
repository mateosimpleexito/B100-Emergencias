import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// GET /api/cleanup-stale-incidents
// Called by Vercel Cron every hour.
// Closes any incident that has been ATENDIENDO for more than 24h —
// these fall off the SGONORTE 24h page and will never auto-update.
export async function GET(req: NextRequest) {
  // Allow Vercel cron (no Authorization header) or manual call with secret
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Also allow SCRAPER_SECRET for manual testing
    const secret = req.headers.get('x-scraper-secret')
    if (secret !== process.env.SCRAPER_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createServiceClient()

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: stale, error: fetchError } = await supabase
    .from('incidents')
    .select('id, nro_parte, dispatched_at')
    .eq('status', 'ATENDIENDO')
    .lt('dispatched_at', cutoff)

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!stale || stale.length === 0) return NextResponse.json({ closed: 0 })

  const { error: updateError } = await supabase
    .from('incidents')
    .update({
      status: 'CERRADO',
      close_note: 'Cerrado automáticamente — más de 24h sin actualización en SGONORTE',
    })
    .in('nro_parte', stale.map(i => i.nro_parte))

  // Retry without close_note if column doesn't exist yet
  if (updateError) {
    await supabase
      .from('incidents')
      .update({ status: 'CERRADO' })
      .in('nro_parte', stale.map(i => i.nro_parte))
  }

  console.log(`[cleanup] Cerrados ${stale.length} incidentes inactivos >24h`)
  return NextResponse.json({ closed: stale.length, nros: stale.map(i => i.nro_parte) })
}
