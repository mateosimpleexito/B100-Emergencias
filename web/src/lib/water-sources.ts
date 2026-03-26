// Puntos de abastecimiento de agua para camiones cisterna — Lima
// Coordenadas verificadas. Puntos SEDAPAL con dirección de calle:
// fuente oficial → sedapal.maps.arcgis.com (mapa interactivo SEDAPAL)

export type WaterSourceType =
  | 'cistern_fill'   // Grifa de llenado de cisterna SEDAPAL
  | 'natural'        // Fuente natural (laguna, canal, pantano)
  | 'reservoir'      // Reservorio / estanque / piscina grande

export interface WaterSource {
  name: string
  lat: number
  lng: number
  type: WaterSourceType
  district?: string
  notes?: string
}

export const WATER_SOURCES: WaterSource[] = [

  // ── Fuentes naturales (coordenadas verificadas) ───────────────────────────

  {
    name: 'Laguna Parque El Olivar',
    lat: -12.10065,
    lng: -77.03482,
    type: 'natural',
    district: 'San Isidro',
    notes: 'Laguna artificial dentro del bosque de olivos. Acceso peatonal.',
  },
  {
    name: 'Pantanos de Villa',
    lat: -12.1830,
    lng: -77.0250,
    type: 'natural',
    district: 'Chorrillos',
    notes: 'Humedal de 263 ha. Acceso por Av. Huaylas. Gran volumen de agua.',
  },
  {
    name: 'Laguna Parque Ecológico San Borja',
    lat: -12.1017,
    lng: -76.9882,
    type: 'natural',
    district: 'San Borja',
    notes: 'Laguna junto al Pentagonito (Av. San Borja Sur / Av. Boulevard).',
  },
  {
    name: 'Circuito Mágico del Agua',
    lat: -12.0580,
    lng: -77.0332,
    type: 'reservoir',
    district: 'Lima',
    notes: 'Parque de la Reserva. Reservorios grandes. Paseo de la República / Av. Arequipa.',
  },

  // ── Puntos de llenado SEDAPAL — San Isidro ───────────────────────────────
  // Fuente: El Comercio / SEDAPAL. Verificar coordenadas exactas en ArcGIS SEDAPAL.

  {
    name: 'SEDAPAL · Av. Belén cdra. 10 (alt. Av. Pezet)',
    lat: -12.0960,
    lng: -77.0380,
    type: 'cistern_fill',
    district: 'San Isidro',
    notes: 'Grifa de llenado. Confirmar disponibilidad: SEDAPAL 317-8000.',
  },
  {
    name: 'SEDAPAL · Av. Javier Prado / Porras Osores',
    lat: -12.0886,
    lng: -77.0291,
    type: 'cistern_fill',
    district: 'San Isidro',
    notes: 'Grifa de llenado. Confirmar disponibilidad: SEDAPAL 317-8000.',
  },

  // ── Puntos de llenado SEDAPAL — Surco ────────────────────────────────────

  {
    name: 'SEDAPAL · Av. El Polo cdra. 4 (Cayaltí / Pomalca)',
    lat: -12.1108,
    lng: -76.9784,
    type: 'cistern_fill',
    district: 'Santiago de Surco',
    notes: 'Grifa de llenado. Confirmar disponibilidad: SEDAPAL 317-8000.',
  },
  {
    name: 'SEDAPAL · Av. Surco cdra. 3 (Doña Esther / Montesclaros)',
    lat: -12.1390,
    lng: -77.0050,
    type: 'cistern_fill',
    district: 'Santiago de Surco',
    notes: 'Grifa de llenado. Confirmar disponibilidad: SEDAPAL 317-8000.',
  },

  // ── Puntos de llenado SEDAPAL — Chorrillos ───────────────────────────────

  {
    name: 'SEDAPAL · Av. Paseo de la República cdra. 8 (Costa Azul 107)',
    lat: -12.1620,
    lng: -77.0140,
    type: 'cistern_fill',
    district: 'Chorrillos',
    notes: 'Grifa de llenado. Confirmar disponibilidad: SEDAPAL 317-8000.',
  },
  {
    name: 'SEDAPAL · Parque San Judas Tadeo (Av. Huaylas cdra. 11)',
    lat: -12.1820,
    lng: -77.0070,
    type: 'cistern_fill',
    district: 'Chorrillos',
    notes: 'Mellet Vargas / Ochoa. Confirmar disponibilidad: SEDAPAL 317-8000.',
  },

  // ── Puntos de llenado SEDAPAL — Miraflores ───────────────────────────────

  {
    name: 'SEDAPAL · Miraflores (José María Eguren / Wiesse)',
    lat: -12.1195,
    lng: -77.0302,
    type: 'cistern_fill',
    district: 'Miraflores',
    notes: 'Grifa de llenado. Confirmar disponibilidad: SEDAPAL 317-8000.',
  },
]

export const WATER_TYPE_COLORS: Record<WaterSourceType, string> = {
  cistern_fill: '#3b82f6',   // azul — punto operativo SEDAPAL
  natural:      '#06b6d4',   // cyan — fuente natural
  reservoir:    '#8b5cf6',   // violeta — reservorio
}

export const WATER_TYPE_LABELS: Record<WaterSourceType, string> = {
  cistern_fill: 'Llenado cisterna SEDAPAL',
  natural:      'Fuente natural',
  reservoir:    'Reservorio',
}
