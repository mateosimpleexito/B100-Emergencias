'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  nroParte: string
  dispatchedAt: string  // ISO string — to show age
}

export default function CloseIncidentButton({ nroParte, dispatchedAt }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [closedAt, setClosedAt] = useState('')

  const hoursActive = Math.round((Date.now() - new Date(dispatchedAt).getTime()) / 3600000)

  async function handleClose() {
    setLoading(true)
    try {
      const res = await fetch(`/api/incidents/${nroParte}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ close_note: note.trim() || undefined }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? 'Error al cerrar el incidente')
        return
      }
      setClosedAt(new Date().toLocaleTimeString('es-PE', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima'
      }))
      setDone(true)
      setOpen(false)
      // Refresh server component data
      setTimeout(() => router.refresh(), 800)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-green-800 bg-green-950/40 px-4 py-3 flex items-center gap-3">
        <span className="text-green-400 text-xl">✓</span>
        <div>
          <p className="text-green-400 text-sm font-semibold">Emergencia finalizada</p>
          <p className="text-zinc-500 text-xs">Cerrada a las {closedAt}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-orange-700 bg-orange-950/30 hover:bg-orange-950/60 active:bg-orange-900/60 px-4 py-3 transition-colors"
      >
        <span className="text-orange-400 font-semibold text-sm">Finalizar emergencia</span>
        {hoursActive > 0 && (
          <span className="text-orange-600 text-xs">({hoursActive}h activa)</span>
        )}
      </button>

      {/* Confirmation modal */}
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center px-4 pb-8"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)' }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🔴</span>
              <div>
                <h3 className="text-white font-bold text-base leading-tight">Finalizar emergencia</h3>
                <p className="text-zinc-500 text-xs">#{nroParte} · {hoursActive}h activa</p>
              </div>
            </div>

            <p className="text-zinc-400 text-sm mb-4 leading-relaxed">
              Esto marcará la emergencia como <strong className="text-zinc-200">CERRADO</strong>. Útil cuando el sistema SGONORTE no se actualizó correctamente.
            </p>

            {/* Notes */}
            <div className="mb-4">
              <label className="text-xs text-zinc-500 mb-1.5 block">Notas (opcional)</label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value.slice(0, 300))}
                placeholder="Ej: Regresando a cuartel, sin novedades. Sistema no actualizó."
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-3 py-2.5 resize-none outline-none placeholder-zinc-600 focus:border-orange-700"
              />
              <p className="text-right text-zinc-600 text-xs mt-1">{note.length}/300</p>
            </div>

            {/* Actions */}
            <button
              onClick={handleClose}
              disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-500 active:bg-orange-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl mb-3 text-sm transition-colors"
            >
              {loading ? 'Cerrando...' : 'Confirmar — Finalizar emergencia'}
            </button>
            <button
              onClick={() => setOpen(false)}
              disabled={loading}
              className="w-full text-zinc-500 text-sm py-2"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
