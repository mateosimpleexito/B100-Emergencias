'use client'

import { useState, useEffect } from 'react'

export type PushState = 'unsupported' | 'denied' | 'pending' | 'subscribed' | 'unsubscribed' | 'native'

// Detect if running inside the Capacitor native app (Android APK)
function isCapacitorNative(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).Capacitor
}

export function usePushNotifications(userId?: string) {
  const [state, setState] = useState<PushState>('pending')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isCapacitorNative()) {
      // In native app: register FCM via Capacitor push plugin
      initCapacitorPush().then(subscribed => {
        setState(subscribed ? 'native' : 'pending')
      })
      return
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    // Check if already subscribed
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setState(sub ? 'subscribed' : 'unsubscribed')
      })
    })
  }, [])

  // Register Capacitor FCM push — dynamically import to avoid breaking browser builds
  async function initCapacitorPush(): Promise<boolean> {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')

      // Check/request permissions
      let permStatus = await PushNotifications.checkPermissions()
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions()
      }
      if (permStatus.receive !== 'granted') return false

      // Register with FCM
      await PushNotifications.register()

      // Get the FCM token and send it to our backend
      await new Promise<void>((resolve) => {
        PushNotifications.addListener('registration', async (token) => {
          try {
            await fetch('/api/subscribe-fcm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: token.value }),
            })
          } catch { /* ok — will retry next launch */ }
          resolve()
        })
        PushNotifications.addListener('registrationError', () => resolve())
        // Timeout safety
        setTimeout(resolve, 5000)
      })

      // Handle incoming FCM push while app is open — play alarm
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        // App is in foreground — notification.data may contain incident info
        window.dispatchEvent(new CustomEvent('b100-emergency', { detail: notification.data }))
      })

      return true
    } catch {
      return false
    }
  }

  async function subscribe() {
    if (isCapacitorNative()) {
      setLoading(true)
      const ok = await initCapacitorPush()
      setState(ok ? 'native' : 'denied')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState('denied')
        return
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      })

      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), userId }),
      })

      setState('subscribed')
    } catch (err) {
      console.error('Push subscribe error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function unsubscribe() {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setState('unsubscribed')
    } catch (err) {
      console.error('Push unsubscribe error:', err)
    } finally {
      setLoading(false)
    }
  }

  return { state, loading, subscribe, unsubscribe }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}
