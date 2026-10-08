"use client";

// Plucked-string synth (Karplus-Strong) + analyser. No audio files needed: every note is
// generated from a noise burst run through a tuned delay line, which is how a real string behaves.

/** Open strings, low E → high E */
export const STRING_FREQS = [82.41, 110, 146.83, 196, 246.94, 329.63];

type PluckListener = (string: number) => void;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let muted = false;
let riffing = false;

const listeners = new Set<PluckListener>();
const muteListeners = new Set<(muted: boolean) => void>();
const buffers = new Map<string, AudioBuffer>();
const freqData = new Uint8Array(128);

/** True once the browser has let the AudioContext run (i.e. after a click/tap/key). */
function running() {
  return ctx?.state === "running";
}

/**
 * Browsers only allow sound after a real gesture (click, tap, key) — a hover is not one.
 * Call this from any such handler; the global listener below also calls it on the first gesture anywhere.
 */
export function unlockAudio() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.85;
    const warmth = ctx.createBiquadFilter();
    warmth.type = "lowpass";
    warmth.frequency.value = 5200;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.6;
    master.connect(warmth).connect(analyser).connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
}

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 0.85, ctx.currentTime, 0.05);
  muteListeners.forEach((fn) => fn(value));
}

export function onMuteChange(fn: (muted: boolean) => void) {
  muteListeners.add(fn);
  return () => {
    muteListeners.delete(fn);
  };
}

// First real gesture anywhere on the page unlocks audio, so hovering the strings works from then on.
if (typeof window !== "undefined") {
  const unlockOnce = () => {
    unlockAudio();
    if (running()) {
      window.removeEventListener("pointerdown", unlockOnce, true);
      window.removeEventListener("keydown", unlockOnce, true);
      window.removeEventListener("touchend", unlockOnce, true);
    }
  };
  window.addEventListener("pointerdown", unlockOnce, true);
  window.addEventListener("keydown", unlockOnce, true);
  window.addEventListener("touchend", unlockOnce, true);
}

/** Subscribe to plucks (user or riff) so the 3D strings can vibrate in sync. */
export function onPluck(fn: PluckListener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emit(string: number) {
  listeners.forEach((fn) => fn(string));
}

function karplusStrong(freq: number, seconds = 2.4) {
  if (!ctx) throw new Error("audio not unlocked");
  const sr = ctx.sampleRate;
  const length = Math.floor(sr * seconds);
  const period = Math.round(sr / freq);
  const buffer = ctx.createBuffer(1, length, sr);
  const out = buffer.getChannelData(0);
  const ring = new Float32Array(period);
  for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
  // Each pass around the ring averages neighbours (string loses highs) and loses a little energy.
  let idx = 0;
  for (let n = 0; n < length; n++) {
    const sample = ring[idx];
    const next = ring[(idx + 1) % period];
    ring[idx] = 0.5 * (sample + next) * 0.9965;
    out[n] = sample;
    idx = (idx + 1) % period;
  }
  return buffer;
}

function playNote(freq: number, when: number, velocity: number) {
  // Before the first gesture the context is suspended: skip, otherwise notes pile up and burst on unlock.
  if (!ctx || !master || !running()) return;
  const key = freq.toFixed(2);
  let buffer = buffers.get(key);
  if (!buffer) {
    buffer = karplusStrong(freq);
    buffers.set(key, buffer);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = 0.45 * velocity;
  src.connect(gain).connect(master);
  src.start(ctx.currentTime + when);
}

/** Pluck one open string (fret shifts the pitch in semitones). The string still vibrates when silent. */
export function pluck(string: number, velocity = 1, fret = 0) {
  if (ctx) playNote(STRING_FREQS[string] * 2 ** (fret / 12), 0, velocity);
  emit(string);
}

/** A short fingerpicked E-minor phrase that ends in a strum. */
export function playRiff() {
  if (riffing) return;
  unlockAudio();
  riffing = true;

  const step = 0.14;
  const pattern: [string: number, fret: number][] = [
    [0, 0], [3, 0], [4, 0], [5, 0], [4, 0], [3, 0], [0, 0], [4, 0],
    [1, 2], [3, 0], [4, 0], [5, 3], [4, 0], [3, 0], [1, 2], [4, 0],
  ];
  const events: { t: number; string: number; fret: number; v: number }[] = pattern.map(
    ([string, fret], i) => ({ t: i * step, string, fret, v: 0.85 }),
  );
  const strum = (t: number, down: boolean, v: number) => {
    for (let i = 0; i < 6; i++) {
      const string = down ? i : 5 - i;
      events.push({ t: t + i * 0.028, string, fret: 0, v });
    }
  };
  strum(pattern.length * step + 0.05, true, 1);
  strum(pattern.length * step + 0.6, true, 0.8);
  strum(pattern.length * step + 0.95, false, 0.7);

  for (const e of events) {
    playNote(STRING_FREQS[e.string] * 2 ** (e.fret / 12), e.t, e.v);
    window.setTimeout(() => emit(e.string), e.t * 1000);
  }
  const total = events[events.length - 1].t + 0.3;
  window.setTimeout(() => {
    riffing = false;
  }, total * 1000);
}

/** Soft "message received" pop for the chat. */
export function blip(high = false) {
  if (!ctx || !master || !running()) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(high ? 880 : 660, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(high ? 1320 : 990, ctx.currentTime + 0.06);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
  osc.connect(gain).connect(master);
  osc.start();
  osc.stop(ctx.currentTime + 0.2);
}

/** Call once per frame: fills `out` with a smoothed level and 12 frequency bands (0–1). */
export function sampleAudio(out: { level: number; bands: Float32Array }) {
  if (!analyser) {
    out.level *= 0.9;
    return;
  }
  analyser.getByteFrequencyData(freqData);
  let sum = 0;
  for (let i = 1; i < 40; i++) sum += freqData[i];
  const level = Math.min(1, (sum / 39 / 255) * 0.85);
  out.level += (level - out.level) * 0.35;
  for (let b = 0; b < 12; b++) {
    const v = freqData[1 + b * 3] / 255;
    out.bands[b] += (v - out.bands[b]) * 0.4;
  }
}
