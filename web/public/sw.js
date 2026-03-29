// B100 Service Worker
// Handles push notifications and offline caching

const CACHE_NAME = 'b100-v2'
const OFFLINE_URLS = ['/']

// ─── Install: cache offline pages ───────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ─── Fetch: network-first, fallback to cache ────────────────────────────────
self.addEventListener('fetch', event => {
  // Only cache same-origin navigations
  if (event.request.mode !== 'navigate') return

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request)
        .then(r => r || caches.match('/'))
        .then(r => r || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } }))
    )
  )
})

// ─── Push: show notification with alarm sound ───────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: '🚨 B100 Emergencia', body: event.data.text() || 'Nueva emergencia' }
  }
  const { title, body, url, tag, icon } = payload

  event.waitUntil(
    // Check if app is open — if so, alarm code handles sound
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        const appIsOpen = clients.length > 0

        // Tell open windows to play the selectiva alarm
        clients.forEach(client => {
          client.postMessage({ type: 'EMERGENCY_ALARM', payload })
        })

        // If app is open: silent notification (selectiva handles audio + vibration)
        // If app is closed: notification with sound to wake user up
        return self.registration.showNotification(title, {
          body,
          icon: icon || '/icons/icon-192.png',
          badge: '/icons/badge-72.png',
          tag,
          data: { url },
          requireInteraction: true,
          renotify: true,
          silent: appIsOpen,               // silent only when app handles it
          vibrate: appIsOpen ? undefined : [400, 100, 400, 100, 400, 100, 800],
          actions: [
            { action: 'open', title: 'Ver emergencia' },
            { action: 'dismiss', title: 'Cerrar' },
          ],
        })
      })
  )
})

// ─── Notification click: open incident page ─────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close()

  if (event.action === 'dismiss') return

  const url = event.notification.data?.url || '/'

  const targetUrl = new URL(url, self.location.origin).href

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Focus existing window if open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(c => c.navigate(targetUrl))
        }
      }
      // Otherwise open new window
      return clients.openWindow(targetUrl)
    })
  )
})
