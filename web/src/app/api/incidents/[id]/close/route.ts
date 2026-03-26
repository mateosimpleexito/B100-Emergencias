import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

type Params = Promise<{ id: string }>

// POST /api/incidents/[id]/close
// Body: { close_note?: string }
export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const close_note: string = body.close_note?.trim() || 'Cerrado manualmente desde la app'

  const supabase = createServiceClient()

  // Verify incident exists and is still active
  const { data: incident } = await supabase
    .from('incidents')
    .select('id, status, nro_parte')
    .eq('nro_parte', id)
    .single()

  if (!incident) return NextResponse.json({ error: 'Incidente no encontrado' }, { status: 404 })
  if (incident.status === 'CERRADO') {
    return NextResponse.json({ error: 'El incidente ya está cerrado' }, { status: 409 })
  }

  // Try with close_note first; if column doesn't exist yet, retry without it
  const { error } = await supabase
    .from('incidents')
    .update({ status: 'CERRADO', close_note })
    .eq('nro_parte', id)

  if (error) {
    const { error: error2 } = await supabase
      .from('incidents')
      .update({ status: 'CERRADO' })
      .eq('nro_parte', id)
    if (error2) return NextResponse.json({ error: error2.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
