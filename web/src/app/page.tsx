'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { initAlarm, playAlarm, stopAlarm } from '@/lib/alarm'
import type { Incident, CompanyStatus, VehicleStatusCode } from '@/types'
import { B100_UNITS } from '@/types'

const TYPE_COLORS: Record<string, string> = {
  INCENDIO: 'bg-red-600',
  'EMERGENCIA MEDICA': 'bg-blue-600',
  'ACCIDENTE VEHICULAR': 'bg-orange-500',
  'MATERIALES PELIGROSOS': 'bg-yellow-600',
  RESCATE: 'bg-purple-600',
}

function getTypeColor(type: string): string {
  const key = Object.keys(TYPE_COLORS).find(k => type.toUpperCase().includes(k))
  return key ? TYPE_COLORS[key] : 'bg-zinc-600'
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Lima',
  })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Lima',
  })
}

// Clean up category name: "MATERIALES PELIGROSOS (INCIDENTE)" → "MAT. PELIGROSOS"
function cleanCategory(raw: string): string {
  let cat = raw.replace(/\s*\(.*?\)\s*/g, '').trim() // remove parenthetical
  // Shorten long categories
  if (cat === 'MATERIALES PELIGROSOS') cat = 'MATPEL'
  if (cat === 'ACCIDENTE VEHICULAR') cat = 'ACC. VEHICULAR'
  if (cat === 'EMERGENCIA MEDICA') cat = 'EMERGENCIA MÉD.'
  if (cat === 'SERVICIO ESPECIAL') cat = 'SERV. ESPECIAL'
  return cat
}

// "RESCATE / ACANTILADO / SIN ACCESO INFERIOR" → "Acantilado · Sin acceso inferior"
function formatTypeDetail(type: string): string {
  const parts = type.split('/').map(s => s.trim())
  const detail = parts.slice(1)
    .filter(p => p.length > 0)
    .map(p => p.replace(/\s*\(.*?\)\s*/g, '').trim()) // remove parenthetical
    .filter(p => p.length > 0)
    .map(p => p.charAt(0) + p.slice(1).toLowerCase())
    .join(' · ')
  return detail
}

function IncidentCard({ incident }: { incident: Incident }) {
  const isActive = incident.status === 'ATENDIENDO'
  const typeCategory = cleanCategory(incident.type.split('/')[0].trim())
  const typeDetail = formatTypeDetail(incident.type)

  return (
    <Link href={`/incidents/${incident.nro_parte}`}>
      <div className={`rounded-xl border p-4 mb-3 cursor-pointer active:scale-95 transition-transform
        ${isActive
          ? 'border-red-600 bg-red-950/30'
          : 'border-zinc-700 bg-zinc-900/50'
        }`}>

        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex flex-col gap-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase w-fit ${getTypeColor(incident.type)}`}>
              {typeCategory}
            </span>
            {typeDetail && (
              <p className="text-sm font-semibold text-zinc-100 px-1 leading-tight">{typeDetail}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            {isActive ? (
              <span className="flex items-center gap-1 text-red-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
                ATENDIENDO
              </span>
            ) : (
              <span className="text-zinc-500 text-xs">CERRADO</span>
            )}
          </div>
        </div>

        <p className="text-sm font-medium text-zinc-100 mb-1 leading-snug">
          {incident.address}
        </p>
        {incident.district && (
          <p className="text-xs text-zinc-400 mb-2">{incident.district}</p>
        )}

        <div className="flex flex-wrap gap-1 mb-2">
          {incident.units.map(u => (
            <span key={u} className={`text-xs px-2 py-0.5 rounded font-mono font-semibold
              ${(B100_UNITS as readonly string[]).includes(u)
                ? 'bg-red-700 text-white'
                : 'bg-zinc-700 text-zinc-300'
              }`}>
              {u}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">#{incident.nro_parte}</span>
          <span className="text-xs text-zinc-500">
            {formatDate(incident.dispatched_at)} · {formatTime(incident.dispatched_at)}
          </span>
        </div>
      </div>
    </Link>
  )
}

const STATUS_CONFIG: Record<VehicleStatusCode, { color: string; dot: string; label: string }> = {
  disponible: { color: 'text-green-400', dot: 'bg-green-500', label: 'Disponible' },
  en_emergencia: { color: 'text-yellow-400', dot: 'bg-yellow-500', label: 'En emergencia' },
  no_disponible: { color: 'text-red-400', dot: 'bg-red-500', label: 'No disponible' },
  en_taller: { color: 'text-zinc-400', dot: 'bg-zinc-500', label: 'En taller' },
}

function CompanyStatusPanel({ status }: { status: CompanyStatus | null }) {
  if (!status) {
    return (
      <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-4 text-center text-zinc-500 text-sm">
        Cargando estado de unidades...
      </div>
    )
  }

  const updatedAgo = Math.round((Date.now() - new Date(status.updated_at).getTime()) / 60000)

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-200">Estado B-100</h2>
        <span className="text-xs text-zinc-500">
          {updatedAgo < 2 ? 'ahora' : `hace ${updatedAgo} min`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        {status.vehicles.map(v => {
          const cfg = STATUS_CONFIG[v.status]
          return (
            <div key={v.code} className="flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot} ${v.status === 'en_emergencia' ? 'animate-pulse' : ''}`} />
              <span className="font-mono font-semibold text-zinc-100 text-xs">{v.code}</span>
              <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
            </div>
          )
        })}
      </div>

      <div className="flex gap-4 pt-2 border-t border-zinc-800 text-xs text-zinc-400">
        <span>{status.pilots} piloto{status.pilots !== 1 ? 's' : ''}</span>
        <span>{status.paramedics} param.</span>
        <span>{status.personnel} personal</span>
      </div>
    </div>
  )
}

