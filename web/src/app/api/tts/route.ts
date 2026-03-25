import { NextRequest, NextResponse } from 'next/server'

// Server-side TTS endpoint — generates MP3 audio from text.
// This bypasses all client-side speechSynthesis issues on Android:
//   - Samsung One UI 7+ blocks TTS voices for third-party apps
//   - Chrome requires user activation for speechSynthesis.speak()
//   - Chrome 130+ has speechSynthesis instability bugs
//
// The client plays the returned MP3 through AudioContext, which
// works reliably in installed PWAs (autoplay exemption).
//
// Supports two backends:
//   1. Google Cloud TTS (set GOOGLE_TTS_API_KEY env var) — high quality
//   2. Google Translate TTS (no key needed) — free fallback, good enough

const MAX_TEXT_LENGTH = 500

export async function GET(req: NextRequest) {
  const text = req.nextUrl.searchParams.get('text')
  if (!text || text.length === 0) {
    return NextResponse.json({ error: 'Missing text parameter' }, { status: 400 })
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: 'Text too long' }, { status: 400 })
  }

  try {
    const audioBuffer = process.env.GOOGLE_TTS_API_KEY
      ? await googleCloudTTS(text)
      : await googleTranslateTTS(text)

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400', // cache 24h — same text = same audio
      },
    })
  } catch (err) {
    console.error('TTS generation failed:', err)
    return NextResponse.json({ error: 'TTS failed' }, { status: 500 })
  }
}

// ─── Google Cloud TTS (high quality, needs API key) ─────────────────────────

async function googleCloudTTS(text: string): Promise<ArrayBuffer> {
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_TTS_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: 'es-US',      // Latin American Spanish
          name: 'es-US-Standard-B',   // Male voice — authoritative for emergencies
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 0.85,          // Slightly slow for clarity
          pitch: -2.0,                 // Low pitch for serious tone
          volumeGainDb: 4.0,          // Boost volume
        },
      }),
    }
  )

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Google Cloud TTS error ${res.status}: ${errText}`)
  }

  const data = await res.json()
  // Google returns base64-encoded audio
  const binaryString = atob(data.audioContent)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer as ArrayBuffer
}

// ─── Google Translate TTS (free, no API key, rate-limited) ──────────────────

async function googleTranslateTTS(text: string): Promise<ArrayBuffer> {
  // Google Translate TTS has a ~200 char limit per request.
  // For longer text, split into chunks and concatenate.
  const chunks = splitText(text, 180)
  const audioChunks: ArrayBuffer[] = []

  for (const chunk of chunks) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=es&client=tw-ob&q=${encodeURIComponent(chunk)}`
    const res = await fetch(url, {
      headers: {
        // Mimic a browser request — Google rejects bare fetches
        'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36',
        'Referer': 'https://translate.google.com/',
      },
    })

    if (!res.ok) {
      throw new Error(`Google Translate TTS error ${res.status}`)
    }

    audioChunks.push(await res.arrayBuffer())
  }

  // Concatenate MP3 chunks (MP3 frames are independently decodable)
  return concatenateBuffers(audioChunks)
}

function splitText(text: string, maxLen: number): string[] {
  const chunks: string[] = []
  let remaining = text

  while (remaining.length > maxLen) {
    // Try to split at sentence boundary
    let splitIdx = remaining.lastIndexOf('. ', maxLen)
    if (splitIdx === -1 || splitIdx < maxLen * 0.5) {
      // Try comma
      splitIdx = remaining.lastIndexOf(', ', maxLen)
    }
    if (splitIdx === -1 || splitIdx < maxLen * 0.5) {
      // Try space
      splitIdx = remaining.lastIndexOf(' ', maxLen)
    }
    if (splitIdx === -1) {
      splitIdx = maxLen
    }

    chunks.push(remaining.slice(0, splitIdx + 1).trim())
    remaining = remaining.slice(splitIdx + 1).trim()
  }

  if (remaining.length > 0) {
    chunks.push(remaining)
  }

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
