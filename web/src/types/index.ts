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

// B100 unit codes monitored for dispatch alerts
export const B100_UNITS = ['M100-1', 'RES-100', 'AMB-100', 'AUX-100-1', 'AUX-100-2'] as const

export type B100Unit = typeof B100_UNITS[number]

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
