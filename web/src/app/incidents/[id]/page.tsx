import { createServiceClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { B100_UNITS } from '@/types'
import IncidentMap from './IncidentMap'
import CloseIncidentButton from './CloseIncidentButton'
import { getResourceGroups } from '@/lib/emergency-resources'
import type { ResourceGroup } from '@/lib/emergency-resources'

interface Props {
  params: Promise<{ id: string }>
}

const COLOR_CLASSES: Record<string, string> = {
  red: 'border-red-800 bg-red-950/40',
  orange: 'border-orange-800 bg-orange-950/40',
  yellow: 'border-yellow-800 bg-yellow-950/40',
  blue: 'border-blue-800 bg-blue-950/40',
  green: 'border-green-800 bg-green-950/40',
  zinc: 'border-zinc-700 bg-zinc-900/60',
}

const LABEL_COLOR: Record<string, string> = {
  red: 'text-red-400',
  orange: 'text-orange-400',
  yellow: 'text-yellow-400',
  blue: 'text-blue-400',
  green: 'text-green-400',
  zinc: 'text-zinc-400',
}

function ResourcePanel({ groups }: { groups: ResourceGroup[] }) {
  if (groups.length === 0) return null
  return (
    <div>
      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Recursos de emergencia</p>
      <div className="space-y-4">
        {groups.map(group => (
          <div key={group.title}>
            <p className="text-xs font-semibold text-zinc-400 mb-2">
              {group.icon} {group.title}
            </p>
            <div className="space-y-2">
              {group.items.map(item => (
                <a
                  key={item.label}
                  href={item.url}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 active:opacity-70 transition-opacity ${COLOR_CLASSES[item.color]}`}
                >
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${LABEL_COLOR[item.color]}`}>{item.label}</p>
                    <p className="text-xs text-zinc-500 truncate">{item.detail}</p>
                  </div>
                  {item.phone && (
                    <span className="text-sm font-mono text-zinc-300 ml-3 shrink-0">
                      📞 {item.phone}
                    </span>
                  )}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function IncidentPage({ params }: Props) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: incident } = await supabase
    .from('incidents')
    .select('*')
    .eq('nro_parte', id)
    .single()

  if (!incident) notFound()

  const isActive = incident.status === 'ATENDIENDO'
  const typeShort = incident.type.split('/')[0].trim()
  const typeDetail = incident.type.split('/').slice(1).map((s: string) => s.trim()).filter(Boolean)
  const resourceGroups = getResourceGroups(incident.type, incident.district)

  const dispatchedAt = new Date(incident.dispatched_at).toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <main className="max-w-lg mx-auto">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-zinc-800">
        <Link href="/" className="text-zinc-400 text-2xl leading-none">←</Link>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-zinc-500">#{incident.nro_parte}</p>
          <h1 className="text-base font-bold truncate">{typeShort}</h1>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full
          ${isActive ? 'bg-red-600 text-white' : 'bg-zinc-700 text-zinc-300'}`}>
          {incident.status}
        </span>
      </div>

      {/* Map */}
      {incident.lat && incident.lng ? (
        <IncidentMap lat={incident.lat} lng={incident.lng} address={incident.address} />
      ) : (
        <div className="h-48 bg-zinc-900 flex items-center justify-center text-zinc-500 text-sm">
          Sin coordenadas GPS
        </div>
      )}

      {/* Details */}
      <div className="px-4 py-4 space-y-4">

        {/* Address */}
        <div>
          <p className="text-xs text-zinc-500 mb-1">Dirección</p>
          <p className="font-semibold text-zinc-100">{incident.address}</p>
          {incident.district && <p className="text-sm text-zinc-400">{incident.district}</p>}
        </div>

        {/* Type breakdown */}
        {typeDetail.length > 0 && (
          <div>
            <p className="text-xs text-zinc-500 mb-1">Tipo</p>
            <p className="text-sm text-zinc-300">{typeDetail.join(' / ')}</p>
          </div>
        )}

        {/* Units */}
        <div>
          <p className="text-xs text-zinc-500 mb-2">Unidades despachadas</p>
          <div className="flex flex-wrap gap-2">
            {incident.units.map((u: string) => (
              <span key={u} className={`px-3 py-1 rounded-lg text-sm font-mono font-bold
                ${(B100_UNITS as readonly string[]).includes(u)
                  ? 'bg-red-700 text-white'
                  : 'bg-zinc-700 text-zinc-300'
                }`}>
                {u}
              </span>
            ))}
          </div>
        </div>

        {/* Timestamp */}
        <div>
          <p className="text-xs text-zinc-500 mb-1">Despacho</p>
          <p className="text-sm text-zinc-300">{dispatchedAt}</p>
        </div>

        {/* Navigation */}
        {incident.lat && incident.lng && (
          <div className="flex gap-3 pt-2">
            <a
              href={`https://maps.google.com/?q=${incident.lat},${incident.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold transition-colors"
            >
              Google Maps
            </a>
            <a
              href={`https://waze.com/ul?ll=${incident.lat},${incident.lng}&navigate=yes`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold transition-colors"
            >
              Waze
            </a>
          </div>
        )}

        {/* Manual close — only when active */}
        {isActive && (
          <CloseIncidentButton
            nroParte={incident.nro_parte}
            dispatchedAt={incident.dispatched_at}
          />
        )}

        {/* Close note — shown when closed manually */}
        {!isActive && incident.close_note && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 px-4 py-3">
            <p className="text-xs text-zinc-500 mb-1">Nota de cierre</p>
            <p className="text-sm text-zinc-300">{incident.close_note}</p>
          </div>
        )}

        {/* Emergency resources */}
        <ResourcePanel groups={resourceGroups} />

      </div>
    </main>
  )
}
