'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  FACILITIES,
  FACILITY_COLORS,
  INSURANCE_COLORS,
  INSURANCE_LABELS,
  type InsuranceType,
  type MedicalFacility,
} from '@/lib/emergency-map-data'
import { WATER_SOURCES, WATER_TYPE_COLORS, WATER_TYPE_LABELS, type WaterSource } from '@/lib/water-sources'
import { supabase } from '@/lib/supabase'
import type { Incident } from '@/types'
import HydrantPanel from './HydrantPanel'
import HydrantQuickView from './HydrantQuickView'

const CENTER: [number, number] = [-12.0964, -77.0428]
const ZOOM = 15
const HYDRANT_RADIUS_KM = 2
const FALLBACK_RADIUS_KM = 1.5

interface SelectedHydrant { idx: number; lat: number; lng: number }
type GeoStatus = 'pending' | 'granted' | 'denied' | 'unavailable'

function distKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Icons ────────────────────────────────────────────────────────────────────

function facilityIcon(L: typeof import('leaflet'), f: MedicalFacility) {
  const color = FACILITY_COLORS[f.type]
  const emoji = f.type === 'hospital_publico' || f.type === 'hospital_essalud' ? '🏥' : '🏨'
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};border:2px solid white;border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,0.5);">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  })
}


