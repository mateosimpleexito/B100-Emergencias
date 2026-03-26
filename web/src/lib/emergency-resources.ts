// Emergency resources shown on incident detail page.
// Order is operationally driven: what you need to act on FIRST comes first.

import { getDistrictContacts } from '@/lib/district-contacts'

export interface Resource {
  label: string
  detail: string
  phone?: string
  url?: string
  color: 'red' | 'orange' | 'yellow' | 'blue' | 'green' | 'zinc'
}

export interface ResourceGroup {
  title: string
  icon: string
  items: Resource[]
}

function tel(number: string): string {
  return `tel:${number.replace(/[^0-9+]/g, '')}`
}

// ── Recursos fijos ────────────────────────────────────────────────────────────

const CALIDDA: Resource = {
  label: 'Cálidda',
  detail: 'Gas natural — emergencias 24h',
  phone: '0800-10-110',
  url: tel('08001 0110'),
  color: 'orange',
}
const OSINERGMIN: Resource = {
  label: 'OSINERGMIN',
  detail: 'GLP / electricidad / hidrocarburos',
  phone: '0800-11-022',
  url: tel('08001 1022'),
  color: 'yellow',
}
const ENEL: Resource = {
  label: 'Enel',
  detail: 'Corte electricidad — Lima Norte/Centro',
  phone: '0800-0-0012',
  url: tel('0800 00012'),
  color: 'yellow',
}
const LUZ_DEL_SUR: Resource = {
  label: 'Luz del Sur',
  detail: 'Corte electricidad — Lima Sur',
  phone: '0800-0-0011',
  url: tel('0800 00011'),
  color: 'yellow',
}
const SEDAPAL: Resource = {
  label: 'Sedapal',
  detail: 'Agua potable / presión de hidrantes',
  phone: '0800-1-0900',
  url: tel('0800 10900'),
  color: 'blue',
}
const SAMU: Resource = {
  label: 'SAMU',
  detail: 'Soporte avanzado de vida',
  phone: '106',
  url: tel('106'),
  color: 'red',
}
const PNP_NACIONAL: Resource = {
  label: 'PNP — Emergencias',
  detail: 'Policía Nacional del Perú',
  phone: '105',
  url: tel('105'),
  color: 'blue',
}
const INDECI: Resource = {
  label: 'INDECI',
  detail: 'Defensa Civil nacional',
  phone: '115',
  url: tel('115'),
  color: 'green',
}
const DIGESA: Resource = {
  label: 'DIGESA',
  detail: 'Sustancias peligrosas / salud ambiental',
  phone: '(01) 631-4480',
  url: tel('016314480'),
  color: 'zinc',
}
const HN_REBAGLIATI: Resource = {
  label: 'H. Rebagliati (EsSalud)',
  detail: 'Referencia trauma — Jesús María',
  phone: '(01) 265-4901',
  url: tel('012654901'),
  color: 'red',
}
const HN_CASIMIRO: Resource = {
  label: 'H. Casimiro Ulloa',
  detail: 'Emergencias adultos — Miraflores',
  phone: '(01) 241-2323',
  url: tel('012412323'),
  color: 'red',
}

// ── Security group builder (district-aware) ───────────────────────────────────

function buildSecurityGroup(district: string | null): ResourceGroup {
  const contacts = getDistrictContacts(district)

  if (!contacts) {
    return {
      title: 'Seguridad',
      icon: '🚔',
      items: [PNP_NACIONAL],
    }
  }

  return {
    title: `Seguridad — ${contacts.district}`,
    icon: '🚔',
    items: [
      {
        label: `Serenazgo ${contacts.district}`,
        detail: contacts.serenazgo.whatsapp
          ? `WhatsApp: ${contacts.serenazgo.whatsapp}`
          : 'Servicio municipal 24h',
        phone: contacts.serenazgo.phone,
        url: tel(contacts.serenazgo.phone),
        color: 'green',
      },
      ...contacts.pnp.map(c => ({
        label: c.name,
        detail: `Comisaría — ${contacts.district}`,
        phone: c.phone,
        url: tel(c.phone),
        color: 'blue' as const,
      })),
      PNP_NACIONAL,
    ],
  }
}

