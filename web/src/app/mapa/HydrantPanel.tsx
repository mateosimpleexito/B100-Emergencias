'use client'

import { useState, useEffect, useRef } from 'react'

export interface HydrantReport {
  id: string
  status: string
  tags: string[]
  diameter: string | null
  pressure: string | null
  flow: string | null
  box_key: string | null
  notes: string | null
  photo_urls: string[]
  reporter_name: string
  created_at: string
}

interface Props {
  hydrantIdx: number
  lat: number
  lng: number
  onClose: () => void
}

const STATUS_OPTIONS = [
  { value: 'operational', label: 'Operativo', color: '#22c55e' },
  { value: 'damaged',     label: 'Dañado',    color: '#ef4444' },
  { value: 'missing',     label: 'No encontrado', color: '#6b7280' },
  { value: 'capped',      label: 'Clausurado', color: '#f59e0b' },
  { value: 'unknown',     label: 'Sin datos',  color: '#a855f7' },
]

const TAGS: Record<string, string[]> = {
  damaged:     ['Tapa no abre', 'Tapa faltante', 'Sin agua', 'Poca presión', 'Fuga de agua', 'Tuerca trabada', 'Cuerpo oxidado', 'Sin acceso'],
  operational: ['Accesible', 'Buena presión', 'Revisado recientemente'],
  missing:     ['Zona no encontrada', 'Dirección incorrecta'],
  capped:      ['Construcción cercana', 'Clausurado por obras'],
  unknown:     [],
}

const DIAMETER_OPTIONS = ['2.5 pulgadas', '4 pulgadas', '4.5 pulgadas', '6 pulgadas', 'Otro']
const PRESSURE_OPTIONS = [
  { value: 'muy_baja', label: 'Muy baja' },
  { value: 'baja',     label: 'Baja' },
  { value: 'media',    label: 'Media' },
  { value: 'alta',     label: 'Alta' },
  { value: 'muy_alta', label: 'Muy alta' },
]
const FLOW_OPTIONS = [
  { value: 'muy_bajo', label: 'Muy bajo' },
  { value: 'bajo',     label: 'Bajo' },
  { value: 'medio',    label: 'Medio' },
  { value: 'alto',     label: 'Alto' },
  { value: 'muy_alto', label: 'Muy alto' },
]
const BOX_KEY_OPTIONS = [
  { value: 'abierta',            label: 'Abierta' },
  { value: 'cerrada',            label: 'Cerrada' },
  { value: 'no_se_puede_abrir',  label: 'No se puede abrir' },
  { value: 'sin_tapon',          label: 'Sin tapón' },
]

