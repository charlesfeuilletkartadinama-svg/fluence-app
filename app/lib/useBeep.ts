// Génère un bip sonore via Web Audio API — aucun fichier externe nécessaire
export function playBeep(duration = 500, frequency = 880, volume = 0.5) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    gain.gain.value = volume
    oscillator.start()
    // Fade out pour éviter le "clic"
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000)
    oscillator.stop(ctx.currentTime + duration / 1000)
  } catch {
    // Navigateurs qui bloquent l'autoplay — silencieux
  }
}

// Triple bip pour fin de chrono
export function playEndBeep() {
  playBeep(200, 880, 0.4)
  setTimeout(() => playBeep(200, 880, 0.4), 300)
  setTimeout(() => playBeep(400, 1100, 0.5), 600)
}
