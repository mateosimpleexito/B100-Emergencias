// Emergency resources shown on incident detail page based on incident type

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

function phone(number: string): string {
  return `tel:${number.replace(/[^0-9+]/g, '')}`
}

const CALIDDA: Resource = {
  label: 'Cálidda',
  detail: 'Gas natural — emergencias 24h',
  phone: '0800-10-110',
  url: phone('08001 0110'),
  color: 'orange',
}

const OSINERGMIN: Resource = {
  label: 'OSINERGMIN',
  detail: 'GLP / electricidad / hidrocarburos',
  phone: '0800-11-022',
  url: phone('08001 1022'),
  color: 'yellow',
}

const ENEL: Resource = {
  label: 'Enel',
  detail: 'Corte de electricidad — Lima Norte/Centro',
  phone: '0800-0-0012',
  url: phone('0800 00012'),
  color: 'yellow',
}

const LUZ_DEL_SUR: Resource = {
  label: 'Luz del Sur',
  detail: 'Corte de electricidad — Lima Sur',
  phone: '0800-0-0011',
  url: phone('0800 00011'),
  color: 'yellow',
}

const SEDAPAL: Resource = {
  label: 'Sedapal',
  detail: 'Agua potable / hidrantes',
  phone: '0800-1-0900',
  url: phone('0800 10900'),
  color: 'blue',
}

const SAMU: Resource = {
  label: 'SAMU',
  detail: 'Soporte avanzado de vida',
  phone: '106',
  url: phone('106'),
  color: 'red',
}

const PNP: Resource = {
  label: 'PNP',
  detail: 'Policía Nacional del Perú',
  phone: '105',
  url: phone('105'),
  color: 'blue',
}

const INDECI: Resource = {
  label: 'INDECI',
  detail: 'Defensa Civil',
  phone: '115',
  url: phone('115'),
  color: 'green',
}

const DIGESA: Resource = {
  label: 'DIGESA',
  detail: 'Sustancias peligrosas / salud ambiental',
  phone: '(01) 631-4480',
  url: phone('016314480'),
  color: 'zinc',
}

const HN_REBAGLIATI: Resource = {
  label: 'H. Rebagliati (EsSalud)',
  detail: 'Referencia trauma — Jesús María',
  phone: '(01) 265-4901',
  url: phone('012654901'),
  color: 'red',
}

const HN_CASIMIRO: Resource = {
  label: 'H. Casimiro Ulloa',
  detail: 'Emergencias adultos — Miraflores',
  phone: '(01) 241-2323',
  url: phone('012412323'),
  color: 'red',
}

// Map incident type keywords → resource groups
const TYPE_RESOURCES: Array<{
  keywords: string[]
  groups: ResourceGroup[]
}> = [
  {
    keywords: ['MATPEL', 'MATERIAL PELIGROSO', 'GAS', 'QUIMICO', 'DERRAME', 'FUGA'],
    groups: [
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
    keywords: ['INCENDIO'],
    groups: [
      {
        title: 'Servicios públicos',
        icon: '🔧',
        items: [SEDAPAL, CALIDDA, ENEL],
      },
      {
        title: 'Apoyo',
        icon: '🚑',
        items: [SAMU, PNP],
      },
    ],
  },
  {
    keywords: ['ELECTRICO', 'ELECTRICIDAD', 'ELECTRICA'],
    groups: [
      {
        title: 'Electricidad',
        icon: '⚡',
        items: [ENEL, LUZ_DEL_SUR, OSINERGMIN],
      },
    ],
  },
  {
    keywords: ['ACCIDENTE', 'VEHICULAR', 'TRANSITO', 'CHOQUE'],
    groups: [
      {
        title: 'Emergencia médica',
        icon: '🚑',
        items: [SAMU, HN_REBAGLIATI],
      },
      {
        title: 'Autoridades',
        icon: '🚔',
        items: [PNP],
      },
    ],
  },
  {
    keywords: ['MEDICA', 'MEDICO', 'SALUD', 'PARTO', 'PCR', 'CARDIAC'],
    groups: [
      {
        title: 'Emergencia médica',
        icon: '🏥',
        items: [SAMU, HN_CASIMIRO, HN_REBAGLIATI],
      },
    ],
  },
  {
    keywords: ['RESCATE', 'ATRAPADO', 'DERRUMBE', 'COLAPSO'],
    groups: [
      {
        title: 'Apoyo',
        icon: '🆘',
        items: [PNP, INDECI, SAMU],
      },
    ],
  },
]

export function getResourceGroups(incidentType: string): ResourceGroup[] {
  const upper = incidentType.toUpperCase()
  for (const entry of TYPE_RESOURCES) {
    if (entry.keywords.some(k => upper.includes(k))) {
      return entry.groups
    }
  }
  return []
}

// Build a district-aware security group (Serenazgo + PNP comisarías)
// to prepend to the resource panel
import { getDistrictContacts } from '@/lib/district-contacts'

export function getSecurityGroup(district: string | null): ResourceGroup | null {
  const contacts = getDistrictContacts(district)

  const pnpNacional: Resource = {
    label: 'PNP — Emergencias',
    detail: 'Policía Nacional del Perú',
    phone: '105',
    url: phone('105'),
    color: 'blue',
  }

  if (!contacts) {
    return {
      title: 'Seguridad',
      icon: '🚔',
      items: [pnpNacional],
    }
  }

  const items: Resource[] = [
    {
      label: `Serenazgo ${contacts.district}`,
      detail: contacts.serenazgo.whatsapp
        ? `WhatsApp: ${contacts.serenazgo.whatsapp}`
        : 'Servicio municipal 24h',
      phone: contacts.serenazgo.phone,
      url: phone(contacts.serenazgo.phone),
      color: 'green',
    },
    ...contacts.pnp.map(c => ({
      label: c.name,
      detail: `Distrito ${contacts.district}`,
      phone: c.phone,
      url: phone(c.phone),
      color: 'blue' as const,
    })),
    pnpNacional,
  ]

  return {
    title: `Seguridad — ${contacts.district}`,
    icon: '🚔',
    items,
  }
}