export default function HydrantPanel({ hydrantIdx, lat, lng, onClose }: Props) {
  const [tab, setTab] = useState<'history' | 'report'>('history')
  const [reports, setReports] = useState<HydrantReport[]>([])
  const [loadingReports, setLoadingReports] = useState(true)

  // Form state
  const [status, setStatus] = useState('unknown')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [diameter, setDiameter] = useState('')
  const [pressure, setPressure] = useState('')
  const [flow, setFlow] = useState('')
  const [boxKey, setBoxKey] = useState('')
  const [notes, setNotes] = useState('')
  const [reporterName, setReporterName] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('b100_reporter_name') ?? '' : ''
  )
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/hydrants/${hydrantIdx}/reports`)
      .then(r => r.json())
      .then(data => { setReports(Array.isArray(data) ? data : []); setLoadingReports(false) })
      .catch(() => setLoadingReports(false))
  }, [hydrantIdx])

  function toggleTag(tag: string) {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Compress via canvas
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 1024
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX }
        else { width = Math.round(width * MAX / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => {
        if (!blob) return
        const compressed = new File([blob], 'photo.jpg', { type: 'image/jpeg' })
        setPhotoFile(compressed)
        setPhotoPreview(canvas.toDataURL('image/jpeg', 0.85))
      }, 'image/jpeg', 0.85)
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    try {
      let photoUrls: string[] = []

      // Upload photo if any
      if (photoFile) {
        const fd = new FormData()
        fd.append('file', photoFile)
        const res = await fetch('/api/hydrants/upload', { method: 'POST', body: fd })
        if (res.ok) {
          const { url } = await res.json()
          if (url) photoUrls = [url]
        }
      }

      await fetch(`/api/hydrants/${hydrantIdx}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status, tags: selectedTags,
          diameter: diameter || null,
          pressure: pressure || null,
          flow: flow || null,
          box_key: boxKey || null,
          notes: notes || null,
          photo_urls: photoUrls,
          reporter_name: reporterName || 'Anónimo',
        }),
      })

      if (reporterName) localStorage.setItem('b100_reporter_name', reporterName)
      setSubmitted(true)
      setTimeout(() => { setTab('history'); setSubmitted(false) }, 1500)
      // Refresh reports
      const res = await fetch(`/api/hydrants/${hydrantIdx}/reports`)
      setReports(await res.json())
    } finally {
      setSubmitting(false)
    }
  }

  const latestStatus = reports[0]?.status ?? 'unknown'
  const statusColor = STATUS_OPTIONS.find(s => s.value === latestStatus)?.color ?? '#6b7280'

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9999] bg-zinc-900 border-t border-zinc-700 rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col"
      style={{ maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: statusColor }} />
          <span className="font-semibold text-white text-sm">Hidrante SEDAPAL</span>
          <span className="text-zinc-500 text-xs">#{hydrantIdx}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>{lat.toFixed(5)}, {lng.toFixed(5)}</span>
          <button onClick={onClose} className="ml-2 text-zinc-400 hover:text-white text-lg leading-none">✕</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-700">
        {(['history', 'report'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${tab === t ? 'text-white border-b-2 border-red-500' : 'text-zinc-400'}`}>
            {t === 'history' ? `Historial (${reports.length})` : 'Reportar'}
          </button>
        ))}
      </div>

      <div className="overflow-y-auto flex-1 p-4">
        {/* HISTORY TAB */}
        {tab === 'history' && (
          <div className="space-y-3">
            {loadingReports && <p className="text-zinc-500 text-sm text-center py-4">Cargando...</p>}
            {!loadingReports && reports.length === 0 && (
              <div className="text-center py-6">
                <p className="text-zinc-500 text-sm">Sin reportes aún</p>
                <button onClick={() => setTab('report')} className="mt-2 text-red-400 text-sm underline">Ser el primero en reportar</button>
              </div>
            )}
            {reports.map(r => (
              <div key={r.id} className="bg-zinc-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ background: STATUS_OPTIONS.find(s => s.value === r.status)?.color ?? '#6b7280' }}>
                    {STATUS_OPTIONS.find(s => s.value === r.status)?.label ?? r.status}
                  </span>
                  <span className="text-zinc-500 text-xs">{new Date(r.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                {r.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {r.tags.map(tag => <span key={tag} className="bg-zinc-700 text-zinc-300 text-xs px-2 py-0.5 rounded-full">{tag}</span>)}
                  </div>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                  {r.diameter && <span>Ø {r.diameter}</span>}
                  {r.pressure && <span>Presión: {PRESSURE_OPTIONS.find(p => p.value === r.pressure)?.label ?? r.pressure}</span>}
                  {r.flow && <span>Caudal: {FLOW_OPTIONS.find(f => f.value === r.flow)?.label ?? r.flow}</span>}
                  {r.box_key && <span>Llave buzón: {BOX_KEY_OPTIONS.find(b => b.value === r.box_key)?.label ?? r.box_key}</span>}
                </div>
                {r.notes && <p className="text-zinc-300 text-xs">{r.notes}</p>}
                {r.photo_urls.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {r.photo_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="foto" className="w-20 h-20 object-cover rounded-lg" />
                      </a>
                    ))}
                  </div>
                )}
                <p className="text-zinc-600 text-xs">Por {r.reporter_name}</p>
              </div>
            ))}
          </div>
        )}

        {/* REPORT TAB */}
        {tab === 'report' && (
          <div className="space-y-4">
            {submitted && (
              <div className="bg-green-900/50 border border-green-500 rounded-xl p-3 text-green-400 text-sm text-center font-semibold">
                ✓ Reporte guardado
              </div>
            )}

            {/* Estado */}
            <div>
              <p className="text-zinc-400 text-xs mb-2 font-semibold uppercase tracking-wide">Estado</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(s => (
                  <button key={s.value} onClick={() => { setStatus(s.value); setSelectedTags([]) }}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                    style={status === s.value
                      ? { background: s.color, color: 'white', borderColor: s.color }
                      : { background: 'transparent', color: '#a1a1aa', borderColor: '#3f3f46' }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            {(TAGS[status] ?? []).length > 0 && (
              <div>
                <p className="text-zinc-400 text-xs mb-2 font-semibold uppercase tracking-wide">Condición (múltiple)</p>
                <div className="flex flex-wrap gap-2">
                  {(TAGS[status] ?? []).map(tag => (
                    <button key={tag} onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${selectedTags.includes(tag) ? 'bg-red-600 border-red-500 text-white' : 'bg-transparent border-zinc-700 text-zinc-400'}`}>
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Datos técnicos */}
            <div>
              <p className="text-zinc-400 text-xs mb-2 font-semibold uppercase tracking-wide">Datos técnicos (opcional)</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-zinc-500 text-xs">Diámetro</label>
                  <select value={diameter} onChange={e => setDiameter(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white mt-1">
                    <option value="">—</option>
                    {DIAMETER_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-zinc-500 text-xs">Llave buzón</label>
                  <select value={boxKey} onChange={e => setBoxKey(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white mt-1">
                    <option value="">—</option>
                    {BOX_KEY_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-zinc-500 text-xs">Presión</label>
                  <select value={pressure} onChange={e => setPressure(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white mt-1">
                    <option value="">—</option>
                    {PRESSURE_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-zinc-500 text-xs">Caudal</label>
                  <select value={flow} onChange={e => setFlow(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white mt-1">
                    <option value="">—</option>
                    {FLOW_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Foto */}
            <div>
              <p className="text-zinc-400 text-xs mb-2 font-semibold uppercase tracking-wide">Foto</p>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
                className="hidden" onChange={handlePhoto} />
              {photoPreview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="preview" className="w-full max-h-40 object-cover rounded-xl" />
                  <button onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">✕</button>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-zinc-700 rounded-xl py-4 text-zinc-500 text-sm hover:border-zinc-500 transition-colors">
                  📷 Tomar foto
                </button>
              )}
            </div>

            {/* Notas */}
            <div>
              <p className="text-zinc-400 text-xs mb-2 font-semibold uppercase tracking-wide">Notas</p>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={300}
                placeholder="Ej: salida de 4.5 pulgadas no se abre la tapa..."
                rows={2}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 resize-none" />
            </div>

            {/* Nombre */}
            <div>
              <p className="text-zinc-400 text-xs mb-2 font-semibold uppercase tracking-wide">Tu nombre</p>
              <input value={reporterName} onChange={e => setReporterName(e.target.value)}
                placeholder="Ej: P/B García"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600" />
            </div>

            <button onClick={handleSubmit} disabled={submitting}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors">
              {submitting ? 'Guardando...' : 'Guardar reporte'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
