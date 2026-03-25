'use client'

import type { Incident } from '@/types'
import { unitName, alertPhrase, B100_UNITS } from '@/types'

// Emergency alarm — loud siren + voice announcement
// Designed to wake up firefighters. MAX VOLUME.
//
// Voice announcements use server-side TTS (/api/tts) played through
// AudioContext instead of speechSynthesis. This works around:
//   - Samsung One UI 7+ / Android 15 blocking TTS voices for Chrome
//   - Chrome requiring user activation for speechSynthesis.speak()
//   - Chrome 130+ speechSynthesis instability
// AudioContext playback works in installed PWAs without user gesture
// thanks to Chrome's autoplay exemption for installed PWAs.

let audioContext: AudioContext | null = null
let alarmNodes: OscillatorNode[] = []
let alarmGain: GainNode | null = null
let alarmTimeout: ReturnType<typeof setTimeout> | null = null
let speechTimeout: ReturnType<typeof setTimeout> | null = null
let isPlaying = false
let currentSpeechSource: AudioBufferSourceNode | null = null
// Silent oscillator that keeps AudioContext alive between siren and voice.
// Without this, Chrome/Android suspends the context the moment audio stops,
// causing source.start() to fire into a suspended context → silence.
let keepAliveNode: OscillatorNode | null = null

// Cache decoded audio buffers to avoid re-fetching the same announcement
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

export function initAlarm() {
  // Create AudioContext and try to resume it. On installed PWAs, Chrome/Brave
  // allow this without a user gesture after the first session interaction.
  // Called both on page load AND on first user touch, so one of them will work.
  const ctx = getContext()
  if (ctx && ctx.state !== 'running') {
    ctx.resume().catch(() => {})
  }
}

function startSiren(ctx: AudioContext, duration: number) {
  const now = ctx.currentTime

  const master = ctx.createGain()
  master.gain.setValueAtTime(1.0, now)
  master.connect(ctx.destination)
  alarmGain = master

  // Main siren — sawtooth for harsh sound
  const siren1 = ctx.createOscillator()
  siren1.type = 'sawtooth'
  const s1g = ctx.createGain()
  s1g.gain.setValueAtTime(0.5, now)
  siren1.connect(s1g)
  s1g.connect(master)

  // Detuned siren for thickness
  const siren2 = ctx.createOscillator()
  siren2.type = 'square'
  const s2g = ctx.createGain()
  s2g.gain.setValueAtTime(0.35, now)
  siren2.connect(s2g)
  s2g.connect(master)

  // Sub bass
  const sub = ctx.createOscillator()
  sub.type = 'sine'
  const subg = ctx.createGain()
  subg.gain.setValueAtTime(0.4, now)
  sub.connect(subg)
  subg.connect(master)

  const cycleTime = 0.8
  for (let t = 0; t < duration; t += cycleTime * 2) {
    const tUp = now + t
    const tPeak = now + t + cycleTime
    const tDown = now + t + cycleTime * 2

    siren1.frequency.linearRampToValueAtTime(350, tUp)
    siren1.frequency.linearRampToValueAtTime(750, tPeak)
    siren1.frequency.linearRampToValueAtTime(350, tDown)

    siren2.frequency.linearRampToValueAtTime(365, tUp)
    siren2.frequency.linearRampToValueAtTime(765, tPeak)
    siren2.frequency.linearRampToValueAtTime(365, tDown)

    sub.frequency.linearRampToValueAtTime(60, tUp)
    sub.frequency.linearRampToValueAtTime(100, tPeak)
    sub.frequency.linearRampToValueAtTime(60, tDown)
  }

  siren1.start(now)
  siren2.start(now)
  sub.start(now)
  siren1.stop(now + duration)
  siren2.stop(now + duration)
  sub.stop(now + duration)

  alarmNodes.push(siren1, siren2, sub)
}

function startKeepAlive(ctx: AudioContext) {
  if (keepAliveNode) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, ctx.currentTime) // inaudible but keeps context running
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

// Fetch TTS audio from server and decode it for AudioContext playback.
// Uses a cache so repeated announcements don't re-fetch.
async function fetchTTSAudio(ctx: AudioContext, text: string): Promise<AudioBuffer> {
  const cached = ttsCache.get(text)
  if (cached) return cached

  const url = `/api/tts?text=${encodeURIComponent(text)}`
  const res = await fetch(url)

  if (!res.ok) {
    throw new Error(`TTS fetch failed: ${res.status}`)
  }

  const arrayBuffer = await res.arrayBuffer()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)

  // Cache it (keep cache small — only last 5 announcements)
  if (ttsCache.size >= 5) {
    const firstKey = ttsCache.keys().next().value!
    ttsCache.delete(firstKey)
  }
  ttsCache.set(text, audioBuffer)

  return audioBuffer
}

