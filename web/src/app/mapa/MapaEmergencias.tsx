'use client'

import { useEffect, useRef, useState } from 'react'
import {
  FACILITIES,
  FACILITY_COLORS,
  INSURANCE_COLORS,
  INSURANCE_LABELS,
  type InsuranceType,
  type MedicalFacility,
} from '@/lib/emergency-map-data'
import HIDRANTES_SEDAPAL from '@/lib/hidrantes-sedapal.json'

// Lima center
const CENTER: [number, number] = [-12.0964, -77.0428]
const ZOOM = 13

interface Hydrant {
  lon: number
  lat: number
}

function facilityIcon(L: typeof import('leaflet'), f: MedicalFacility) {
  const color = FACILITY_COLORS[f.type]
  const emoji = f.type === 'hospital_publico' || f.type === 'hospital_essalud' ? '🏥' : '🏨'
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${color};
      border:2px solid white;
      border-radius:8px;
      width:32px;height:32px;
      display:flex;align-items:center;justify-content:center;
      font-size:16px;
      box-shadow:0 2px 6px rgba(0,0,0,0.5);
    ">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  })
}

function hydrantIcon(L: typeof import('leaflet')) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:#dc2626;
      border:2px solid white;
      border-radius:50%;
      width:14px;height:14px;
      box-shadow:0 1px 4px rgba(0,0,0,0.6);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

function buildPopup(f: MedicalFacility): string {
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
  const notes = f.notes
    ? `<p style="font-size:11px;color:#a1a1aa;margin:4px 0 0;">${f.notes}</p>`
    : ''

  return `
    <div style="min-width:220px;font-family:sans-serif;">
      <p style="font-weight:700;font-size:14px;margin:0 0 4px;">${f.name}</p>
      <p style="font-size:11px;color:#a1a1aa;margin:0 0 6px;">${f.address}</p>
      <div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:6px;">
        ${traumaBadge}${pedBadge}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:6px;">
        ${insurancePills}
      </div>
      ${phoneLink}
      ${notes}
    </div>
  `
}

export default function MapaEmergencias() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null)
  const hydrantLayerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const facilityLayerRef = useRef<import('leaflet').LayerGroup | null>(null)

  const [showHydrants, setShowHydrants] = useState(true)
  const [showFacilities, setShowFacilities] = useState(true)
  const [selectedInsurance, setSelectedInsurance] = useState<InsuranceType | null>(null)
  const [loadingHydrants, setLoadingHydrants] = useState(true)
  const [hydrantCount, setHydrantCount] = useState(0)

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    import('leaflet').then(L => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl

      const map = L.map(mapRef.current!, {
        center: CENTER,
        zoom: ZOOM,
        zoomControl: true,
        attributionControl: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map)

      hydrantLayerRef.current = L.layerGroup().addTo(map)
      facilityLayerRef.current = L.layerGroup().addTo(map)
      mapInstanceRef.current = map

      // Load hydrants from SEDAPAL data (static, no API call needed)
      const icon = hydrantIcon(L)
      const hydrants = HIDRANTES_SEDAPAL.features as unknown as { geometry: { coordinates: [number, number] } }[]
      hydrants.forEach(h => {
        const [lon, lat] = h.geometry.coordinates
        L.marker([lat, lon], { icon })
          .bindPopup('<b>🔴 Hidrante SEDAPAL</b>')
          .addTo(hydrantLayerRef.current!)
      })
      setHydrantCount(hydrants.length)
      setLoadingHydrants(false)

      // Load facilities
      FACILITIES.forEach(f => {
        L.marker([f.lat, f.lng], { icon: facilityIcon(L, f) })
          .bindPopup(buildPopup(f), { maxWidth: 280 })
          .addTo(facilityLayerRef.current!)
      })
    })

    return () => {
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
    }
  }, [])

  // Toggle hydrants layer
  useEffect(() => {
    if (!mapInstanceRef.current || !hydrantLayerRef.current) return
    if (showHydrants) {
      hydrantLayerRef.current.addTo(mapInstanceRef.current)
    } else {
      hydrantLayerRef.current.remove()
    }
  }, [showHydrants])

  // Toggle / filter facilities layer
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
          .bindPopup(buildPopup(f), { maxWidth: 280 })
          .addTo(facilityLayerRef.current!)
      })
    })
  }, [showFacilities, selectedInsurance])

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

      <div className="flex flex-col h-full">
        {/* Controls */}
        <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 space-y-2 shrink-0">
          {/* Layer toggles */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowHydrants(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                showHydrants ? 'bg-red-700 text-white' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              🔴 Hidrantes
              {loadingHydrants
                ? ' …'
                : hydrantCount > 0
                ? ` (${hydrantCount})`
                : ' (sin datos OSM)'}
            </button>
            <button
              onClick={() => setShowFacilities(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                showFacilities ? 'bg-purple-700 text-white' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              🏥 Centros médicos
            </button>
          </div>

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
              {INSURANCE_LABELS.map(ins => (
                <button
                  key={ins}
                  onClick={() => setSelectedInsurance(selectedInsurance === ins ? null : ins)}
                  style={
                    selectedInsurance === ins
                      ? { background: INSURANCE_COLORS[ins], color: 'white' }
                      : {}
                  }
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

        {/* Map */}
        <div ref={mapRef} className="flex-1" />
      </div>
    </>
  )
}
