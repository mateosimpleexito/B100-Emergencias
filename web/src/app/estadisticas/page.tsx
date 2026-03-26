'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Incident } from '@/types'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell,
} from 'recharts'

type Period = '7d' | '30d' | '3m' | '1y' | 'all'

const PERIOD_LABELS: Record<Period, string> = {
  '7d': '7 días',
  '30d': '30 días',
  '3m': '3 meses',
  '1y': '1 año',
  'all': 'Todo',
}

const TYPE_SHORT: Record<string, string> = {
  'INCENDIO': 'Incendio',
  'EMERGENCIA MEDICA': 'Emerg. Méd.',
  'ACCIDENTE VEHICULAR': 'Accidente',
  'MATERIALES PELIGROSOS': 'MatPel',
  'RESCATE': 'Rescate',
  'SERVICIO ESPECIAL': 'Serv. Esp.',
}

function getTypeKey(type: string): string {
  const up = type.toUpperCase()
  const key = Object.keys(TYPE_SHORT).find(k => up.includes(k))
  return key ? TYPE_SHORT[key] : type.split('/')[0].trim()
}

function periodStart(period: Period): Date | null {
  if (period === 'all') return null
  const now = new Date()
  if (period === '7d') return new Date(now.getTime() - 7 * 86400000)
  if (period === '30d') return new Date(now.getTime() - 30 * 86400000)
  if (period === '3m') return new Date(now.getTime() - 90 * 86400000)
  if (period === '1y') return new Date(now.getTime() - 365 * 86400000)
  return null
}

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  label: i.toString().padStart(2, '0'),
  count: 0,
}))

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const CHART_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs">
      <p className="text-zinc-300 font-semibold">{label}</p>
      <p className="text-red-400 font-bold">{payload[0].value} incidentes</p>
    </div>
  )
}

