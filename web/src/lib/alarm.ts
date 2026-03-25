'use client'

// Emergency alarm — loud two-tone siren using Web Audio API
// Designed to wake up firefighters. MAX VOLUME.

let audioContext: AudioContext | null = null
let alarmNodes: OscillatorNode[] = []
let alarmGain: GainNode | null = null
let alarmTimeout: ReturnType<typeof setTimeout> | null = null
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

// Must be called after a user gesture to unlock audio
export function initAlarm() {
  const ctx = getContext()
  if (ctx?.state === 'suspended') {
    ctx.resume()
  }
}

export function playAlarm() {
  if (isPlaying) return

  const ctx = getContext()
  if (!ctx) return

  if (ctx.state === 'suspended') {
    ctx.resume()
  }

  isPlaying = true

  // Master gain at MAX
  const master = ctx.createGain()
  master.gain.setValueAtTime(1.0, ctx.currentTime)
  master.connect(ctx.destination)
  alarmGain = master

  // SIREN: two oscillators sweeping between low and high freq
  // Creates the classic fire truck siren effect
  const now = ctx.currentTime
  const duration = 30 // 30 seconds of alarm

  // Main siren oscillator — sawtooth for harsh, cutting sound
  const siren1 = ctx.createOscillator()
  siren1.type = 'sawtooth'
  const siren1Gain = ctx.createGain()
  siren1Gain.gain.setValueAtTime(0.5, now)
  siren1.connect(siren1Gain)
  siren1Gain.connect(master)

  // Second oscillator — slightly detuned for thickness
  const siren2 = ctx.createOscillator()
  siren2.type = 'square'
  const siren2Gain = ctx.createGain()
  siren2Gain.gain.setValueAtTime(0.35, now)
  siren2.connect(siren2Gain)
  siren2Gain.connect(master)

  // Sub bass hit for physical impact
  const sub = ctx.createOscillator()
  sub.type = 'sine'
  const subGain = ctx.createGain()
  subGain.gain.setValueAtTime(0.4, now)
  sub.connect(subGain)
  subGain.connect(master)

  // Program the siren sweep — 0.8s up, 0.8s down, repeat
  const cycleTime = 0.8
  const lowFreq = 600
  const highFreq = 1400
  const subLow = 80
  const subHigh = 120

  for (let t = 0; t < duration; t += cycleTime * 2) {
    const tUp = now + t
    const tPeak = now + t + cycleTime
    const tDown = now + t + cycleTime * 2

    // Main siren sweep
    siren1.frequency.linearRampToValueAtTime(lowFreq, tUp)
    siren1.frequency.linearRampToValueAtTime(highFreq, tPeak)
    siren1.frequency.linearRampToValueAtTime(lowFreq, tDown)

    // Detuned siren (offset by 15Hz for beating effect)
    siren2.frequency.linearRampToValueAtTime(lowFreq + 15, tUp)
    siren2.frequency.linearRampToValueAtTime(highFreq + 15, tPeak)
    siren2.frequency.linearRampToValueAtTime(lowFreq + 15, tDown)

    // Sub bass pulse
    sub.frequency.linearRampToValueAtTime(subLow, tUp)
    sub.frequency.linearRampToValueAtTime(subHigh, tPeak)
    sub.frequency.linearRampToValueAtTime(subLow, tDown)
  }

  siren1.start(now)
  siren2.start(now)
  sub.start(now)
  siren1.stop(now + duration)
  siren2.stop(now + duration)
  sub.stop(now + duration)

  alarmNodes = [siren1, siren2, sub]

  // Auto-stop after duration
  alarmTimeout = setTimeout(() => { stopAlarm() }, duration * 1000)

  // HEAVY vibration — continuous aggressive pattern for 30 seconds
  if ('vibrate' in navigator) {
    // 400ms on, 100ms off — relentless buzzing
    const vibratePattern: number[] = []
    for (let i = 0; i < 60; i++) {
      vibratePattern.push(400, 100)
    }
    navigator.vibrate(vibratePattern)
  }
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

  if (alarmTimeout) {
    clearTimeout(alarmTimeout)
    alarmTimeout = null
  }

  if ('vibrate' in navigator) {
    navigator.vibrate(0)
  }
}
