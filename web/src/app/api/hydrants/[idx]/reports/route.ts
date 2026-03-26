import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

type Params = Promise<{ idx: string }>

// GET /api/hydrants/[idx]/reports — últimos reportes de un hidrante
export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { idx } = await params
  const hydrantIdx = parseInt(idx)
  if (isNaN(hydrantIdx)) return NextResponse.json({ error: 'Invalid idx' }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('hydrant_reports')
    .select('id, status, tags, diameter, pressure, flow, box_key, notes, photo_urls, reporter_name, created_at')
    .eq('hydrant_idx', hydrantIdx)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/hydrants/[idx]/reports — guardar nuevo reporte
export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { idx } = await params
  const hydrantIdx = parseInt(idx)
  if (isNaN(hydrantIdx)) return NextResponse.json({ error: 'Invalid idx' }, { status: 400 })

  const body = await req.json()
  const { status, tags, diameter, pressure, flow, box_key, notes, photo_urls, reporter_name } = body

  if (!status) return NextResponse.json({ error: 'status required' }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('hydrant_reports')
    .insert({
      hydrant_idx: hydrantIdx,
      status,
      tags: tags ?? [],
      diameter: diameter ?? null,
      pressure: pressure ?? null,
      flow: flow ?? null,
      box_key: box_key ?? null,
      notes: notes ?? null,
      photo_urls: photo_urls ?? [],
      reporter_name: reporter_name ?? 'Anónimo',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}
