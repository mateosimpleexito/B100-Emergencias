import webpush from 'web-push'
import type { Incident } from '@/types'

function initWebPush() {
  webpush.setVapidDetails(
    'mailto:' + process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
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
  const type = incident.type.split('/')[0].trim()

  return {
    title: `🚨 ${type} — B100`,
    body: `${incident.address}${incident.district ? `, ${incident.district}` : ''}\n${unitList}`,
    url: `/incidents/${incident.nro_parte}`,
    tag: incident.nro_parte,
    icon: '/icons/icon-192.png',
  }
}

export async function sendPushToSubscription(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
) {
  initWebPush()
  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    JSON.stringify(payload),
    { TTL: 60 }
  )
}