function AlarmButton() {
  const { state, loading, subscribe, unsubscribe } = usePushNotifications()

  if (state === 'unsupported') {
    return (
      <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-center text-zinc-400 text-sm">
        Tu navegador no soporta notificaciones push.<br />
        <span className="text-xs">Instalá la app desde el menú del navegador para activarlas.</span>
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className="rounded-xl border border-yellow-700 bg-yellow-950/30 p-4 text-center">
        <p className="text-yellow-400 text-sm font-semibold">Notificaciones bloqueadas</p>
        <p className="text-zinc-400 text-xs mt-1">Habilitá los permisos en la configuración del navegador</p>
      </div>
    )
  }

  if (state === 'subscribed') {
    return (
      <div className="rounded-xl border border-green-700 bg-green-950/30 p-4 flex items-center justify-between">
        <div>
          <p className="text-green-400 font-semibold text-sm flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse inline-block" />
            Alarmas activas
          </p>
          <p className="text-zinc-400 text-xs mt-0.5">Vas a recibir alertas cuando despachen una unidad B100</p>
        </div>
        <button
          onClick={unsubscribe}
          disabled={loading}
          className="text-xs text-zinc-500 underline ml-4 shrink-0"
        >
          Desactivar
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={subscribe}
      disabled={loading}
      className="w-full rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800
        disabled:opacity-50 p-5 text-center font-bold text-lg transition-colors
        flex items-center justify-center gap-3"
    >
      <span className="text-2xl">🔔</span>
      {loading ? 'Activando...' : 'Activar alarmas de emergencia'}
    </button>
  )
}

export default function HomePage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [companyStatus, setCompanyStatus] = useState<CompanyStatus | null>(null)
  const [alarmActive, setAlarmActive] = useState(false)

  const triggerAlarm = useCallback(() => {
    playAlarm()
    setAlarmActive(true)
  }, [])

  const dismissAlarm = useCallback(() => {
    stopAlarm()
    setAlarmActive(false)
  }, [])

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error)

      // Listen for emergency alarm from service worker push
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'EMERGENCY_ALARM') {
          triggerAlarm()
        }
      })
    }

    // Init audio context on first user interaction
    const unlock = () => {
      initAlarm()
      document.removeEventListener('click', unlock)
      document.removeEventListener('touchstart', unlock)
    }
    document.addEventListener('click', unlock, { once: true })
    document.addEventListener('touchstart', unlock, { once: true })

    // Fetch incidents
    Promise.resolve(
      supabase
        .from('incidents')
        .select('*')
        .order('dispatched_at', { ascending: false })
        .limit(30)
    ).then(({ data }) => {
      setIncidents(data ?? [])
      setLoading(false)
    }).catch((err) => {
      console.error('Failed to load incidents:', err)
      setLoading(false)
    })

    // Fetch company status
    Promise.resolve(
      supabase
        .from('company_status')
        .select('*')
        .eq('id', 'B-100')
        .single()
    ).then(({ data }) => {
      if (data) setCompanyStatus(data as CompanyStatus)
    }).catch(() => {})

    // Realtime: incidents
    const incidentsChannel = supabase
      .channel('incidents-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, payload => {
        if (payload.eventType === 'INSERT') {
          setIncidents(prev => [payload.new as Incident, ...prev])
          // Play alarm for new incidents when app is open
          triggerAlarm()
        } else if (payload.eventType === 'UPDATE') {
          setIncidents(prev =>
            prev.map(i => i.id === (payload.new as Incident).id ? payload.new as Incident : i)
          )
        }
      })
      .subscribe()

    // Realtime: company status
    const statusChannel = supabase
      .channel('company-status-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_status' }, payload => {
        if (payload.new) setCompanyStatus(payload.new as CompanyStatus)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(incidentsChannel)
      supabase.removeChannel(statusChannel)
      stopAlarm()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const active = incidents.filter(i => i.status === 'ATENDIENDO')
  const closed = incidents.filter(i => i.status === 'CERRADO')

  return (
    <main className="max-w-lg mx-auto px-4 py-6">
      {/* Alarm banner — shows when siren is active */}
      {alarmActive && (
        <div className="fixed inset-x-0 top-0 z-50 bg-red-600 animate-pulse">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <span className="text-white font-bold text-sm">🚨 EMERGENCIA B100</span>
            <button
              onClick={dismissAlarm}
              className="bg-white/20 text-white text-xs font-bold px-4 py-1.5 rounded-full active:bg-white/30"
            >
              SILENCIAR
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-xl">
          🚒
        </div>
        <div>
          <h1 className="text-xl font-bold leading-none">B100 Emergencias</h1>
          <p className="text-xs text-zinc-400">Bomberos San Isidro 100</p>
        </div>
      </div>

      <div className="mb-6">
        <AlarmButton />
      </div>

      <div className="mb-6">
        <CompanyStatusPanel status={companyStatus} />
      </div>

      {active.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            En curso ({active.length})
          </h2>
          {active.map(i => <IncidentCard key={i.id} incident={i} />)}
        </section>
      )}

      <section>
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Últimas 24 hs
        </h2>
        {loading ? (
          <div className="text-center text-zinc-500 py-8 text-sm">Cargando...</div>
        ) : incidents.length === 0 ? (
          <div className="text-center text-zinc-600 py-8 text-sm">
            Sin incidentes con unidades B100 en las últimas 24 hs
          </div>
        ) : (
          closed.map(i => <IncidentCard key={i.id} incident={i} />)
        )}
      </section>
    </main>
  )
}
