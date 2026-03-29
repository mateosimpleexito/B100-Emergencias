export type IncidentStatus = 'ATENDIENDO' | 'CERRADO'

export interface Incident {
  id: string
  nro_parte: string
  type: string
  address: string
  district: string | null
  lat: number | null
  lng: number | null
  status: IncidentStatus
  dispatched_at: string
  units: string[]
  created_at: string
  updated_at: string
}

export interface PushSubscription {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  active: boolean
  created_at: string
}

export interface Profile {
  id: string
  full_name: string
  badge: string | null
  role: 'bombero' | 'admin'
  is_active: boolean
}

// B100 unit codes — known exact codes for display
export const B100_UNITS = ['M100-1', 'RES-100', 'AMB-100', 'AUX-100', 'AUX100-2'] as const

export type B100Unit = typeof B100_UNITS[number]

// Pattern-based detection: catches any unit from compañía 100
// Matches: M100-1, M-100, RES-100, RES100, AMB-100, AMB100-1, AUX100-2, MED-100, RESLIG-100, etc.
const B100_PATTERN = /^(M|MAQ|RES|RESC|RESLIG|AMB|AUX|MED|BOMB)[-]?100/i

export function isB100Unit(code: string): boolean {
  return B100_PATTERN.test(code) || (B100_UNITS as readonly string[]).includes(code)
}

// Readable unit names for alerts and UI
export const UNIT_NAMES: Record<string, string> = {
  'M100-1': 'MÁQUINA 100-1',
  'RES-100': 'RESCATE 100',
  'AMB-100': 'AMBULANCIA 100',
  'AUX-100': 'AUXILIAR 100-1',
  'AUX100-2': 'AUXILIAR 100-2',
}

export function unitName(code: string): string {
  return UNIT_NAMES[code] || code
}

// Short alert phrase from SGO type string
// "INCENDIO / ESTRUCTURAS / VIVIENDA / MATERIAL NOBLE" → "INCENDIO ESTRUCTURA"
export function alertPhrase(type: string): string {
  const raw = type.toUpperCase()

  // INCENDIO
  if (raw.includes('ESTRUCTURAS')) return 'INCENDIO ESTRUCTURA'
  if (raw.includes('FORESTAL')) return 'INCENDIO FORESTAL'
  if (raw.includes('VEHICULO') && raw.includes('INCENDIO')) return 'INCENDIO VEHICULAR'
  if (raw.includes('ELECTRICOS') || raw.includes('TRANSFORMADOR') || raw.includes('POSTES')) return 'INCENDIO ELÉCTRICO'
  if (raw.includes('TERRENO BALDIO')) return 'INCENDIO TERRENO'
  if (raw.startsWith('INCENDIO')) return 'INCENDIO'

  // RESCATE
  if (raw.includes('ASCENSOR')) return 'ATRAPADO EN ASCENSOR'
  if (raw.includes('ACANTILADO')) return 'RESCATE ACANTILADO'
  if (raw.includes('PERSONAS ATRAPADAS')) return 'RESCATE ATRAPADOS'
  if (raw.includes('ANIMALES') || raw.includes('ANIMAL')) return 'RESCATE ANIMAL'
  if (raw.startsWith('RESCATE')) return 'RESCATE'

  // ACCIDENTE
  if (raw.includes('MOTO')) return 'ACCIDENTE MOTO'
  if (raw.includes('ACCIDENTE VEHICULAR')) return 'ACCIDENTE VEHICULAR'

  // MATPEL
  if (raw.includes('GAS GLP') || raw.includes('GASES INFLAM')) return 'FUGA DE GAS'
  if (raw.includes('MATERIALES PELIGROSOS')) return 'MATPEL'

  // EMERGENCIA MÉDICA
  if (raw.includes('HERIDO POR CAIDA')) return 'HERIDO POR CAÍDA'
  if (raw.includes('ATROPELLO')) return 'HERIDO POR ATROPELLO'
  if (raw.includes('ARMA DE FUEGO')) return 'HERIDO BALA'
  if (raw.includes('PARO CARDIACO')) return 'PARO CARDÍACO'
  if (raw.includes('EMBARAZO') || raw.includes('PARTO')) return 'EMERGENCIA PARTO'
  if (raw.includes('INCONSCIENTE') || raw.includes('DESMAYO')) return 'INCONSCIENTE'
  if (raw.includes('QUEMADURA')) return 'QUEMADO'
  if (raw.includes('DIFICULTAD RESPIRATORIA')) return 'DIFICULTAD RESPIRATORIA'
  if (raw.includes('CONVULSIONES')) return 'CONVULSIONES'
  if (raw.includes('DERRAME') || raw.includes('ACV')) return 'ACV'
  if (raw.includes('ENVENENAMIENTO') || raw.includes('SOBREDOSIS')) return 'INTOXICACIÓN'
  if (raw.includes('EMERGENCIA MEDICA')) return 'EMERGENCIA MÉDICA'

  // SERVICIO ESPECIAL
  if (raw.includes('SERVICIO ESPECIAL')) return 'SERVICIO ESPECIAL'

  // Fallback: first part
  return type.split('/')[0].trim()
}

// Vehicle status from SGO CEEM
export type VehicleStatusCode = 'disponible' | 'no_disponible' | 'en_emergencia' | 'en_taller'

export interface VehicleEntry {
  code: string           // "M100-1", "RES-100", etc.
  status: VehicleStatusCode
}

export interface CompanyStatus {
  id: string             // "B-100"
  vehicles: VehicleEntry[]
  pilots: number
  paramedics: number
  personnel: number
  updated_at: string
}
