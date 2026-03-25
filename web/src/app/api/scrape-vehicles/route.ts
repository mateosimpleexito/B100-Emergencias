import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { fetchCEEMData } from '@/lib/parse-vehicles'

// Scrapes SGO CEEM for B-100 vehicle status and personnel counts
// Called by Vercel Cron or the Fly.io worker
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-scraper-secret')
  if (secret !== process.env.SCRAPER_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const data = await fetchCEEMData()

  if (!data) {
    return NextResponse.json({ error: 'Failed to fetch CEEM data' }, { status: 502 })
  }

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('company_status')
    .upsert({
      id: 'B-100',
      vehicles: data.vehicles,
      pilots: data.pilots,
      paramedics: data.paramedics,
      personnel: data.personnel,
      updated_at: new Date().toISOString(),
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    company: data.company,
    vehicles: data.vehicles.length,
    pilots: data.pilots,
    paramedics: data.paramedics,
    personnel: data.personnel,
  })
}

// Also support GET for Vercel Cron (cron jobs send GET requests)
export async function GET(req: NextRequest) {
  // For cron, validate with CRON_SECRET header
  const secret = req.headers.get('authorization')
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const data = await fetchCEEMData()

  if (!data) {
    return NextResponse.json({ error: 'Failed to fetch CEEM data' }, { status: 502 })
  }

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('company_status')
    .upsert({
      id: 'B-100',
      vehicles: data.vehicles,
      pilots: data.pilots,
      paramedics: data.paramedics,
      personnel: data.personnel,
      updated_at: new Date().toISOString(),
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, vehicles: data.vehicles.length })
}