// Play an AudioBuffer through AudioContext and call onEnd when done.
function playAudioBuffer(ctx: AudioContext, buffer: AudioBuffer, onEnd?: () => void) {
  const source = ctx.createBufferSource()
  source.buffer = buffer

  // Boost voice volume
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(1.0, ctx.currentTime)
  source.connect(gain)
  gain.connect(ctx.destination)

  currentSpeechSource = source

  // Safety timeout — if audio doesn't end in 20s, move on
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

// Speak text using server-side TTS played through AudioContext.
// Falls back to speechSynthesis only on desktop where it works reliably.
async function speak(ctx: AudioContext, text: string, onEnd?: () => void) {
  try {
    const audioBuffer = await fetchTTSAudio(ctx, text)
    if (!isPlaying) { onEnd?.(); return }
    // Resume context — Android suspends it the instant audio stops.
    // Must await so the context is actually running before source.start().
    await ctx.resume()
    playAudioBuffer(ctx, audioBuffer, onEnd)
  } catch (err) {
    console.warn('Server TTS failed, trying speechSynthesis fallback:', err)
    speakFallback(text, onEnd)
  }
}

// Fallback: use speechSynthesis (works on desktop, unreliable on Android)
function speakFallback(text: string, onEnd?: () => void) {
  if (!('speechSynthesis' in window)) {
    onEnd?.()
    return
  }

  window.speechSynthesis.cancel()

  setTimeout(() => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'es'
    utterance.rate = 0.85
    utterance.pitch = 0.7
    utterance.volume = 1.0

    const voices = window.speechSynthesis.getVoices()
    const esVoice = voices.find(v => v.lang.startsWith('es'))
    if (esVoice) utterance.voice = esVoice

    const safetyTimer = setTimeout(() => {
      window.speechSynthesis.cancel()
      onEnd?.()
    }, 20000)

    utterance.onend = () => { clearTimeout(safetyTimer); onEnd?.() }
    utterance.onerror = () => { clearTimeout(safetyTimer); onEnd?.() }

    window.speechSynthesis.speak(utterance)
  }, 200)
}

export function playAlarm(incident?: Incident) {
  // Force stop any previous alarm before starting new one
  if (isPlaying) stopAlarm()

  const ctx = getContext()
  if (!ctx) return

  isPlaying = true

  // Resume context then start alarm. Must await — on Android the context
  // is suspended after page load and audio won't play until it's running.
  ctx.resume().then(() => {
    if (!isPlaying) return // stopped while we waited
    startKeepAlive(ctx)
    _startAlarm(ctx, incident)
  }).catch(() => {
    // resume() rejected — browser blocked autoplay (no user gesture, not installed PWA).
    // Try anyway in case the browser allows it after all.
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

  if (!incident) {
    // No incident data — just play siren for 30s
    startSiren(ctx, 30)
    alarmTimeout = setTimeout(() => stopAlarm(), 30000)
    return
  }

  const announcement = buildAnnouncement(incident)
  let repeatCount = 0

  // Pre-fetch the TTS audio immediately so it's cached for playback
  fetchTTSAudio(ctx, announcement).catch(() => {})

  function killSiren() {
    for (const node of alarmNodes) {
      try { node.stop() } catch { /* ok */ }
    }
    alarmNodes = []
    if (alarmGain) {
      try { alarmGain.gain.setValueAtTime(0, alarmGain.context.currentTime) } catch { /* ok */ }
      alarmGain = null
    }
  }

  function cycle() {
    if (!isPlaying || repeatCount >= 3) {
      stopAlarm()
      return
    }

    // 3 seconds of siren
    startSiren(ctx!, 3)

    // After siren STOPS, speak
    speechTimeout = setTimeout(() => {
      if (!isPlaying) return

      // Kill siren completely so voice can be heard
      killSiren()

      speak(ctx!, announcement, () => {
        repeatCount++
        if (isPlaying && repeatCount < 3) {
          speechTimeout = setTimeout(cycle, 300)
        } else {
          // Final siren burst
          if (isPlaying) {
            startSiren(ctx!, 5)
            alarmTimeout = setTimeout(() => stopAlarm(), 5000)
          }
        }
      })
    }, 3000)
  }

  cycle()
}

export function stopAlarm() {
  isPlaying = false
  stopKeepAlive()

  for (const node of alarmNodes) {
    try { node.stop() } catch { /* already stopped */ }
  }
  alarmNodes = []

  if (alarmGain) {
    try { alarmGain.gain.setValueAtTime(0, alarmGain.context.currentTime) } catch { /* ok */ }
    alarmGain = null
  }

  if (currentSpeechSource) {
    try { currentSpeechSource.stop() } catch { /* ok */ }
    currentSpeechSource = null
  }

  if (alarmTimeout) { clearTimeout(alarmTimeout); alarmTimeout = null }
  if (speechTimeout) { clearTimeout(speechTimeout); speechTimeout = null }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }

  if ('vibrate' in navigator) {
    navigator.vibrate(0)
  }
}
