import webpush from 'web-push'
import type { Incident } from '@/types'
import { B100_UNITS, unitName, alertPhrase } from '@/types'

// ─── Firebase Admin (FCM) ────────────────────────────────────────────────────
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

function getFirebaseApp() {
  if (getApps().length > 0) return getApps()[0]
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!serviceAccount) return null
  return initializeApp({ credential: cert(JSON.parse(serviceAccount)) })
}

export async function sendFCMToToken(
  token: string,
  payload: PushPayload
): Promise<{ sent: boolean; expired: boolean }> {
  try {
    const app = getFirebaseApp()
    if (!app) return { sent: false, expired: false }

    await getMessaging(app).send({
      token,
      notification: { title: payload.title, body: payload.body },
      android: {
        priority: 'high',
        notification: {
          channelId: 'b100_emergency',   // matches MainActivity channel
          sound: 'siren',                // res/raw/siren.mp3 (fallback when app closed)
        },
      },
      data: { url: payload.url, tag: payload.tag },
    })
    return { sent: true, expired: false }
  } catch (err: unknown) {
    const code = (err as { code?: string }).code
    if (code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token') {
      return { sent: false, expired: true }
    }
    return { sent: false, expired: false }
  }
}

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
  const alert = alertPhrase(incident.type)
  const unitNames = incident.units.map(u => unitName(u))
  const b100Units = unitNames.filter((_, i) =>
    (B100_UNITS as readonly string[]).includes(incident.units[i])
  )

  return {
    title: `🚨 ${alert}`,
    body: `🚒 ${b100Units.join(' | ')}\n📍 ${incident.address}${incident.district ? `, ${incident.district}` : ''}`,
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
