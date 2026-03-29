'use client'

import type { Incident } from '@/types'
import { unitName, alertPhrase, B100_UNITS } from '@/types'

// Emergency alarm — Selectiva real de la B100
//
// Flow exacto de una salida:
//   1. Suena PreventivaySelectiva (2.73s) — UNA sola vez
//   2. Pausa 3s
//   3. Suena selectiva_repeat (1.13s) — hasta 5 veces, cada 3s
//   4. Si el usuario abre la notificación/app → para todo
//
// Voice TTS se reproduce DESPUÉS de la secuencia de selectivas.

let audioContext: AudioContext | null = null
let alarmGain: GainNode | null = null
let repeatTimer: ReturnType<typeof setTimeout> | null = null
let voiceTimer: ReturnType<typeof setTimeout> | null = null
let isPlaying = false
let currentSource: AudioBufferSourceNode | null = null
let currentSpeechSource: AudioBufferSourceNode | null = null
let keepAliveNode: OscillatorNode | null = null

// Pre-loaded audio buffers
let prevSelectivaBuffer: AudioBuffer | null = null
let repeatBuffer: AudioBuffer | null = null
let buffersLoading = false

const ttsCache = new Map<string, AudioBuffer>()

function getContext(): AudioContext | null {
  if (!audioContext || audioContext.state === 'closed') {
    try {
      audioContext = new AudioContext()
    } catch {
      return null
    }
  }
  return audioContext
}

async function loadBuffers(ctx: AudioContext) {
  if ((prevSelectivaBuffer && repeatBuffer) || buffersLoading) return
  buffersLoading = true

  try {
    const [prevRes, repRes] = await Promise.all([
      fetch('/sounds/preventiva-y-selectiva.mp3'),
      fetch('/sounds/selectiva-repeat.mp3'),
    ])
    if (prevRes.ok) {
      prevSelectivaBuffer = await ctx.decodeAudioData(await prevRes.arrayBuffer())
    }
    if (repRes.ok) {
      repeatBuffer = await ctx.decodeAudioData(await repRes.arrayBuffer())
    }
  } catch (err) {
    console.warn('Failed to load alarm audio:', err)
  }
  buffersLoading = false
}

export function initAlarm() {
  const ctx = getContext()
  if (!ctx) return
  if (ctx.state !== 'running') {
    ctx.resume().catch(() => {})
  }
  loadBuffers(ctx).catch(() => {})
}

function startKeepAlive(ctx: AudioContext) {
  if (keepAliveNode) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, ctx.currentTime)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  keepAliveNode = osc
}

function stopKeepAlive() {
  if (keepAliveNode) {
    try { keepAliveNode.stop() } catch { /* ok */ }
    keepAliveNode = null
  }
}

function playBuffer(ctx: AudioContext, buffer: AudioBuffer, onEnd?: () => void) {
  const source = ctx.createBufferSource()
  source.buffer = buffer

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(1.0, ctx.currentTime)
  source.connect(gain)
  gain.connect(ctx.destination)
  alarmGain = gain

  currentSource = source

  source.onended = () => {
    currentSource = null
    onEnd?.()
  }

  source.start()
}

function stopCurrentSource() {
  if (currentSource) {
    try { currentSource.stop() } catch { /* ok */ }
    currentSource = null
  }
  if (alarmGain) {
    try { alarmGain.gain.setValueAtTime(0, alarmGain.context.currentTime) } catch { /* ok */ }
    alarmGain = null
  }
}

// ─── TTS ──────────────────────────────────────────────────────────────────────

function buildAnnouncement(incident: Incident): string {
  const alert = alertPhrase(incident.type)
  const b100 = incident.units
    .filter(u => (B100_UNITS as readonly string[]).includes(u))
    .map(u => `Sale ${unitName(u)}`)
    .join('. ')
  const address = incident.address
    .replace(/\s+/g, ' ')
    .replace(/CL\./gi, 'Calle')
    .replace(/AV\./gi, 'Avenida')
    .replace(/JR\./gi, 'Jirón')
    .replace(/NRO\./gi, 'Número')
    .replace(/Nro\./gi, 'Número')

  return `Atención San Isidro 100. ${alert}. ${b100}. Dirección: ${address}.`
}

