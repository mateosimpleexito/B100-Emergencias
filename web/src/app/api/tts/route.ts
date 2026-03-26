import { NextRequest, NextResponse } from 'next/server'

const MAX_TEXT_LENGTH = 500

// Cache access token in module scope — valid 1h, reused across warm instances
let cachedToken: { value: string; expiresAt: number } | null = null

export async function GET(req: NextRequest) {
  const text = req.nextUrl.searchParams.get('text')
  if (!text || text.length === 0) {
    return NextResponse.json({ error: 'Missing text parameter' }, { status: 400 })
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: 'Text too long' }, { status: 400 })
  }

  try {
    const audioBuffer = await googleCloudTTS(text)
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (err) {
    console.error('TTS generation failed:', err)
    // Fallback to Google Translate TTS
    try {
      const audioBuffer = await googleTranslateTTS(text)
      return new NextResponse(audioBuffer, {
        headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' },
      })
    } catch {
      return NextResponse.json({ error: 'TTS failed' }, { status: 500 })
    }
  }
}

// ─── Google Cloud TTS with service account auth ──────────────────────────────

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300_000) {
    return cachedToken.value
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!serviceAccountJson) throw new Error('No service account configured')

  let sa: { client_email: string; private_key: string }
  try {
    sa = JSON.parse(serviceAccountJson)
  } catch {
    throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON — not valid JSON')
  }

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url')

  const unsignedJWT = `${encode(header)}.${encode(payload)}`

  // Import RSA private key
  const pemContents = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----\n?/, '')
    .replace(/\n?-----END PRIVATE KEY-----\n?/, '')
    .replace(/\n/g, '')

  const binaryKey = Buffer.from(pemContents, 'base64')
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    Buffer.from(unsignedJWT)
  )

  const jwt = `${unsignedJWT}.${Buffer.from(signature).toString('base64url')}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    throw new Error(`Token exchange failed: ${err}`)
  }

  const tokenData = await tokenRes.json() as { access_token: string; expires_in: number }
  cachedToken = {
    value: tokenData.access_token,
    expiresAt: Date.now() + tokenData.expires_in * 1000,
  }

  return cachedToken.value
}

async function googleCloudTTS(text: string): Promise<ArrayBuffer> {
  const accessToken = await getAccessToken()

  const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      input: { text },
      voice: {
        languageCode: 'es-US',
        name: 'es-US-Neural2-B',   // Natural male voice — authoritative
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.05,         // Slightly faster — urgency
        pitch: -2.0,                // Low pitch — serious tone
        volumeGainDb: 4.0,
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Google Cloud TTS error ${res.status}: ${errText}`)
  }

  const data = await res.json() as { audioContent: string }
  const binaryString = atob(data.audioContent)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer as ArrayBuffer
}

// ─── Google Translate TTS fallback ───────────────────────────────────────────

async function googleTranslateTTS(text: string): Promise<ArrayBuffer> {
  const chunks = splitText(text, 180)
  const audioChunks: ArrayBuffer[] = []

  for (const chunk of chunks) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=es&client=tw-ob&q=${encodeURIComponent(chunk)}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36',
        'Referer': 'https://translate.google.com/',
      },
    })
    if (!res.ok) throw new Error(`Google Translate TTS error ${res.status}`)
    audioChunks.push(await res.arrayBuffer())
  }

  return concatenateBuffers(audioChunks)
}

function splitText(text: string, maxLen: number): string[] {
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > maxLen) {
    let splitIdx = remaining.lastIndexOf('. ', maxLen)
    if (splitIdx === -1 || splitIdx < maxLen * 0.5) splitIdx = remaining.lastIndexOf(', ', maxLen)
    if (splitIdx === -1 || splitIdx < maxLen * 0.5) splitIdx = remaining.lastIndexOf(' ', maxLen)
    if (splitIdx === -1) splitIdx = maxLen
    chunks.push(remaining.slice(0, splitIdx + 1).trim())
    remaining = remaining.slice(splitIdx + 1).trim()
  }
  if (remaining.length > 0) chunks.push(remaining)
  return chunks
}

function concatenateBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  const totalLength = buffers.reduce((sum, b) => sum + b.byteLength, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const buf of buffers) {
    result.set(new Uint8Array(buf), offset)
    offset += buf.byteLength
  }
  return result.buffer as ArrayBuffer
}
