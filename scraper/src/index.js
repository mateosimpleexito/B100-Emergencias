/**
 * B100 Scraper Worker
 * Runs 24/7 on Fly.io — polls SGO Norte every 3 seconds.
 * When a new emergency with a B100 unit is detected, calls the
 * Next.js /api/scrape endpoint which handles DB insert + Web Push.
 */

const SGO_URL = 'https://sgonorte.bomberosperu.gob.pe/24horas'
const API_URL = process.env.APP_URL + '/api/scrape'
const VEHICLES_API_URL = process.env.APP_URL + '/api/scrape-vehicles'
const SCRAPER_SECRET = process.env.SCRAPER_SECRET
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? '3000', 10)
const VEHICLES_INTERVAL_MS = 60_000
const FETCH_TIMEOUT_MS = 15_000

const B100_UNITS = ['M100-1', 'RES-100', 'AMB-100', 'AUX-100', 'AUX100-2']

// Track seen nro_partes to avoid redundant API calls
const seenNroParts = new Set()
let initialized = false
let consecutiveErrors = 0
const MAX_BACKOFF_MS = 60_000

function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeout))
}

async function fetchPage() {
  const res = await fetchWithTimeout(SGO_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
      'Accept-Language': 'es-PE,es;q=0.9',
      'Cache-Control': 'no-cache',
    },
  })
  if (!res.ok) throw new Error(`SGO Norte HTTP ${res.status}`)
  return res.text()
}

// Quick check: does the page HTML contain any B100 unit code?
function pageHasB100(html) {
  return B100_UNITS.some(u => html.includes(u))
}

// Extract nro_parte values from the HTML to compare with cache
function extractNroPartes(html) {
  const matches = html.matchAll(/<td[^>]*><span>(\d{10,})<\/span><\/td>/g)
  return [...matches].map(m => m[1])
}

async function callScrapeAPI() {
  const res = await fetchWithTimeout(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-scraper-secret': SCRAPER_SECRET,
    },
  })
  return res.json()
}

async function poll() {
  try {
    const html = await fetchPage()
    consecutiveErrors = 0 // reset backoff on success

    if (!pageHasB100(html)) {
      if (!initialized) {
        initialized = true
        console.log('[B100] Worker initialized — no active B100 incidents at startup')
      }
      return
    }

    // Check if any nro_parte is new (not seen before)
    const nroPartes = extractNroPartes(html)
    const hasNewParts = nroPartes.some(nro => !seenNroParts.has(nro))

    if (!hasNewParts && initialized) {
      // All parts already seen — skip redundant API call
      return
    }

    // New nro_parte detected or first run — call the API
    const result = await callScrapeAPI()

    // Update seen cache
    nroPartes.forEach(nro => seenNroParts.add(nro))

    // Keep cache from growing unbounded — remove old entries if > 500
    if (seenNroParts.size > 500) {
      const entries = [...seenNroParts]
      entries.slice(0, entries.length - 200).forEach(e => seenNroParts.delete(e))
    }

    if (!initialized) {
      initialized = true
      if (result.new > 0 || result.updated > 0) {
        console.log('[B100] Worker initialized — B100 incidents detected at startup')
      } else {
        console.log('[B100] Worker initialized — existing B100 incidents, no changes')
      }
    }

    if (result.new > 0) {
      console.log(`[B100] 🚨 ${result.new} nuevo(s) incidente(s) — notificaciones enviadas`)
    }
    if (result.updated > 0) {
      console.log(`[B100] 🔄 ${result.updated} incidente(s) actualizado(s)`)
    }
  } catch (err) {
    consecutiveErrors++
    console.error('[B100] Poll error:', err.message)
  }
}

async function pollVehicles() {
  try {
    const res = await fetchWithTimeout(VEHICLES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-scraper-secret': SCRAPER_SECRET,
      },
    })
    const data = await res.json()
    if (data.vehicles) {
      console.log(`[B100] 🚒 Vehículos actualizados: ${data.vehicles} unidades, ${data.pilots} pilotos, ${data.personnel} personal`)
    }
  } catch (err) {
    console.error('[B100] Vehicle poll error:', err.message)
  }
}

async function run() {
  console.log(`[B100] Scraper iniciado — incidentes cada ${POLL_INTERVAL_MS}ms, vehículos cada ${VEHICLES_INTERVAL_MS}ms`)
  console.log(`[B100] Monitoreando unidades: ${B100_UNITS.join(', ')}`)
  console.log(`[B100] Fuente: ${SGO_URL}`)

  if (!process.env.APP_URL) throw new Error('APP_URL env var required')
  if (!process.env.SCRAPER_SECRET) throw new Error('SCRAPER_SECRET env var required')

  // Poll immediately, then on interval with backoff
  await poll()
  const pollInterval = setInterval(async () => {
    // Exponential backoff on consecutive errors
    if (consecutiveErrors > 0) {
      const backoff = Math.min(POLL_INTERVAL_MS * Math.pow(2, consecutiveErrors), MAX_BACKOFF_MS)
      await new Promise(r => setTimeout(r, backoff - POLL_INTERVAL_MS))
    }
    await poll()
  }, POLL_INTERVAL_MS)

  await pollVehicles()
  const vehicleInterval = setInterval(pollVehicles, VEHICLES_INTERVAL_MS)

  // Graceful shutdown
  const shutdown = () => {
    console.log('[B100] Shutting down gracefully...')
    clearInterval(pollInterval)
    clearInterval(vehicleInterval)
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

run().catch(err => {
  console.error('[B100] Fatal:', err)
  process.exit(1)
})
