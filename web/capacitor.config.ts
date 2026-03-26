import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'pe.b100.emergencias',
  appName: 'B100 Emergencias',
  webDir: 'out',
  // Load directly from Vercel — all server-side features work (TTS, scrape, etc.)
  server: {
    url: 'https://b100-emergencias.vercel.app',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#18181b',
    allowMixedContent: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}

export default config
