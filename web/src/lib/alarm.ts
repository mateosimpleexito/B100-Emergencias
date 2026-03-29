'use client'

import type { Incident } from '@/types'
import { unitName, alertPhrase, B100_UNITS } from '@/types'

// Emergency alarm — SELECTIVA real de la B100 + voice announcement
// Designed to wake up firefighters. MAX VOLUME. Estilo INDECI.
//
// Flow: selectiva loop × 3 → voz → selectiva loop × 3 → voz → ×3 → burst final
//
// Voice announcements use server-side TTS (/api/tts) played through
// AudioContext. Works in installed PWAs without user gesture.

let audioContext: AudioContext | null = null
let alarmGain: GainNode | null = null
let alarmTimeout: ReturnType<typeof setTimeout> | null = null
let speechTimeout: ReturnType<typeof setTimeout> | null = null
let isPlaying = false
let currentSpeechSource: AudioBufferSourceNode | null = null
let currentSelectivaSource: AudioBufferSourceNode | null = null
let keepAliveNode: OscillatorNode | null = null

// Pre-loaded selectiva audio buffer
let selectivaBuffer: AudioBuffer | null = null
let selectivaLoading = false

// Cache decoded TTS audio buffers
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

// Pre-load the selectiva audio so it's ready instantly when alarm fires
async function loadSelectiva(ctx: AudioContext): Promise<AudioBuffer | null> {
  if (selectivaBuffer) return selectivaBuffer
  if (selectivaLoading) return null
  selectivaLoading = true

  try {
    const res = await fetch('/sounds/selectiva.mp3')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const arrayBuffer = await res.arrayBuffer()
    selectivaBuffer = await ctx.decodeAudioData(arrayBuffer)
    return selectivaBuffer
  } catch (err) {
    console.warn('Failed to load selectiva audio:', err)
    selectivaLoading = false
    return null
  }
}

export function initAlarm() {
  const ctx = getContext()
  if (!ctx) return
  if (ctx.state !== 'running') {
    ctx.resume().catch(() => {})
  }
  // Pre-load selectiva immediately
  loadSelectiva(ctx).catch(() => {})
}

// Play selectiva looped N times through AudioContext at MAX volume
function playSelectiva(ctx: AudioContext, loops: number, onEnd?: () => void) {
  if (!selectivaBuffer) {
    // Fallback: if selectiva didn't load, use a harsh oscillator burst
    playFallbackSiren(ctx, loops * 2.7, onEnd)
    return
  }

  const master = ctx.createGain()
  master.gain.setValueAtTime(1.0, ctx.currentTime)
  master.connect(ctx.destination)
  alarmGain = master

  let loopsPlayed = 0

  function playOneLoop() {
    if (!isPlaying || loopsPlayed >= loops) {
      onEnd?.()
      return
    }

    const source = ctx.createBufferSource()
    source.buffer = selectivaBuffer!
    source.connect(master)
    currentSelectivaSource = source

    source.onended = () => {
      currentSelectivaSource = null
      loopsPlayed++
      if (isPlaying && loopsPlayed < loops) {
        playOneLoop()
      } else {
        onEnd?.()
      }
    }

    source.start()
  }

  playOneLoop()
}

// Fallback siren if selectiva.mp3 fails to load
function playFallbackSiren(ctx: AudioContext, duration: number, onEnd?: () => void) {
  const now = ctx.currentTime
  const master = ctx.createGain()
  master.gain.setValueAtTime(1.0, now)
  master.connect(ctx.destination)
  alarmGain = master

  const siren = ctx.createOscillator()
  siren.type = 'sawtooth'
  const sg = ctx.createGain()
  sg.gain.setValueAtTime(0.6, now)
  siren.connect(sg)
  sg.connect(master)

  const cycleTime = 0.8
  for (let t = 0; t < duration; t += cycleTime * 2) {
    siren.frequency.linearRampToValueAtTime(350, now + t)
    siren.frequency.linearRampToValueAtTime(750, now + t + cycleTime)
    siren.frequency.linearRampToValueAtTime(350, now + t + cycleTime * 2)
  }

  siren.start(now)
  siren.stop(now + duration)
  siren.onended = () => onEnd?.()
}

function stopSelectiva() {
  if (currentSelectivaSource) {
    try { currentSelectivaSource.stop() } catch { /* ok */ }
    currentSelectivaSource = null
  }
  if (alarmGain) {
    try { alarmGain.gain.setValueAtTime(0, alarmGain.context.currentTime) } catch { /* ok */ }
    alarmGain = null
  }
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

  const url = `/api/tts?text=${encodeURIComponent(text)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`TTS fetch failed: ${res.status}`)

  const arrayBuffer = await res.arrayBuffer()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)

  if (ttsCache.size >= 5) {
    const firstKey = ttsCache.keys().next().value!
    ttsCache.delete(firstKey)
  }
  ttsCache.set(text, audioBuffer)
  return audioBuffer
}

function playAudioBuffer(ctx: AudioContext, buffer: AudioBuffer, onEnd?: () => void) {
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
    playAudioBuffer(ctx, audioBuffer, onEnd)
  } catch (err) {
    console.warn('Server TTS failed, trying speechSynthesis fallback:', err)
    speakFallback(text, onEnd)
  }
}

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
  // Heavy vibration — 60 cycles like INDECI
  if ('vibrate' in navigator) {
    const pattern: number[] = []
    for (let i = 0; i < 60; i++) pattern.push(400, 100)
    navigator.vibrate(pattern)
  }

  if (!incident) {
    // No incident data — play selectiva in loop for ~30s
    playSelectiva(ctx, 11, () => stopAlarm())
    alarmTimeout = setTimeout(() => stopAlarm(), 33000)
    return
  }

  const announcement = buildAnnouncement(incident)
  let repeatCount = 0

  // Pre-fetch TTS audio immediately
  fetchTTSAudio(ctx, announcement).catch(() => {})

  function cycle() {
    if (!isPlaying || repeatCount >= 3) {
      // Final burst — 5 loops of selectiva then stop
      if (isPlaying) {
        playSelectiva(ctx!, 5, () => stopAlarm())
        alarmTimeout = setTimeout(() => stopAlarm(), 15000)
      }
      return
    }

    // Play selectiva × 3 (~8s)
    playSelectiva(ctx!, 3, () => {
      if (!isPlaying) return

      // Stop selectiva, then speak
      stopSelectiva()

      speechTimeout = setTimeout(() => {
        if (!isPlaying) return

        speak(ctx!, announcement, () => {
          repeatCount++
          if (isPlaying && repeatCount < 3) {
            speechTimeout = setTimeout(cycle, 200)
          } else {
            cycle() // triggers final burst
          }
        })
      }, 150)
    })
  }

  cycle()
}

export function stopAlarm() {
  isPlaying = false
  stopKeepAlive()
  stopSelectiva()

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
