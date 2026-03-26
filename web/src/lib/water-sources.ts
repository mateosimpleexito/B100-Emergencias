// Puntos de abastecimiento de agua para camiones cisterna
// Fuentes: SEDAPAL, Serenazgo, reconocimiento operativo
// Agregar nuevos puntos verificados con: { name, lat, lng, type, notes? }

export type WaterSourceType =
  | 'cistern_fill'   // Punto de llenado de cisterna SEDAPAL
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
  // ── San Isidro ────────────────────────────────────────────────────────────
  {
    name: 'Laguna Parque El Olivar',
    lat: -12.0937,
    lng: -77.0389,
    type: 'natural',
    district: 'San Isidro',
    notes: 'Laguna artificial en el bosque de olivos. Acceso por Av. La República.',
  },
  {
    name: 'Punto de llenado SEDAPAL — San Isidro',
    lat: -12.0912,
    lng: -77.0328,
    type: 'cistern_fill',
    district: 'San Isidro',
    notes: 'Grifa de llenado de cisternas. Verificar horario con SEDAPAL.',
  },

  // ── Miraflores ────────────────────────────────────────────────────────────
  {
    name: 'Punto de llenado SEDAPAL — Miraflores',
    lat: -12.1191,
    lng: -77.0282,
    type: 'cistern_fill',
    district: 'Miraflores',
    notes: 'Grifa de llenado de cisternas. Verificar horario con SEDAPAL.',
  },

  // ── San Borja ─────────────────────────────────────────────────────────────
  {
    name: 'Lagunas Parque Ecológico — San Borja',
    lat: -12.0922,
    lng: -76.9996,
    type: 'natural',
    district: 'San Borja',
    notes: 'Espejo de agua en el parque ecológico distrital.',
  },

  // ── Lima Centro ───────────────────────────────────────────────────────────
  {
    name: 'Circuito Mágico del Agua',
    lat: -12.0719,
    lng: -77.0355,
    type: 'natural',
    district: 'Lima',
    notes: 'Reservorios del parque. Referencia para cisterna en zona centro.',
  },

  // ── Chorrillos ────────────────────────────────────────────────────────────
  {
    name: 'Pantanos de Villa',
    lat: -12.2153,
    lng: -76.9832,
    type: 'natural',
    district: 'Chorrillos',
    notes: 'Humedal costero con gran volumen de agua. Acceso por Av. Huaylas.',
  },
  {
    name: 'Punto de llenado SEDAPAL — Chorrillos',
    lat: -12.1731,
    lng: -77.0147,
    type: 'cistern_fill',
    district: 'Chorrillos',
    notes: 'Grifa de llenado. Confirmar disponibilidad con SEDAPAL 317-8000.',
  },

  // ── Surco ─────────────────────────────────────────────────────────────────
  {
    name: 'Punto de llenado SEDAPAL — Surco',
    lat: -12.1258,
    lng: -76.9936,
    type: 'cistern_fill',
    district: 'Santiago de Surco',
    notes: 'Grifa de llenado de cisternas.',
  },

  // ── Lince / Jesús María ──────────────────────────────────────────────────
  {
    name: 'Punto de llenado SEDAPAL — Lince',
    lat: -12.0817,
    lng: -77.0348,
    type: 'cistern_fill',
    district: 'Lince',
    notes: 'Grifa de llenado. Verificar con SEDAPAL 317-8000.',
  },
]

export const WATER_TYPE_COLORS: Record<WaterSourceType, string> = {
  cistern_fill: '#3b82f6',   // azul — punto operativo
  natural:      '#06b6d4',   // cyan — fuente natural
  reservoir:    '#8b5cf6',   // violeta — reservorio
}

export const WATER_TYPE_LABELS: Record<WaterSourceType, string> = {
  cistern_fill: 'Llenado cisterna',
  natural:      'Fuente natural',
  reservoir:    'Reservorio',
}