async function fetchTTSAudio(ctx: AudioContext, text: string): Promise<AudioBuffer> {
  const cached = ttsCache.get(text)
  if (cached) return cached

  const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}`)
  if (!res.ok) throw new Error(`TTS fetch failed: ${res.status}`)

  const audioBuffer = await ctx.decodeAudioData(await res.arrayBuffer())

  if (ttsCache.size >= 5) {
    const firstKey = ttsCache.keys().next().value!
    ttsCache.delete(firstKey)
  }
  ttsCache.set(text, audioBuffer)
  return audioBuffer
}

function playTTS(ctx: AudioContext, buffer: AudioBuffer, onEnd?: () => void) {
  const source = ctx.createBufferSource()
  source.buffer = buffer

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(1.0, ctx.currentTime)
  source.connect(gain)
  gain.connect(ctx.destination)

  currentSpeechSource = source

  const safetyTimer = setTimeout(() => {
    try { source.stop() } catch { /* ok */ }
    currentSpeechSource = null
    onEnd?.()
  }, 20000)

  source.onended = () => {
    clearTimeout(safetyTimer)
    currentSpeechSource = null
    onEnd?.()
  }

  source.start()
}

async function speak(ctx: AudioContext, text: string, onEnd?: () => void) {
  try {
    const audioBuffer = await fetchTTSAudio(ctx, text)
    if (!isPlaying) { onEnd?.(); return }
    await ctx.resume()
    playTTS(ctx, audioBuffer, onEnd)
  } catch (err) {
    console.warn('TTS failed:', err)
    onEnd?.()
  }
}

// ─── Main alarm logic ─────────────────────────────────────────────────────────

export function playAlarm(incident?: Incident) {
  if (isPlaying) stopAlarm()

  const ctx = getContext()
  if (!ctx) return

  isPlaying = true

  ctx.resume().then(() => {
    if (!isPlaying) return
    startKeepAlive(ctx)
    _startAlarm(ctx, incident)
  }).catch(() => {
    startKeepAlive(ctx)
    _startAlarm(ctx, incident)
  })
}

function _startAlarm(ctx: AudioContext, incident?: Incident) {
  // Heavy vibration
  if ('vibrate' in navigator) {
    const pattern: number[] = []
    for (let i = 0; i < 60; i++) pattern.push(400, 100)
    navigator.vibrate(pattern)
  }

  // Pre-fetch TTS if we have incident data
  const announcement = incident ? buildAnnouncement(incident) : null
  if (announcement) {
    fetchTTSAudio(ctx, announcement).catch(() => {})
  }

  // STEP 1: Play PreventivaySelectiva (2.73s)
  if (prevSelectivaBuffer) {
    playBuffer(ctx, prevSelectivaBuffer, () => {
      if (!isPlaying) return
      // STEP 2: After 3s pause, start repeat loop
      repeatTimer = setTimeout(() => startRepeatLoop(ctx, 0, announcement), 3000)
    })
  } else {
    // Buffers didn't load — try loading now then fallback
    loadBuffers(ctx).then(() => {
      if (!isPlaying) return
      if (prevSelectivaBuffer) {
        playBuffer(ctx, prevSelectivaBuffer, () => {
          if (!isPlaying) return
          repeatTimer = setTimeout(() => startRepeatLoop(ctx, 0, announcement), 3000)
        })
      } else {
        // Total fallback — just play repeats
        startRepeatLoop(ctx, 0, announcement)
      }
    })
  }
}

function startRepeatLoop(ctx: AudioContext, count: number, announcement: string | null) {
  if (!isPlaying || count >= 5) {
    // Done with selectivas — play voice announcement if available
    if (isPlaying && announcement) {
      voiceTimer = setTimeout(() => {
        if (!isPlaying) return
        speak(ctx, announcement, () => stopAlarm())
      }, 500)
    } else {
      stopAlarm()
    }
    return
  }

  if (repeatBuffer) {
    playBuffer(ctx, repeatBuffer, () => {
      if (!isPlaying) return
      // Wait 3s then play next repeat
      repeatTimer = setTimeout(() => startRepeatLoop(ctx, count + 1, announcement), 3000)
    })
  } else {
    // No repeat buffer — skip to voice
    if (announcement) {
      speak(ctx, announcement, () => stopAlarm())
    } else {
      stopAlarm()
    }
  }
}

export function stopAlarm() {
  isPlaying = false
  stopKeepAlive()
  stopCurrentSource()

  if (currentSpeechSource) {
    try { currentSpeechSource.stop() } catch { /* ok */ }
    currentSpeechSource = null
  }

  if (repeatTimer) { clearTimeout(repeatTimer); repeatTimer = null }
  if (voiceTimer) { clearTimeout(voiceTimer); voiceTimer = null }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }

  if ('vibrate' in navigator) {
    navigator.vibrate(0)
  }
}
