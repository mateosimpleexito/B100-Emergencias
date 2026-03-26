import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

type Params = Promise<{ idx: string }>

// POST /api/hydrants/[idx]/correct — guardar corrección de posición
export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { idx } = await params
  const hydrantIdx = parseInt(idx)
  if (isNaN(hydrantIdx)) return NextResponse.json({ error: 'Invalid idx' }, { status: 400 })

  const { old_lat, old_lng, new_lat, new_lng, reporter_name } = await req.json()
  if (!new_lat || !new_lng) return NextResponse.json({ error: 'new_lat/new_lng required' }, { status: 400 })

  const supabase = createServiceClient()
  const { error } = await supabase.from('hydrant_corrections').insert({
    hydrant_idx: hydrantIdx,
    old_lat, old_lng, new_lat, new_lng,
    reporter_name: reporter_name ?? 'Anónimo',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
