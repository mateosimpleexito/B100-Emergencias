'use client'

import { useEffect, useRef, useState } from 'react'

interface Report {
  status: string
  tags: string[]
  diameter: string | null
  pressure: string | null
  flow: string | null
  box_key: string | null
  notes: string | null
  reporter_name: string
  created_at: string
}

interface Props {
  hydrantIdx: number
  lat: number
  lng: number
  onClose: () => void
  onEditMode: () => void
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  operational: { label: 'Operativo',      color: '#22c55e', bg: '#14532d' },
  damaged:     { label: 'Dañado',         color: '#ef4444', bg: '#7f1d1d' },
  missing:     { label: 'No encontrado',  color: '#9ca3af', bg: '#1f2937' },
  capped:      { label: 'Clausurado',     color: '#f59e0b', bg: '#78350f' },
  unknown:     { label: 'Sin datos',      color: '#a78bfa', bg: '#2e1065' },
}

const PRESSURE_LABEL: Record<string, string> = {
  muy_baja: 'Presión muy baja', baja: 'Presión baja',
  media: 'Presión media', alta: 'Presión alta', muy_alta: 'Presión muy alta',
}
const BOX_KEY_LABEL: Record<string, string> = {
  abierta: 'Llave abierta', cerrada: 'Llave cerrada',
  no_se_puede_abrir: 'Llave no abre', sin_tapon: 'Sin tapón',
}

async function compressPhoto(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1024
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX }
        else { width = Math.round(width * MAX / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('compress fail')), 'image/jpeg', 0.82)
    }
    img.onerror = reject
    img.src = url
  })
}

export default function HydrantQuickView({ hydrantIdx, lat, lng, onClose, onEditMode }: Props) {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  // Quick note state
  const [quickMode, setQuickMode] = useState(false)
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/hydrants/${hydrantIdx}/reports`)
      .then(r => r.json())
      .then(data => {
        setReport(Array.isArray(data) && data.length > 0 ? data[0] : null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [hydrantIdx])

  // Reset quick mode when hydrant changes
  useEffect(() => {
    setQuickMode(false); setNote(''); setPhoto(null); setSaved(false)
  }, [hydrantIdx])

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto({ file, preview: URL.createObjectURL(file) })
  }

  async function submitQuickNote() {
    if (!note.trim() && !photo) return
    setSaving(true)
    try {
      let photoUrl: string | null = null
      if (photo) {
        const compressed = await compressPhoto(photo.file)
        const fd = new FormData()
        fd.append('file', new File([compressed], 'photo.jpg', { type: 'image/jpeg' }))
        const up = await fetch('/api/hydrants/upload', { method: 'POST', body: fd })
        const upData = await up.json()
        photoUrl = upData.url ?? null
      }

      const reporter = (typeof window !== 'undefined' && localStorage.getItem('hydrant_reporter')) || 'Bombero'
      await fetch(`/api/hydrants/${hydrantIdx}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: report?.status ?? 'unknown',
          tags: [],
          notes: note.trim() || null,
          photo_urls: photoUrl ? [photoUrl] : [],
          reporter_name: reporter,
        }),
      })
      setSaved(true)
      setQuickMode(false)
      setNote('')
      setPhoto(null)
    } finally {
      setSaving(false)
    }
  }

  const s = STATUS_LABELS[report?.status ?? 'unknown'] ?? STATUS_LABELS.unknown

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] pointer-events-none"
      style={{ maxWidth: 400, margin: '0 auto' }}>
      <div className="pointer-events-auto rounded-2xl shadow-2xl overflow-hidden border border-zinc-700"
        style={{ background: '#18181b' }}>

        {/* Status bar */}
        <div className="flex items-center justify-between px-4 py-2.5"
          style={{ background: s.bg }}>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-white font-bold text-sm">{s.label}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/60 text-xs">#{hydrantIdx}</span>
            <button onClick={onClose} className="text-white/70 hover:text-white text-base leading-none">✕</button>
          </div>
        </div>

        <div className="px-4 py-3 space-y-2">
          {loading && <p className="text-zinc-500 text-xs">Cargando último reporte...</p>}

          {!loading && !report && !saved && (
            <p className="text-zinc-500 text-xs">Sin reportes — sé el primero</p>
          )}

          {saved && (
            <p className="text-green-400 text-xs font-semibold">✓ Nota guardada</p>
          )}

          {!loading && report && !saved && (
            <>
              {report.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {report.tags.map(t => (
                    <span key={t} className="bg-zinc-800 text-zinc-300 text-xs px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-400">
                {report.diameter && <span>Ø {report.diameter}</span>}
                {report.pressure && <span>{PRESSURE_LABEL[report.pressure] ?? report.pressure}</span>}
                {report.box_key && <span>{BOX_KEY_LABEL[report.box_key] ?? report.box_key}</span>}
              </div>

              {report.notes && (
                <p className="text-zinc-300 text-xs line-clamp-2">{report.notes}</p>
              )}

              <p className="text-zinc-600 text-xs">
                {new Date(report.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })} · {report.reporter_name}
              </p>
            </>
          )}

          {/* Quick note inline form */}
          {quickMode && (
            <div className="space-y-2 pt-1 border-t border-zinc-800">
              <textarea
                value={note}
                onChange={e => setNote(e.target.value.slice(0, 200))}
                placeholder="Observación rápida..."
                rows={2}
                className="w-full bg-zinc-800 text-white text-xs rounded-lg px-3 py-2 resize-none outline-none placeholder-zinc-600"
              />
              <div className="flex items-center gap-2">
                {/* Photo preview */}
                {photo && (
                  <div className="relative w-12 h-12 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.preview} alt="" className="w-full h-full object-cover rounded-lg" />
                    <button
                      onClick={() => setPhoto(null)}
                      className="absolute -top-1 -right-1 bg-zinc-900 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center leading-none"
                    >✕</button>
                  </div>
                )}
                {!photo && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1 bg-zinc-800 text-zinc-400 text-xs px-2.5 py-1.5 rounded-lg shrink-0"
                  >
                    📷 Foto
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" capture="environment"
                  className="hidden" onChange={handlePhoto} />
                <button
                  onClick={submitQuickNote}
                  disabled={saving || (!note.trim() && !photo)}
                  className="flex-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-xs font-bold py-1.5 rounded-lg transition-colors"
                >
                  {saving ? 'Guardando...' : 'Guardar nota'}
                </button>
                <button
                  onClick={() => { setQuickMode(false); setNote(''); setPhoto(null) }}
                  className="text-zinc-500 text-xs px-2"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <p className="text-zinc-700 text-xs">{lat.toFixed(5)}, {lng.toFixed(5)}</p>
        </div>

        {/* Footer */}
        {!quickMode && (
          <div className="px-4 pb-3 flex gap-2">
            <button
              onClick={() => setQuickMode(true)}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold py-2 rounded-xl transition-colors"
            >
              📝 Nota rápida
            </button>
            <button
              onClick={onEditMode}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-semibold py-2 rounded-xl transition-colors"
            >
              ✏️ Editar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
