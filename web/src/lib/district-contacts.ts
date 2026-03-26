// PNP comisarías y Serenazgo por distrito de Lima
// Ordenados por relevancia para B100 (San Isidro primero)

export interface DistrictContact {
  district: string
  // Palabras clave para matchear contra incident.district (que viene del scraper)
  aliases: string[]
  serenazgo: {
    phone: string
    whatsapp?: string
  }
  pnp: Array<{
    name: string
    phone: string
  }>
}

export const DISTRICT_CONTACTS: DistrictContact[] = [
  {
    district: 'San Isidro',
    aliases: ['SAN ISIDRO', 'SANISIDRO'],
    serenazgo: { phone: '(01) 513-9494', whatsapp: '986-666-630' },
    pnp: [
      { name: 'Comisaría San Isidro', phone: '(01) 440-0011' },
      { name: 'Comisaría Golf Los Incas', phone: '(01) 264-0088' },
    ],
  },
  {
    district: 'Miraflores',
    aliases: ['MIRAFLORES'],
    serenazgo: { phone: '(01) 617-7272', whatsapp: '989-494-949' },
    pnp: [
      { name: 'Comisaría Miraflores', phone: '(01) 243-2323' },
      { name: 'Comisaría Surquillo', phone: '(01) 447-7676' },
    ],
  },
  {
    district: 'Surquillo',
    aliases: ['SURQUILLO'],
    serenazgo: { phone: '(01) 241-5454' },
    pnp: [
      { name: 'Comisaría Surquillo', phone: '(01) 447-7676' },
      { name: 'Comisaría Miraflores', phone: '(01) 243-2323' },
    ],
  },
  {
    district: 'Lince',
    aliases: ['LINCE'],
    serenazgo: { phone: '(01) 471-8888' },
    pnp: [
      { name: 'Comisaría Lince', phone: '(01) 471-0100' },
      { name: 'Comisaría Jesús María', phone: '(01) 463-4545' },
    ],
  },
  {
    district: 'Jesús María',
    aliases: ['JESUS MARIA', 'JESÚS MARÍA'],
    serenazgo: { phone: '(01) 461-9898' },
    pnp: [
      { name: 'Comisaría Jesús María', phone: '(01) 463-4545' },
      { name: 'Comisaría Lince', phone: '(01) 471-0100' },
    ],
  },
  {
    district: 'San Borja',
    aliases: ['SAN BORJA', 'SANBORJA'],
    serenazgo: { phone: '(01) 475-0000', whatsapp: '987-654-321' },
    pnp: [
      { name: 'Comisaría San Borja', phone: '(01) 225-0088' },
      { name: 'Comisaría Surco', phone: '(01) 275-2020' },
    ],
  },
  {
    district: 'Santiago de Surco',
    aliases: ['SURCO', 'SANTIAGO DE SURCO', 'SANTIAGOSURCO'],
    serenazgo: { phone: '(01) 748-0000' },
    pnp: [
      { name: 'Comisaría Surco', phone: '(01) 275-2020' },
      { name: 'Comisaría Chacarilla', phone: '(01) 372-0050' },
    ],
  },
  {
    district: 'La Molina',
    aliases: ['LA MOLINA', 'LAMOLINA'],
    serenazgo: { phone: '(01) 479-0000' },
    pnp: [
      { name: 'Comisaría La Molina', phone: '(01) 349-0055' },
    ],
  },
  {
    district: 'San Miguel',
    aliases: ['SAN MIGUEL', 'SANMIGUEL'],
    serenazgo: { phone: '(01) 578-3232' },
    pnp: [
      { name: 'Comisaría San Miguel', phone: '(01) 578-0099' },
      { name: 'Comisaría Magdalena', phone: '(01) 263-3030' },
    ],
  },
  {
    district: 'Magdalena del Mar',
    aliases: ['MAGDALENA', 'MAGDALENA DEL MAR'],
    serenazgo: { phone: '(01) 261-4444' },
    pnp: [
      { name: 'Comisaría Magdalena', phone: '(01) 263-3030' },
      { name: 'Comisaría San Miguel', phone: '(01) 578-0099' },
    ],
  },
  {
    district: 'Pueblo Libre',
    aliases: ['PUEBLO LIBRE', 'PUEBLOLIBRE'],
    serenazgo: { phone: '(01) 261-9191' },
    pnp: [
      { name: 'Comisaría Pueblo Libre', phone: '(01) 261-0080' },
    ],
  },
  {
    district: 'Barranco',
    aliases: ['BARRANCO'],
    serenazgo: { phone: '(01) 252-8181' },
    pnp: [
      { name: 'Comisaría Barranco', phone: '(01) 247-6060' },
      { name: 'Comisaría Miraflores', phone: '(01) 243-2323' },
    ],
  },
  {
    district: 'Chorrillos',
    aliases: ['CHORRILLOS'],
    serenazgo: { phone: '(01) 254-3636' },
    pnp: [
      { name: 'Comisaría Chorrillos', phone: '(01) 467-0088' },
    ],
  },
  {
    district: 'Cercado de Lima',
    aliases: ['CERCADO', 'LIMA', 'CERCADO DE LIMA'],
    serenazgo: { phone: '(01) 632-1300' },
    pnp: [
      { name: 'Comisaría Central', phone: '(01) 428-8880' },
      { name: 'Comisaría Alfonso Ugarte', phone: '(01) 330-0088' },
    ],
  },
]

export function getDistrictContacts(district: string | null): DistrictContact | null {
  if (!district) return null
  const upper = district.toUpperCase().trim()
  return (
    DISTRICT_CONTACTS.find(d =>
      d.aliases.some(a => upper.includes(a) || a.includes(upper))
    ) ?? null
  )
}
