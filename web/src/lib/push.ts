import webpush from 'web-push'
import type { Incident } from '@/types'

// Initialize VAPID once at module load
const VAPID_EMAIL = process.env.VAPID_EMAIL
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY

let vapidInitialized = false
function ensureVapid() {
  if (vapidInitialized) return
  if (!VAPID_EMAIL || !VAPID_PUBLIC || !VAPID_PRIVATE) {
    throw new Error('Missing VAPID env vars (VAPID_EMAIL, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)')
  }
  webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC, VAPID_PRIVATE)
  vapidInitialized = true
}

export interface PushPayload {
  title: string
  body: string
  url: string
  tag: string
  icon: string
}

export function buildIncidentPayload(incident: Incident): PushPayload {
  const unitList = incident.units.join(' · ')
  const parts = incident.type.split('/').map((s: string) => s.trim())
  const category = parts[0] // RESCATE, INCENDIO, etc.
  // Detail: most specific parts, title-cased for readability
  const detail = parts.slice(1).map((p: string) => p.charAt(0) + p.slice(1).toLowerCase()).join(' · ')

  return {
    title: `🚨 ${category}${detail ? ` — ${detail}` : ''} — B100`,
    body: `📍 ${incident.address}${incident.district ? `, ${incident.district}` : ''}\n🚒 ${unitList}`,
    url: `/incidents/${incident.nro_parte}`,
    tag: incident.nro_parte,
    icon: '/icons/icon-192.png',
  }
}

// Returns true if sent, false if subscription is expired (should be removed)
export async function sendPushToSubscription(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<{ sent: boolean; expired: boolean }> {
  ensureVapid()
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { TTL: 14400, urgency: 'high' as const } // 4 hours, high priority wakes Android from Doze
    )
    return { sent: true, expired: false }
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode
    // 404 or 410 = subscription expired, should be cleaned up
    if (statusCode === 410 || statusCode === 404) {
      return { sent: false, expired: true }
    }
    return { sent: false, expired: false }
  }
}
