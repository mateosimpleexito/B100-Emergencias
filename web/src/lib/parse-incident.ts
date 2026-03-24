import * as cheerio from 'cheerio'
import type { Incident } from '@/types'
import { B100_UNITS } from '@/types'

// Extract GPS coordinates embedded in the address string
// e.g. "AV. SIMON BOLIVAR (-12.2232,-76.9479) - VILLA EL SALVADOR"
export function extractCoords(address: string): { lat: number | null; lng: number | null } {
  const match = address.match(/\((-?\d+\.\d+),\s*(-?\d+\.\d+)\)/)
  if (!match) return { lat: null, lng: null }
  return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) }
}

// Clean address removing the coordinate block
export function cleanAddress(address: string): string {
  return address.replace(/\(-?\d+\.\d+,\s*-?\d+\.\d+\)/, '').replace(/\s+/g, ' ').trim()
}

// Parse a dispatched_at string like "18/03/2026 11:03:12 p.m." to ISO
export function parseDate(raw: string): string {
  // "18/03/2026 11:03:12 p.m." → Date
  const cleaned = raw.trim().replace('p.m.', 'PM').replace('a.m.', 'AM')
  const match = cleaned.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)/i)
  if (!match) return new Date().toISOString()
  const [, day, month, year, hour, min, sec, ampm] = match
  let h = parseInt(hour)
  if (ampm.toUpperCase() === 'PM' && h < 12) h += 12
  if (ampm.toUpperCase() === 'AM' && h === 12) h = 0
  return new Date(
    parseInt(year), parseInt(month) - 1, parseInt(day), h, parseInt(min), parseInt(sec)
  ).toISOString()
}

export interface ParsedRow {
  nro_parte: string
  type: string
  address: string
  district: string | null
  lat: number | null
  lng: number | null
  status: 'ATENDIENDO' | 'CERRADO'
  dispatched_at: string
  units: string[]
}

export function parseIncidentsPage(html: string): ParsedRow[] {
  const $ = cheerio.load(html)
  const rows: ParsedRow[] = []

  // Find the incidents table rows (skip header)
  $('table tbody tr').each((_, el) => {
    const cells = $(el).find('td')
    if (cells.length < 7) return

    const nro_parte = $(cells[1]).text().trim()
    const rawDate = $(cells[2]).text().trim()
    const rawAddress = $(cells[3]).text().trim()
    const type = $(cells[4]).text().trim()
    const statusText = $(cells[5]).text().trim().toUpperCase()
    const status: 'ATENDIENDO' | 'CERRADO' = statusText.includes('CERRADO') ? 'CERRADO' : 'ATENDIENDO'

    // Units are rendered as chips/badges inside the cell
    const unitsCell = $(cells[6])
    const units: string[] = []
    unitsCell.find('*').each((_, chip) => {
      const text = $(chip).text().trim()
      if (text) units.push(text)
    })
    // Fallback: plain text split
    if (units.length === 0) {
      const rawUnits = unitsCell.text().trim()
      rawUnits.split(/[\s,]+/).filter(Boolean).forEach(u => units.push(u))
    }

    if (!nro_parte) return

    // Extract coords and clean address
    const { lat, lng } = extractCoords(rawAddress)
    const addressLine = cleanAddress(rawAddress)

    // Extract district (text after last " - ")
    const districtMatch = rawAddress.match(/-\s*([A-Z\s]+)$/)
    const district = districtMatch ? districtMatch[1].trim() : null

    rows.push({
      nro_parte,
      type,
      address: addressLine,
      district,
      lat,
      lng,
      status,
      dispatched_at: parseDate(rawDate),
      units,
    })
  })

  return rows
}

// Returns only rows that involve at least one B100 unit
export function filterB100Rows(rows: ParsedRow[]): ParsedRow[] {
  return rows.filter(row =>
    row.units.some(u => (B100_UNITS as readonly string[]).includes(u))
  )
}
