'use client'

// Emergency alarm using Web Audio API
// Generates a loud, attention-grabbing siren sound
let audioContext: AudioContext | null = null
let alarmInterval: ReturnType<typeof setInterval> | null = null
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

function playSirenCycle(ctx: AudioContext, startTime: number) {
  // Two-tone siren: alternates between 800Hz and 1200Hz
  const osc1 = ctx.createOscillator()
  const osc2 = ctx.createOscillator()
  const gain = ctx.createGain()

  gain.connect(ctx.destination)
  gain.gain.setValueAtTime(0.6, startTime)

  // High tone (0 - 0.5s)
  osc1.connect(gain)
  osc1.frequency.setValueAtTime(1200, startTime)
  osc1.frequency.linearRampToValueAtTime(800, startTime + 0.5)
  osc1.start(startTime)
  osc1.stop(startTime + 0.5)

  // Low tone (0.5s - 1.0s)
  osc2.connect(gain)
  osc2.frequency.setValueAtTime(800, startTime + 0.5)
  osc2.frequency.linearRampToValueAtTime(1200, startTime + 1.0)
  osc2.start(startTime + 0.5)
  osc2.stop(startTime + 1.0)

  // Fade out at end
  gain.gain.setValueAtTime(0.6, startTime + 0.9)
  gain.gain.linearRampToValueAtTime(0, startTime + 1.0)
}

export function playAlarm() {
  if (isPlaying) return

  const ctx = getContext()
  if (!ctx) return

  if (ctx.state === 'suspended') {
    ctx.resume()
  }

  isPlaying = true
  let cycle = 0

  // Play siren cycles every 1.1 seconds for 15 seconds max
  const play = () => {
    if (!isPlaying || cycle >= 14) {
      stopAlarm()
      return
    }
    playSirenCycle(ctx, ctx.currentTime)
    cycle++
  }

  play()
  alarmInterval = setInterval(play, 1100)

  // Also vibrate if available
  if ('vibrate' in navigator) {
    navigator.vibrate([300, 100, 300, 100, 300, 100, 600, 200, 300, 100, 300, 100, 300, 100, 600])
  }
}

export function stopAlarm() {
  isPlaying = false
  if (alarmInterval) {
    clearInterval(alarmInterval)
    alarmInterval = null
  }
  if ('vibrate' in navigator) {
    navigator.vibrate(0) // stop vibration
  }
}