function waterIcon(L: typeof import('leaflet'), source: WaterSource) {
  const color = WATER_TYPE_COLORS[source.type]
  return L.divIcon({
    className: '',
    html: `<div style="background:${color};border:2px solid white;border-radius:6px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 1px 5px rgba(0,0,0,0.6);">💧</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  })
}

// Pulsing blue dot — like Google Maps
function userLocationIcon(L: typeof import('leaflet')) {
  return L.divIcon({
    className: '',
    html: `<div class="b100-user-location"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

// Last emergency marker — pulsing red fire truck
function emergencyIcon(L: typeof import('leaflet'), isActive: boolean) {
  return L.divIcon({
    className: '',
    html: `<div class="${isActive ? 'b100-emergency-active' : 'b100-emergency-closed'}" style="
      background:${isActive ? '#dc2626' : '#52525b'};
      border:2px solid white;
      border-radius:10px;
      width:34px;height:34px;
      display:flex;align-items:center;justify-content:center;
      font-size:18px;
      box-shadow:0 3px 10px rgba(0,0,0,0.6);
    ">🚒</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  })
}

// ── Popups ───────────────────────────────────────────────────────────────────

function buildFacilityPopup(f: MedicalFacility): string {
  const traumaBadge = f.trauma
    ? `<span style="background:#dc2626;color:white;font-size:10px;padding:1px 5px;border-radius:4px;font-weight:bold;">TRAUMA/UCI</span>`
    : ''
  const pedBadge = f.pediatria
    ? `<span style="background:#7c3aed;color:white;font-size:10px;padding:1px 5px;border-radius:4px;font-weight:bold;">PEDIATRÍA</span>`
    : ''
  const insurancePills = f.insurance
    .map(i => `<span style="background:${INSURANCE_COLORS[i]}22;color:${INSURANCE_COLORS[i]};border:1px solid ${INSURANCE_COLORS[i]}55;font-size:10px;padding:1px 5px;border-radius:4px;">${i}</span>`)
    .join(' ')
  const phoneLink = f.phone
    ? `<a href="tel:${f.phone.replace(/[^0-9+]/g, '')}" style="color:#60a5fa;font-size:12px;">📞 ${f.phone}</a>`
    : ''
  const notes = f.notes ? `<p style="font-size:11px;color:#a1a1aa;margin:4px 0 0;">${f.notes}</p>` : ''

  return `<div style="min-width:220px;font-family:sans-serif;">
    <p style="font-weight:700;font-size:14px;margin:0 0 4px;">${f.name}</p>
    <p style="font-size:11px;color:#a1a1aa;margin:0 0 6px;">${f.address}</p>
    <div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:6px;">${traumaBadge}${pedBadge}</div>
    <div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:6px;">${insurancePills}</div>
    ${phoneLink}${notes}
  </div>`
}

function buildWaterPopup(s: WaterSource): string {
  const color = WATER_TYPE_COLORS[s.type]
  const label = WATER_TYPE_LABELS[s.type]
  return `<div style="min-width:200px;font-family:sans-serif;">
    <p style="font-weight:700;font-size:13px;margin:0 0 4px;">💧 ${s.name}</p>
    <span style="background:${color}22;color:${color};border:1px solid ${color}55;font-size:10px;padding:1px 6px;border-radius:4px;">${label}</span>
    ${s.district ? `<p style="font-size:11px;color:#a1a1aa;margin:6px 0 2px;">${s.district}</p>` : ''}
    ${s.notes ? `<p style="font-size:11px;color:#d4d4d8;margin:2px 0 0;">${s.notes}</p>` : ''}
  </div>`
}

function buildEmergencyPopup(incident: Incident): string {
  const isActive = incident.status === 'ATENDIENDO'
  const color = isActive ? '#dc2626' : '#52525b'
  const date = new Date(incident.dispatched_at).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  })
  return `<div style="min-width:200px;font-family:sans-serif;">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
      <span style="background:${color};color:white;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:bold;">${isActive ? '● EN CURSO' : 'CERRADO'}</span>
    </div>
    <p style="font-weight:700;font-size:13px;margin:0 0 3px;">${incident.type.split('/')[0].trim()}</p>
    <p style="font-size:12px;color:#d4d4d8;margin:0 0 2px;">📍 ${incident.address}</p>
    ${incident.district ? `<p style="font-size:11px;color:#a1a1aa;margin:0 0 4px;">${incident.district}</p>` : ''}
    <p style="font-size:10px;color:#71717a;">${date} · #${incident.nro_parte}</p>
  </div>`
}

// ── Hydrant data — loaded lazily, cached after first load ─────────────────────
type HydrantFeature = { geometry: { coordinates: [number, number] } }
let hydrantsCache: HydrantFeature[] | null = null

async function getHydrants(): Promise<HydrantFeature[]> {
  if (hydrantsCache) return hydrantsCache
  const mod = await import('@/lib/hidrantes-sedapal.json')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hydrantsCache = (mod.default as any).features as HydrantFeature[]
  return hydrantsCache
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MapaEmergencias() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null)
  const hydrantLayerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const facilityLayerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const waterLayerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const userMarkerRef = useRef<import('leaflet').Marker | null>(null)
  const emergencyMarkerRef = useRef<import('leaflet').Marker | null>(null)
  const leafletRef = useRef<typeof import('leaflet') | null>(null)
  const canvasRendererRef = useRef<import('leaflet').Renderer | null>(null)

  const [showHydrants, setShowHydrants] = useState(true)
  const [showFacilities, setShowFacilities] = useState(true)
  const [showWater, setShowWater] = useState(true)
  const [selectedInsurance, setSelectedInsurance] = useState<InsuranceType | null>(null)
  const [hydrantCount, setHydrantCount] = useState(0)
  const [selectedHydrant, setSelectedHydrant] = useState<SelectedHydrant | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('pending')
  const [geoDismissed, setGeoDismissed] = useState(false)
  const [permPermanentDenied, setPermPermanentDenied] = useState(false)
  const [geoRequesting, setGeoRequesting] = useState(false)

  // ── Load hydrants near a point (canvas-rendered, async) ─────────────────
  const loadHydrantsNear = useCallback(async (
    L: typeof import('leaflet'),
    lat: number, lng: number,
    radiusKm: number
  ) => {
    if (!hydrantLayerRef.current) return

    const hydrants = await getHydrants()
    if (!hydrantLayerRef.current) return // might have unmounted while loading

    hydrantLayerRef.current.clearLayers()

    // Shared canvas renderer — one <canvas> for all hydrant markers
    if (!canvasRendererRef.current) {
      canvasRendererRef.current = L.canvas({ padding: 0.5 })
    }
    const renderer = canvasRendererRef.current

    // Bounding box pre-filter (4 comparisons) before expensive Haversine
    const latDelta = radiusKm / 111
    const lonDelta = radiusKm / (111 * Math.cos(Math.abs(lat) * Math.PI / 180))
    const minLat = lat - latDelta, maxLat = lat + latDelta
    const minLon = lng - lonDelta, maxLon = lng + lonDelta

    let count = 0
    hydrants.forEach((h, idx) => {
      const [hLon, hLat] = h.geometry.coordinates
      // Fast bbox check first
      if (hLat < minLat || hLat > maxLat || hLon < minLon || hLon > maxLon) return
      // Precise Haversine only for candidates
      if (distKm(lat, lng, hLat, hLon) > radiusKm) return

      L.circleMarker([hLat, hLon], {
        renderer,
        radius: 6,
        fillColor: '#ef4444',
        fillOpacity: 1,
        color: '#ffffff',
        weight: 1.5,
        interactive: true,
      })
        .on('click', () => setSelectedHydrant({ idx, lat: hLat, lng: hLon }))
        .addTo(hydrantLayerRef.current!)
      count++
    })

    setHydrantCount(count)
  }, [])

  // ── Go to user location ──────────────────────────────────────────────────
  const goToUser = useCallback(() => {
    if (!navigator.geolocation) { setGeoStatus('unavailable'); return }
    setGeoRequesting(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setGeoStatus('granted')
        setGeoRequesting(false)

        const map = mapInstanceRef.current
        const L = leafletRef.current
        if (!map || !L) return

        map.setView([lat, lng], 16)

        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng([lat, lng])
        } else {
          userMarkerRef.current = L.marker([lat, lng], {
            icon: userLocationIcon(L),
            zIndexOffset: 2000,
          }).addTo(map)
        }

        void loadHydrantsNear(L, lat, lng, HYDRANT_RADIUS_KM)
      },
      () => {
        setGeoStatus('denied')
        setGeoRequesting(false)
        const L = leafletRef.current
        if (L) void loadHydrantsNear(L, CENTER[0], CENTER[1], FALLBACK_RADIUS_KM)
      },
      { timeout: 8000, maximumAge: 60000 }
    )
  }, [loadHydrantsNear])

  // ── Init map ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    import('leaflet').then(async L => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      leafletRef.current = L

      const map = L.map(mapRef.current!, {
        center: CENTER,
        zoom: ZOOM,
        zoomControl: true,
        attributionControl: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)

      hydrantLayerRef.current = L.layerGroup().addTo(map)
      facilityLayerRef.current = L.layerGroup().addTo(map)
      waterLayerRef.current = L.layerGroup().addTo(map)
      mapInstanceRef.current = map

      // Facilities
      FACILITIES.forEach(f => {
        L.marker([f.lat, f.lng], { icon: facilityIcon(L, f) })
          .bindPopup(buildFacilityPopup(f), { maxWidth: 280 })
          .addTo(facilityLayerRef.current!)
      })

      // Water sources
      WATER_SOURCES.forEach(s => {
        L.marker([s.lat, s.lng], { icon: waterIcon(L, s) })
          .bindPopup(buildWaterPopup(s), { maxWidth: 260 })
          .addTo(waterLayerRef.current!)
      })

      // Latest incident with coordinates
      const { data: latestIncident } = await supabase
        .from('incidents')
        .select('*')
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .order('dispatched_at', { ascending: false })
        .limit(1)
        .single()

      if (latestIncident?.lat && latestIncident?.lng) {
        const inc = latestIncident as Incident
        emergencyMarkerRef.current = L.marker([inc.lat!, inc.lng!], {
          icon: emergencyIcon(L, inc.status === 'ATENDIENDO'),
          zIndexOffset: 1500,
        })
          .bindPopup(buildEmergencyPopup(inc), { maxWidth: 260 })
          .addTo(map)
      }

      // Geolocation
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude: lat, longitude: lng } = pos.coords
            setGeoStatus('granted')
            map.setView([lat, lng], 16)
            userMarkerRef.current = L.marker([lat, lng], {
              icon: userLocationIcon(L),
              zIndexOffset: 2000,
            }).addTo(map)
            void loadHydrantsNear(L, lat, lng, HYDRANT_RADIUS_KM)
          },
          () => {
            setGeoStatus('denied')
            void loadHydrantsNear(L, CENTER[0], CENTER[1], FALLBACK_RADIUS_KM)
          },
          { timeout: 8000, maximumAge: 60000 }
        )
      } else {
        setGeoStatus('unavailable')
        void loadHydrantsNear(L, CENTER[0], CENTER[1], FALLBACK_RADIUS_KM)
      }
    })

    return () => {
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
      leafletRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Monitor permission state (Permissions API) ──────────────────────────
  useEffect(() => {
    if (!navigator.permissions) return
    navigator.permissions.query({ name: 'geolocation' }).then(result => {
      setPermPermanentDenied(result.state === 'denied')
      result.onchange = () => {
        setPermPermanentDenied(result.state === 'denied')
        // Auto-retry if user grants permission from Settings
        if (result.state === 'granted') goToUser()
      }
    }).catch(() => {})
  }, [goToUser])

  // ── Layer toggles ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current || !hydrantLayerRef.current) return
    if (showHydrants) hydrantLayerRef.current.addTo(mapInstanceRef.current)
    else hydrantLayerRef.current.remove()
  }, [showHydrants])

  useEffect(() => {
    if (!mapInstanceRef.current || !waterLayerRef.current) return
    if (showWater) waterLayerRef.current.addTo(mapInstanceRef.current)
    else waterLayerRef.current.remove()
  }, [showWater])

  useEffect(() => {
    if (!mapInstanceRef.current || !facilityLayerRef.current) return
    import('leaflet').then(L => {
      facilityLayerRef.current!.clearLayers()
      if (!showFacilities) return
      const filtered = selectedInsurance
        ? FACILITIES.filter(f => f.insurance.includes(selectedInsurance))
        : FACILITIES
      filtered.forEach(f => {
        L.marker([f.lat, f.lng], { icon: facilityIcon(L, f) })
          .bindPopup(buildFacilityPopup(f), { maxWidth: 280 })
          .addTo(facilityLayerRef.current!)
      })
    })
  }, [showFacilities, selectedInsurance])

  // overlay: solo cuando fue denegado y el usuario no lo cerró todavía
  // Una vez que toca "Permitir" se cierra inmediatamente (geoDismissed=true)
  const showGeoOverlay = geoStatus === 'denied' && !geoDismissed && !geoRequesting
  const showGeoBanner = geoStatus === 'denied' && (geoDismissed || geoRequesting)

  return (
    <>
      {/* CSS animations for map markers */}
      <style>{`
        @keyframes b100-user-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(59,130,246,0.7); }
          70%  { box-shadow: 0 0 0 16px rgba(59,130,246,0); }
          100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
        }
        .b100-user-location {
          width: 20px; height: 20px;
          background: #3b82f6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5);
          animation: b100-user-pulse 2s ease-out infinite;
        }
        @keyframes b100-emergency-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 3px 10px rgba(220,38,38,0.5); }
          50%       { transform: scale(1.12); box-shadow: 0 4px 16px rgba(220,38,38,0.8); }
        }
        .b100-emergency-active {
          animation: b100-emergency-pulse 1.8s ease-in-out infinite;
        }
        .b100-emergency-closed {
          opacity: 0.75;
        }
      `}</style>

      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

      <div className="flex flex-col h-full">
        {/* Controls */}
        <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 space-y-2 shrink-0">
          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={() => setShowHydrants(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                showHydrants ? 'bg-red-700 text-white' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              🔴 Hidrantes ({hydrantCount})
            </button>
            <button
              onClick={() => setShowFacilities(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                showFacilities ? 'bg-purple-700 text-white' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              🏥 Médicos
            </button>
            <button
              onClick={() => setShowWater(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                showWater ? 'bg-cyan-700 text-white' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              💧 Agua
            </button>

            {/* GPS button */}
            <button
              onClick={goToUser}
              disabled={geoRequesting}
              className={`ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                geoStatus === 'granted'
                  ? 'bg-blue-700 text-white border-blue-500'
                  : geoRequesting
                  ? 'bg-zinc-800 text-zinc-400 border-zinc-700 animate-pulse'
                  : geoStatus === 'denied'
                  ? 'bg-yellow-700/60 text-yellow-300 border-yellow-600'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 animate-pulse'
              }`}
            >
              📍 {geoStatus === 'granted' ? `${HYDRANT_RADIUS_KM} km` : geoRequesting ? '…' : geoStatus === 'denied' ? 'Activar' : '…'}
            </button>

            <button
              onClick={() => { setEditMode(v => !v); setSelectedHydrant(null) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                editMode ? 'bg-orange-700 text-white border-orange-500' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}
            >
              ✏️ {editMode ? 'Edición ON' : 'Editar'}
            </button>
          </div>

          {/* Persistent GPS denied banner — always visible, can't be dismissed */}
          {showGeoBanner && (
            <button
              onClick={() => { if (!geoRequesting) setGeoDismissed(false) }}
              disabled={geoRequesting}
              className="w-full flex items-center gap-2 bg-yellow-900/50 border border-yellow-700/60 rounded-lg px-3 py-2 text-left"
            >
              <span className="text-base shrink-0">{geoRequesting ? '⏳' : '📍'}</span>
              <span className="flex-1 text-yellow-300 text-xs leading-tight">
                {geoRequesting
                  ? 'Solicitando ubicación...'
                  : permPermanentDenied
                  ? 'Ubicación bloqueada — tocá para activarla'
                  : 'Ubicación desactivada — los hidrantes pueden no ser de tu zona'}
              </span>
              {!geoRequesting && <span className="text-yellow-500 text-xs font-bold shrink-0">Activar →</span>}
            </button>
          )}

          {/* Insurance filter */}
          {showFacilities && (
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setSelectedInsurance(null)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                  selectedInsurance === null ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                Todos
              </button>
              {(Object.keys(INSURANCE_LABELS) as InsuranceType[]).map(ins => (
                <button
                  key={ins}
                  onClick={() => setSelectedInsurance(selectedInsurance === ins ? null : ins)}
                  style={selectedInsurance === ins ? { background: INSURANCE_COLORS[ins], color: 'white' } : {}}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    selectedInsurance === ins ? '' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {ins}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Map + geo overlay */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="absolute inset-0" />

          {/* GPS permission overlay */}
          {showGeoOverlay && (
            <div className="absolute inset-0 z-[1000] flex items-end justify-center pb-10 px-4"
              style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)' }}>
              <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
                <div className="text-5xl mb-4">📍</div>
                <h3 className="text-white font-bold text-base mb-2">Activar ubicación</h3>
                <p className="text-zinc-400 text-sm mb-5 leading-relaxed">
                  Para ver los hidrantes y recursos de emergencia de tu zona, la app necesita acceso a tu ubicación.
                </p>

                <button
                  onClick={() => { setGeoDismissed(true); goToUser() }}
                  className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-3.5 rounded-xl mb-3 text-sm transition-colors"
                >
                  📍 Permitir ubicación
                </button>
                {permPermanentDenied && (
                  <p className="text-zinc-500 text-xs mb-3">
                    Si no funciona, tocá el candado 🔒 en la barra del navegador y activá la ubicación.
                  </p>
                )}

                <button
                  onClick={() => setGeoDismissed(true)}
                  className="text-zinc-500 text-xs underline"
                >
                  Continuar sin GPS
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hydrant panels */}
      {selectedHydrant && !editMode && (
        <HydrantQuickView
          hydrantIdx={selectedHydrant.idx}
          lat={selectedHydrant.lat}
          lng={selectedHydrant.lng}
          onClose={() => setSelectedHydrant(null)}
          onEditMode={() => setEditMode(true)}
        />
      )}
      {selectedHydrant && editMode && (
        <HydrantPanel
          hydrantIdx={selectedHydrant.idx}
          lat={selectedHydrant.lat}
          lng={selectedHydrant.lng}
          onClose={() => { setSelectedHydrant(null); setEditMode(false) }}
        />
      )}
    </>
  )
}
