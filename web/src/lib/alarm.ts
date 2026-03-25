'use client'

import type { Incident } from '@/types'
import { unitName, alertPhrase, B100_UNITS } from '@/types'

// Emergency alarm — loud siren + voice announcement
// Designed to wake up firefighters. MAX VOLUME.

let audioContext: AudioContext | null = null
let alarmNodes: OscillatorNode[] = []
let alarmGain: GainNode | null = null
let alarmTimeout: ReturnType<typeof setTimeout> | null = null
let speechTimeout: ReturnType<typeof setTimeout> | null = null
let isPlaying = false

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
  const ctx = getContext()
  if (ctx?.state === 'suspended') {
    ctx.resume()
  }
  // Pre-warm speech synthesis — Android needs this to load voices
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices()
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices()
    }
    // Speak a dot to fully initialize the TTS engine
    const warmup = new SpeechSynthesisUtterance('.')
    warmup.volume = 0.01
    warmup.rate = 10
    window.speechSynthesis.speak(warmup)
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

function speak(text: string, onEnd?: () => void) {
  if (!('speechSynthesis' in window)) {
    onEnd?.()
    return
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel()

  // Small delay — Android Chrome needs this after cancel()
  setTimeout(() => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'es'
    utterance.rate = 0.85
    utterance.pitch = 0.7 // low pitch for serious tone
    utterance.volume = 1.0

    // Try to find a Spanish voice
    const voices = window.speechSynthesis.getVoices()
    const esVoice = voices.find(v => v.lang.startsWith('es'))
    if (esVoice) utterance.voice = esVoice

    // Safety timeout — if speech doesn't end in 20s, move on
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
  if (isPlaying) return

  const ctx = getContext()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume()

  isPlaying = true

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

      speak(announcement, () => {
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

  for (const node of alarmNodes) {
    try { node.stop() } catch { /* already stopped */ }
  }
  alarmNodes = []

  if (alarmGain) {
    try { alarmGain.gain.setValueAtTime(0, alarmGain.context.currentTime) } catch { /* ok */ }
    alarmGain = null
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
