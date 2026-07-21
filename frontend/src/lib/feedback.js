/**
 * Haptics and audio cues for the live workout screen.
 *
 * During a set the phone is usually face-down on a bench or in a pocket — the
 * user is not looking at it. Sound and vibration are the primary channel, not a
 * decoration. Both degrade silently: no vibration API, no Web Audio, or a
 * browser that blocks autoplay all fail quietly rather than throwing.
 */

let audioCtx = null;

/**
 * Browsers require a user gesture before audio can play. Call this from the
 * first tap (starting a set), so later beeps — which fire on a timer, not a
 * gesture — are allowed.
 */
export function primeAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {
    /* audio unavailable — silent fallback */
  }
}

/** A short sine blip. `pitch` in Hz, `ms` duration. */
export function beep({ pitch = 880, ms = 120, gain = 0.15 } = {}) {
  try {
    if (!audioCtx) primeAudio();
    if (!audioCtx || audioCtx.state !== 'running') return;

    const osc = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = pitch;

    // Ramp the gain rather than switching it — an abrupt start/stop produces an
    // audible click on most speakers.
    const now = audioCtx.currentTime;
    amp.gain.setValueAtTime(0, now);
    amp.gain.linearRampToValueAtTime(gain, now + 0.01);
    amp.gain.linearRampToValueAtTime(0, now + ms / 1000);

    osc.connect(amp).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + ms / 1000 + 0.02);
  } catch {
    /* ignore */
  }
}

/** Countdown tick — rising pitch on the final beat so "go" is unmistakable. */
export const tickBeep = () => beep({ pitch: 660, ms: 90, gain: 0.12 });
export const goBeep = () => beep({ pitch: 1180, ms: 220, gain: 0.2 });
export const completeBeep = () => {
  beep({ pitch: 880, ms: 110 });
  setTimeout(() => beep({ pitch: 1320, ms: 180 }), 120);
};

export function vibrate(pattern = [200]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

export const hapticSet = () => vibrate([200]);
export const hapticRep = () => vibrate([12]);
export const hapticDone = () => vibrate([80, 60, 160]);
