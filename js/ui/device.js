// Gerätefunktionen: Ton, Vibration, Bildschirm anlassen.
//
// iOS-Grenzen, bewusst hingenommen:
// - navigator.vibrate gibt es in Safari nicht. Der Aufruf ist trotzdem drin,
//   damit es auf Android-Geräten vibriert.
// - Web Audio spielt erst nach einer Berührung und ist im Lautlos-Modus stumm.
//   Deshalb wird der Ton bei jedem Tippen entsperrt und der Timer zeigt das Ende
//   zusätzlich deutlich sichtbar an.

let ctx = null;
let primed = false;

function audio() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    // "ambient" mischt sich mit Musik aus anderen Apps, statt sie anzuhalten.
    // Wer im Gym Musik hört, soll den Piepton zusätzlich hören.
    if (navigator.audioSession) {
      try { navigator.audioSession.type = 'ambient'; } catch { /* ältere Safari-Versionen */ }
    }
    ctx = new Ctor();
  }
  return ctx;
}

/** Bei Nutzergesten aufrufen. iOS unterbricht den Kontext beim Sperren des Geräts. */
export function unlockAudio() {
  const c = audio();
  if (!c) return;
  if (c.state !== 'running') c.resume().catch(() => {});
  if (primed) return;
  primed = true;
  // Ein stiller Puffer innerhalb der ersten Geste schaltet den Ton auf iOS frei.
  const src = c.createBufferSource();
  src.buffer = c.createBuffer(1, 1, 22050);
  src.connect(c.destination);
  src.start(0);
}

export function beep({ freq = 880, duration = 0.15, when = 0, volume = 0.35 } = {}) {
  const c = audio();
  if (!c || c.state !== 'running') return;
  const t = c.currentTime + when;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  // Kurze Rampen verhindern das Knacken beim Ein- und Ausschalten.
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

export function tick() {
  beep({ freq: 660, duration: 0.08, volume: 0.25 });
}

export function endSignal() {
  beep({ freq: 880, duration: 0.18 });
  beep({ freq: 880, duration: 0.18, when: 0.28 });
  beep({ freq: 1175, duration: 0.35, when: 0.56 });
  navigator.vibrate?.([200, 100, 200, 100, 400]);
}

// ---------------------------------------------------------------- Wake Lock

let sentinel = null;
let wanted = false;

async function acquire() {
  if (!wanted || sentinel || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => { sentinel = null; });
  } catch {
    // Nicht unterstützt oder vom System verweigert (z.B. Stromsparmodus).
    sentinel = null;
  }
}

/** Hält den Bildschirm während des Trainings an, soweit der Browser es erlaubt. */
export function keepScreenOn(on) {
  wanted = on;
  if (on) acquire();
  else if (sentinel) {
    sentinel.release().catch(() => {});
    sentinel = null;
  }
}

export function wakeLockSupported() {
  return 'wakeLock' in navigator;
}

// Das System gibt die Sperre beim Wechsel in den Hintergrund frei.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') acquire();
});

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

export function isIos() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
