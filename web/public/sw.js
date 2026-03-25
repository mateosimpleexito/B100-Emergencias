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

  const payload = event.data.json()
  const { title, body, url, tag, icon } = payload

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag,
      data: { url },
      requireInteraction: true,    // stays visible until dismissed
      renotify: true,              // re-alert even if same tag exists
      silent: false,               // force sound on
      vibrate: [300, 100, 300, 100, 300, 100, 600],  // SOS-like pattern
      actions: [
        { action: 'open', title: 'Ver emergencia' },
        { action: 'dismiss', title: 'Cerrar' },
      ],
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
