// Hospitals and clinics in Lima with insurance coverage info
// Focused on districts served by B100: San Isidro, Miraflores, Surquillo,
// Lince, Jesús María, San Borja, Surco, La Molina

export type InsuranceType =
  | 'EsSalud'
  | 'SIS'
  | 'SOAT'
  | 'Rímac'
  | 'Pacífico'
  | 'Mapfre'
  | 'BUPA'
  | 'La Positiva'
  | 'Particular'

export type FacilityType = 'hospital_publico' | 'hospital_essalud' | 'clinica_privada' | 'posta'

export interface MedicalFacility {
  id: string
  name: string
  short: string
  type: FacilityType
  lat: number
  lng: number
  address: string
  district: string
  phone?: string
  insurance: InsuranceType[]
  trauma: boolean      // Sala de trauma / UCI
  pediatria: boolean
  notes?: string
}

export const FACILITIES: MedicalFacility[] = [
  // ── ESSALUD ────────────────────────────────────────────────────────────────
  {
    id: 'rebagliati',
    name: 'Hospital Edgardo Rebagliati Martins',
    short: 'Rebagliati',
    type: 'hospital_essalud',
    lat: -12.0842,
    lng: -77.0497,
    address: 'Av. Rebagliati 490, Jesús María',
    district: 'Jesús María',
    phone: '(01) 265-4901',
    insurance: ['EsSalud'],
    trauma: true,
    pediatria: true,
    notes: 'Hospital de referencia EsSalud Lima — Trauma, UCI, quemados',
  },
  {
    id: 'almenara',
    name: 'Hospital Guillermo Almenara Irigoyen',
    short: 'Almenara',
    type: 'hospital_essalud',
    lat: -12.0595,
    lng: -77.0213,
    address: 'Av. Grau 800, La Victoria',
    district: 'La Victoria',
    phone: '(01) 324-2983',
    insurance: ['EsSalud'],
    trauma: true,
    pediatria: true,
    notes: 'Gran hospital de referencia EsSalud — cirugía compleja',
  },
  {
    id: 'polisanisidro',
    name: 'Policlínico Pablo Bermúdez (EsSalud)',
    short: 'PBC EsSalud',
    type: 'hospital_essalud',
    lat: -12.0882,
    lng: -77.0440,
    address: 'Av. Arenales 1302, Jesús María',
    district: 'Jesús María',
    phone: '(01) 265-6000',
    insurance: ['EsSalud'],
    trauma: false,
    pediatria: false,
  },

  // ── MINSA / SIS ────────────────────────────────────────────────────────────
  {
    id: 'casimiro',
    name: 'Hospital de Emergencias Casimiro Ulloa',
    short: 'Casimiro Ulloa',
    type: 'hospital_publico',
    lat: -12.1277,
    lng: -77.0049,
    address: 'Av. República de Panamá 6355, Miraflores',
    district: 'Miraflores',
    phone: '(01) 241-2323',
    insurance: ['SIS', 'SOAT'],
    trauma: true,
    pediatria: false,
    notes: 'Hospital de emergencias adultos más cercano al centro — acepta todos sin seguro',
  },
  {
    id: 'loayza',
    name: 'Hospital Nacional Arzobispo Loayza',
    short: 'Loayza',
    type: 'hospital_publico',
    lat: -12.0487,
    lng: -77.0407,
    address: 'Av. Alfonso Ugarte 848, Cercado',
    district: 'Cercado de Lima',
    phone: '(01) 619-6900',
    insurance: ['SIS', 'SOAT'],
    trauma: true,
    pediatria: false,
  },
  {
    id: 'dos_de_mayo',
    name: 'Hospital Dos de Mayo',
    short: 'Dos de Mayo',
    type: 'hospital_publico',
    lat: -12.0481,
    lng: -77.0217,
    address: 'Av. Grau cuadra 13, Cercado',
    district: 'Cercado de Lima',
    phone: '(01) 328-0028',
    insurance: ['SIS', 'SOAT'],
    trauma: true,
    pediatria: true,
  },

  // ── CLÍNICAS PRIVADAS ──────────────────────────────────────────────────────
  {
    id: 'anglo',
    name: 'Clínica Anglo Americana',
    short: 'Anglo Americana',
    type: 'clinica_privada',
    lat: -12.0951,
    lng: -77.0463,
    address: 'Av. Alfredo Salazar 350, San Isidro',
    district: 'San Isidro',
    phone: '(01) 616-8900',
    insurance: ['Rímac', 'Pacífico', 'Mapfre', 'BUPA', 'La Positiva', 'SOAT', 'Particular'],
    trauma: true,
    pediatria: true,
    notes: 'UCI adultos y pediátrica — referencia trauma privado San Isidro',
  },
  {
    id: 'ricardo_palma',
    name: 'Clínica Ricardo Palma',
    short: 'Ricardo Palma',
    type: 'clinica_privada',
    lat: -12.0998,
    lng: -77.0380,
    address: 'Av. Javier Prado Este 1066, San Isidro',
    district: 'San Isidro',
    phone: '(01) 224-2224',
    insurance: ['Rímac', 'Pacífico', 'Mapfre', 'BUPA', 'La Positiva', 'SOAT', 'Particular'],
    trauma: true,
    pediatria: true,
  },
  {
    id: 'el_golf',
    name: 'Clínica El Golf',
    short: 'El Golf',
    type: 'clinica_privada',
    lat: -12.1051,
    lng: -77.0284,
    address: 'Av. Aurelio Miro Quesada 1030, San Isidro',
    district: 'San Isidro',
    phone: '(01) 264-3300',
    insurance: ['Rímac', 'Pacífico', 'Mapfre', 'SOAT', 'Particular'],
    trauma: false,
    pediatria: false,
    notes: 'Emergencias adultos — sin UCI propia',
  },
  {
    id: 'internacional',
    name: 'Clínica Internacional',
    short: 'Internacional',
    type: 'clinica_privada',
    lat: -12.0731,
    lng: -77.0441,
    address: 'Av. Garcilazo de la Vega 1420, Centro',
    district: 'Cercado de Lima',
    phone: '(01) 619-6161',
    insurance: ['Rímac', 'Pacífico', 'Mapfre', 'BUPA', 'La Positiva', 'EsSalud', 'SOAT', 'Particular'],
    trauma: true,
    pediatria: true,
  },
  {
    id: 'san_felipe',
    name: 'Clínica San Felipe',
    short: 'San Felipe',
    type: 'clinica_privada',
    lat: -12.0817,
    lng: -77.0513,
    address: 'Av. Gregorio Escobedo 650, Jesús María',
    district: 'Jesús María',
    phone: '(01) 719-7000',
    insurance: ['Rímac', 'Pacífico', 'Mapfre', 'La Positiva', 'SOAT', 'Particular'],
    trauma: true,
    pediatria: true,
  },
  {
    id: 'delgado',
    name: 'Clínica Delgado (AUNA)',
    short: 'Delgado',
    type: 'clinica_privada',
    lat: -12.1257,
    lng: -77.0238,
    address: 'Av. Armendáriz 160, Miraflores',
    district: 'Miraflores',
    phone: '(01) 619-6200',
    insurance: ['Rímac', 'Pacífico', 'Mapfre', 'BUPA', 'SOAT', 'Particular'],
    trauma: true,
    pediatria: true,
  },
  {
    id: 'tezza',
    name: 'Clínica Padre Luis Tezza',
    short: 'Tezza',
    type: 'clinica_privada',
    lat: -12.1469,
    lng: -76.9950,
    address: 'Av. El Polo 570, Santiago de Surco',
    district: 'Santiago de Surco',
    phone: '(01) 313-3000',
    insurance: ['EsSalud', 'Rímac', 'Pacífico', 'Mapfre', 'SOAT', 'Particular'],
    trauma: true,
    pediatria: true,
    notes: 'Convenio EsSalud — acepta asegurados EsSalud en emergencia',
  },
  {
    id: 'javier_prado',
    name: 'Clínica Javier Prado',
    short: 'Javier Prado',
    type: 'clinica_privada',
    lat: -12.0887,
    lng: -77.0099,
    address: 'Av. Javier Prado Este 499, San Isidro',
    district: 'San Isidro',
    phone: '(01) 616-3333',
    insurance: ['Rímac', 'Pacífico', 'Mapfre', 'La Positiva', 'SOAT', 'Particular'],
    trauma: false,
    pediatria: false,
  },
]

export const INSURANCE_COLORS: Record<InsuranceType, string> = {
  EsSalud: '#22c55e',
  SIS: '#3b82f6',
  SOAT: '#eab308',
  Rímac: '#8b5cf6',
  Pacífico: '#06b6d4',
  Mapfre: '#f97316',
  BUPA: '#ec4899',
  'La Positiva': '#14b8a6',
  Particular: '#71717a',
}

export const FACILITY_COLORS: Record<FacilityType, string> = {
  hospital_publico: '#3b82f6',
  hospital_essalud: '#22c55e',
  clinica_privada: '#8b5cf6',
  posta: '#71717a',
}

export const INSURANCE_LABELS: InsuranceType[] = [
  'EsSalud', 'SIS', 'SOAT', 'Rímac', 'Pacífico', 'Mapfre', 'BUPA', 'La Positiva', 'Particular',
]
