/**
 * B100 Scraper Worker
 * Runs 24/7 on Fly.io — polls SGO Norte every 3 seconds.
 * When a new emergency with a B100 unit is detected, calls the
 * Next.js /api/scrape endpoint which handles DB insert + Web Push.
 */

const SGO_URL = 'https://sgonorte.bomberosperu.gob.pe/24horas'
const API_URL = process.env.APP_URL + '/api/scrape'
const SCRAPER_SECRET = process.env.SCRAPER_SECRET
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? '3000', 10)

const B100_UNITS = ['M100-1', 'RES-100', 'AMB-100', 'AUX-100-1', 'AUX-100-2']

// Track last seen nro_partes to detect new ones without hitting the DB
const seenNroParts = new Set()
let initialized = false

async function fetchPage() {
  const res = await fetch(SGO_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
      'Accept-Language': 'es-PE,es;q=0.9',
      'Cache-Control': 'no-cache',
    },
  })
  if (!res.ok) throw new Error(`SGO Norte HTTP ${res.status}`)
  return res.text()
}

function hasB100Unit(unitsText) {
  return B100_UNITS.some(u => unitsText.includes(u))
}

// Quick check: does the page HTML contain any B100 unit code?
// If not, skip the full API call to save resources.
function pageHasB100(html) {
  return B100_UNITS.some(u => html.includes(u))
}

async function callScrapeAPI() {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-scraper-secret': SCRAPER_SECRET,
    },
  })
  const data = await res.json()
  return data
}

async function poll() {
  try {
    const html = await fetchPage()

    // Fast path: if no B100 unit codes appear in the HTML, skip
    if (!pageHasB100(html)) {
      if (!initialized) {
        initialized = true
        console.log('[B100] Worker initialized — no active B100 incidents at startup')
      }
      return
    }

    // There are B100 units in the page — call the API to handle parsing + push
    const result = await callScrapeAPI()

    if (!initialized) {
      initialized = true
      console.log('[B100] Worker initialized — B100 incidents detected at startup')
    }

    if (result.new > 0) {
      console.log(`[B100] 🚨 ${result.new} nuevo(s) incidente(s) — notificaciones enviadas`)
    }
    if (result.updated > 0) {
      console.log(`[B100] 🔄 ${result.updated} incidente(s) actualizado(s)`)
    }

  } catch (err) {
    console.error('[B100] Poll error:', err.message)
  }
}

async function run() {
  console.log(`[B100] Scraper iniciado — polling cada ${POLL_INTERVAL_MS}ms`)
  console.log(`[B100] Monitoreando unidades: ${B100_UNITS.join(', ')}`)
  console.log(`[B100] Fuente: ${SGO_URL}`)

  // Validate config
  if (!process.env.APP_URL) throw new Error('APP_URL env var required')
  if (!process.env.SCRAPER_SECRET) throw new Error('SCRAPER_SECRET env var required')

  // Poll immediately, then on interval
  await poll()
  setInterval(poll, POLL_INTERVAL_MS)
}

run().catch(err => {
  console.error('[B100] Fatal:', err)
  process.exit(1)
})