// ── Ordered groups por tipo de incidente ─────────────────────────────────────
//
// INCENDIO:          servicios (agua/gas/luz) → seguridad → médico
// MATPEL:            seguridad (evacuar) → técnico (gas/OSINERGMIN) → salud ambiental → médico
// ELÉCTRICO:         técnico (eléctrico) → seguridad
// ACCIDENTE:         médico → PNP tráfico → hospitales referencia
// EMERGENCIA MÉDICA: médico → hospitales → seguridad (solo si violencia)
// RESCATE/DERRUMBE:  defensa civil → seguridad → médico

type TypeEntry = {
  keywords: string[]
  build: (securityGroup: ResourceGroup) => ResourceGroup[]
}

const TYPE_ENTRIES: TypeEntry[] = [
  {
    keywords: ['INCENDIO'],
    build: (sec) => [
      {
        title: 'Servicios públicos',
        icon: '🔧',
        items: [SEDAPAL, CALIDDA, ENEL, LUZ_DEL_SUR],
      },
      sec,
      {
        title: 'Apoyo médico',
        icon: '🚑',
        items: [SAMU],
      },
    ],
  },
  {
    keywords: ['MATPEL', 'MATERIAL PELIGROSO', 'GAS', 'QUIMICO', 'DERRAME', 'FUGA'],
    build: (sec) => [
      sec,
      {
        title: 'Gas y combustibles',
        icon: '🔶',
        items: [CALIDDA, OSINERGMIN],
      },
      {
        title: 'Electricidad',
        icon: '⚡',
        items: [ENEL, LUZ_DEL_SUR],
      },
      {
        title: 'Salud ambiental',
        icon: '☣️',
        items: [DIGESA, SAMU],
      },
    ],
  },
  {
    keywords: ['ELECTRICO', 'ELECTRICIDAD', 'ELECTRICA'],
    build: (sec) => [
      {
        title: 'Electricidad',
        icon: '⚡',
        items: [ENEL, LUZ_DEL_SUR, OSINERGMIN],
      },
      sec,
    ],
  },
  {
    keywords: ['ACCIDENTE', 'VEHICULAR', 'TRANSITO', 'CHOQUE'],
    build: (sec) => [
      {
        title: 'Emergencia médica',
        icon: '🚑',
        items: [SAMU, HN_CASIMIRO, HN_REBAGLIATI],
      },
      {
        title: 'Control de tránsito',
        icon: '🚔',
        items: [
          ...sec.items.filter(i => i.label !== 'Serenazgo ' + sec.title.split('— ')[1]),
        ],
      },
    ],
  },
  {
    keywords: ['MEDICA', 'MEDICO', 'SALUD', 'PARTO', 'PCR', 'CARDIAC'],
    build: () => [
      {
        title: 'Emergencia médica',
        icon: '🏥',
        items: [SAMU, HN_CASIMIRO, HN_REBAGLIATI],
      },
    ],
  },
  {
    keywords: ['RESCATE', 'ATRAPADO', 'DERRUMBE', 'COLAPSO'],
    build: (sec) => [
      {
        title: 'Defensa Civil',
        icon: '🆘',
        items: [INDECI],
      },
      sec,
      {
        title: 'Apoyo médico',
        icon: '🚑',
        items: [SAMU],
      },
    ],
  },
]

// ── Public API ────────────────────────────────────────────────────────────────

export function getResourceGroups(
  incidentType: string,
  district: string | null
): ResourceGroup[] {
  const upper = incidentType.toUpperCase()
  const securityGroup = buildSecurityGroup(district)

  for (const entry of TYPE_ENTRIES) {
    if (entry.keywords.some(k => upper.includes(k))) {
      return entry.build(securityGroup)
    }
  }

  // Tipo desconocido: seguridad primero como mínimo útil
  return [securityGroup]
}
