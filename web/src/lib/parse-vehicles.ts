import * as cheerio from 'cheerio'
import type { VehicleEntry, VehicleStatusCode } from '@/types'

const CEEM_URL = 'https://www.bomberosperu.gob.pe/sgo/ceem/SGO_CEEM_CDVehiculos.asp'
const XXIV_CODE = '224000' // XXIV Comandancia Departamental Lima Sur

// Map background colors to status codes
function colorToStatus(bgcolor: string): VehicleStatusCode {
  const color = bgcolor.toUpperCase().trim()
  if (color === '#00CC66') return 'disponible'
  if (color === '#FFFF00') return 'en_emergencia'
  if (color === '#999999') return 'en_taller'
  return 'no_disponible' // #FF0000 or unknown
}

export interface ParsedCompanyRow {
  company: string           // "B-100"
  vehicles: VehicleEntry[]
  pilots: number
  paramedics: number
  personnel: number
}

export function parseCEEMPage(html: string, targetCompany: string): ParsedCompanyRow | null {
  const $ = cheerio.load(html)

  // Find the row for the target company (e.g. "B-100")
  let result: ParsedCompanyRow | null = null

  $('tr').each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length < 4) return

    // First cell contains the company code (e.g. "B-100")
    const firstCell = $(cells[0]).text().trim()
    if (!firstCell.includes(targetCompany)) return

    // Parse vehicles — they are the middle cells with bgcolor attributes
    const vehicles: VehicleEntry[] = []
    cells.each((i, cell) => {
      if (i === 0) return // skip company name cell
      const bg = $(cell).attr('bgcolor')
      const text = $(cell).text().trim()
      if (bg && text && !text.match(/^\d+$/)) {
        // It's a vehicle cell (has color and non-numeric text)
        vehicles.push({
          code: text,
          status: colorToStatus(bg),
        })
      }
    })

    // Last 3 cells are #PI, #PA, #PE (pilots, paramedics, personnel)
    const totalCells = cells.length
    const pilots = parseInt($(cells[totalCells - 3]).text().trim()) || 0
    const paramedics = parseInt($(cells[totalCells - 2]).text().trim()) || 0
    const personnel = parseInt($(cells[totalCells - 1]).text().trim()) || 0

    result = {
      company: targetCompany,
      vehicles,
      pilots,
      paramedics,
      personnel,
    }

    return false // break
  })

  return result
}

export async function fetchCEEMData(): Promise<ParsedCompanyRow | null> {
  const res = await fetch(CEEM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
    },
    body: `cboCD=${XXIV_CODE}`,
  })

  if (!res.ok) return null

  const html = await res.text()
  return parseCEEMPage(html, 'B-100')
}