export default function EstadisticasPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [period, setPeriod] = useState<Period>('30d')

  useEffect(() => {
    let q = supabase
      .from('incidents')
      .select('*')
      .order('dispatched_at', { ascending: false })

    const start = periodStart(period)
    if (start) {
      q = q.gte('dispatched_at', start.toISOString())
    }

    setError(false)
    q.limit(2000).then(({ data, error: err }) => {
      if (err) { setError(true); setLoading(false); return }
      setIncidents(data ?? [])
      setLoading(false)
    })
  }, [period])

  const stats = useMemo(() => {
    if (!incidents.length) return null

    // By type
    const byType: Record<string, number> = {}
    incidents.forEach(i => {
      const k = getTypeKey(i.type)
      byType[k] = (byType[k] ?? 0) + 1
    })
    const typeData = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))

    // By hour
    const hourData = HOURS.map(h => ({ ...h }))
    incidents.forEach(i => {
      const hour = new Date(i.dispatched_at).getHours()
      hourData[hour].count++
    })

    // By day of week
    const dayData = DAYS.map(label => ({ label, count: 0 }))
    incidents.forEach(i => {
      const day = new Date(i.dispatched_at).getDay()
      dayData[day].count++
    })

    // By month (last 12 months)
    const monthMap: Record<string, number> = {}
    incidents.forEach(i => {
      const d = new Date(i.dispatched_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthMap[key] = (monthMap[key] ?? 0) + 1
    })
    const monthData = Object.entries(monthMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, count]) => {
        const [year, month] = key.split('-')
        const date = new Date(Number(year), Number(month) - 1)
        const label = date.toLocaleDateString('es-PE', { month: 'short', year: '2-digit' })
        return { label, count }
      })

    // By district
    const districtMap: Record<string, number> = {}
    incidents.forEach(i => {
      const d = i.district ?? 'Sin distrito'
      districtMap[d] = (districtMap[d] ?? 0) + 1
    })
    const districtData = Object.entries(districtMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }))

    // By unit (only B100 units)
    const unitMap: Record<string, number> = {}
    incidents.forEach(i => {
      i.units.forEach(u => {
        unitMap[u] = (unitMap[u] ?? 0) + 1
      })
    })
    const unitData = Object.entries(unitMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }))

    // Peak hour
    const peakHour = [...hourData].sort((a, b) => b.count - a.count)[0]

    return { typeData, hourData, dayData, monthData, districtData, unitData, peakHour }
  }, [incidents])

  const active = incidents.filter(i => i.status === 'ATENDIENDO').length
  const closed = incidents.filter(i => i.status === 'CERRADO').length

  return (
    <main className="max-w-lg mx-auto px-4 py-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-zinc-500 text-xl">←</Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold leading-none">Estadísticas</h1>
          <p className="text-xs text-zinc-400">B100 · Compañía San Isidro</p>
        </div>
      </div>

      {/* Period filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
          <button
            key={p}
            onClick={() => { setLoading(true); setPeriod(p) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
              period === p ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-zinc-500 py-16 text-sm">Cargando estadísticas...</div>
      ) : error ? (
        <div className="text-center text-red-400 py-16 text-sm">Error al cargar datos. Verificá tu conexión.</div>
      ) : !stats ? (
        <div className="text-center text-zinc-600 py-16 text-sm">Sin datos para este período</div>
      ) : (
        <div className="space-y-6">

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-white">{incidents.length}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Total</p>
            </div>
            <div className="bg-red-950/40 border border-red-900/50 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-red-400">{active}</p>
              <p className="text-xs text-zinc-500 mt-0.5">En curso</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-zinc-300">{closed}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Cerrados</p>
            </div>
          </div>

          {/* Peak hour callout */}
          {stats.peakHour.count > 0 && (
            <div className="bg-orange-950/30 border border-orange-900/40 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-2xl">🕐</span>
              <div>
                <p className="text-xs text-zinc-400">Hora pico de emergencias</p>
                <p className="text-white font-bold">{stats.peakHour.label}:00 h
                  <span className="text-orange-400 text-sm font-normal ml-2">({stats.peakHour.count} incidentes)</span>
                </p>
              </div>
            </div>
          )}

          {/* By type */}
          <section>
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Por tipo</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <ResponsiveContainer width="100%" height={stats.typeData.length * 38 + 10}>
                <BarChart data={stats.typeData} layout="vertical" margin={{ left: 0, right: 24, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 11, fill: '#a1a1aa' }} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#27272a' }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {stats.typeData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* By hour */}
          <section>
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Por hora del día</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={stats.hourData} margin={{ left: -10, right: 0, top: 4, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#71717a' }} interval={1} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#27272a' }} />
                  <Bar dataKey="count" fill="#ef4444" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* By day of week */}
          <section>
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Por día de semana</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={stats.dayData} margin={{ left: -10, right: 0, top: 4, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#a1a1aa' }} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#27272a' }} />
                  <Bar dataKey="count" fill="#f97316" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Monthly trend */}
          {stats.monthData.length > 1 && (
            <section>
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Tendencia mensual</h2>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={stats.monthData} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#71717a' }} />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ fill: '#ef4444', r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* Top districts */}
          <section>
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Por distrito</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
              {stats.districtData.map((d, i) => {
                const max = stats.districtData[0].count
                const pct = Math.round((d.count / max) * 100)
                return (
                  <div key={d.name} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-zinc-600 text-xs w-4 text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 truncate">{d.name}</p>
                      <div className="mt-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                        <div className="h-full bg-red-600 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="text-zinc-400 text-xs font-semibold shrink-0">{d.count}</span>
                  </div>
                )
              })}
            </div>
          </section>

          {/* By unit */}
          <section>
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Por unidad despachada</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
              {stats.unitData.map((u, i) => {
                const max = stats.unitData[0].count
                const pct = Math.round((u.count / max) * 100)
                const isB100 = ['M100-1', 'RES-100', 'AMB-100', 'AUX-100', 'AUX100-2'].includes(u.name)
                return (
                  <div key={u.name} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-zinc-600 text-xs w-4 text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate font-mono font-bold ${isB100 ? 'text-red-400' : 'text-zinc-300'}`}>
                        {u.name}
                      </p>
                      <div className="mt-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                        <div className={`h-full rounded-full ${isB100 ? 'bg-red-600' : 'bg-zinc-600'}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="text-zinc-400 text-xs font-semibold shrink-0">{u.count}</span>
                  </div>
                )
              })}
            </div>
          </section>

        </div>
      )}
    </main>
  )
}
