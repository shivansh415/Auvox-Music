"use client";

// The Reach's sound, through the site's audio bus (global mute, warmth filter and analyser apply):
// a warm chord that swells while the visitor holds, and at the touch a low bloom, a breath of air,
// a strummed D chord on the guitar, the same chord on the keys, and a long shimmer that fades.

import { audioBus, playChord, pluck, warmNote } from "@/components/sections/Session/audio";

type Bus = NonNullable<ReturnType<typeof audioBus>>;

/** D major add9, voiced warm and open */
const SWELL = [73.42, 146.83, 220, 293.66, 329.63, 369.99];

let swell: { ctx: AudioContext; gain: GainNode; filter: BiquadFilterNode; oscs: OscillatorNode[] } | null = null;

function noise(ctx: AudioContext, seconds: number) {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function build(b: Bus) {
  const gain = b.ctx.createGain();
  gain.gain.value = 0;
  const filter = b.ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 280;
  filter.Q.value = 0.7;
  filter.connect(gain).connect(b.master);
  const oscs = SWELL.flatMap((f, i) =>
    [-6, 6].map((detune) => {
      const o = b.ctx.createOscillator();
      o.type = i === 0 ? "sine" : "triangle";
      o.frequency.value = f;
      o.detune.value = detune;
      const g = b.ctx.createGain();
      g.gain.value = i === 0 ? 0.32 : 0.12 / (1 + i * 0.15);
      o.connect(g).connect(filter);
      o.start();
      return o;
    }),
  );
  return { ctx: b.ctx, gain, filter, oscs };
}

/** While holding: `p` 0-1 opens the chord up and brings it in. 0 lets it fall away. */
export function setSwell(p: number) {
  const b = audioBus();
  if (!b) return;
  if (p <= 0 && !swell) return;
  if (!swell || swell.ctx !== b.ctx) swell = build(b);
  const t = b.ctx.currentTime;
  swell.gain.gain.setTargetAtTime(p <= 0 ? 0 : 0.05 + p * p * 0.3, t, p <= 0 ? 0.35 : 0.08);
  swell.filter.frequency.setTargetAtTime(260 + p * p * 3200, t, 0.08);
  for (const o of swell.oscs) o.detune.setTargetAtTime((o.detune.value > 0 ? 1 : -1) * (6 + p * 9), t, 0.1);
}

function stopSwell(b: Bus) {
  if (!swell) return;
  const s = swell;
  swell = null;
  const t = b.ctx.currentTime;
  s.gain.gain.cancelScheduledValues(t);
  s.gain.gain.setTargetAtTime(0, t, 0.6);
  window.setTimeout(() => s.oscs.forEach((o) => o.stop()), 4000);
}

/**
 * The touch strums a D chord; its fretted strings are synthesised (Karplus-Strong) the first time
 * they play, which is a few ms of main-thread work each at the very moment of the touch. Call this
 * any time before (it does the work in idle time, once).
 */
let warmed = false;
export function warmTouch() {
  if (warmed || typeof window === "undefined") return;
  if (!audioBus()) return; // nothing to warm until the browser lets audio run; try again later
  warmed = true;
  const run = () => [3, 4, 5].forEach((s) => warmNote(s, [0, 0, 0, 2, 3, 2][s]));
  if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 2000 });
  else window.setTimeout(run, 200);
}

/** The touch. */
export function touchSound() {
  const b = audioBus();
  if (!b) return;
  stopSwell(b);
  const t = b.ctx.currentTime;

  // a low bloom
  const boom = b.ctx.createOscillator();
  boom.type = "sine";
  boom.frequency.setValueAtTime(92, t);
  boom.frequency.exponentialRampToValueAtTime(41, t + 1.2);
  const bg = b.ctx.createGain();
  bg.gain.setValueAtTime(0.0001, t);
  bg.gain.exponentialRampToValueAtTime(0.55, t + 0.02);
  bg.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
  boom.connect(bg).connect(b.master);
  boom.start(t);
  boom.stop(t + 2.3);

  // a breath of air rushing out
  const air = b.ctx.createBufferSource();
  air.buffer = noise(b.ctx, 2.5);
  const band = b.ctx.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 0.8;
  band.frequency.setValueAtTime(3800, t);
  band.frequency.exponentialRampToValueAtTime(500, t + 2);
  const ag = b.ctx.createGain();
  ag.gain.setValueAtTime(0.0001, t);
  ag.gain.exponentialRampToValueAtTime(0.16, t + 0.04);
  ag.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
  air.connect(band).connect(ag).connect(b.master);
  air.start(t);

  // the first chord, together: a strum on the guitar and the same chord on the keys
  [0, 1, 2, 3, 4, 5].forEach((s, i) => window.setTimeout(() => pluck(s, 0.95 - i * 0.05, [0, 0, 0, 2, 3, 2][s]), 60 + i * 34));
  window.setTimeout(() => playChord(293.66, 0.85), 120);

  // and a shimmer that hangs in the air
  const shimmer = b.ctx.createGain();
  shimmer.gain.setValueAtTime(0.0001, t);
  shimmer.gain.exponentialRampToValueAtTime(0.07, t + 0.6);
  shimmer.gain.exponentialRampToValueAtTime(0.0001, t + 6);
  shimmer.connect(b.master);
  for (const f of [587.33, 880, 1174.66, 1318.5]) {
    const o = b.ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const lfo = b.ctx.createOscillator();
    lfo.frequency.value = 4 + Math.random() * 2;
    const lg = b.ctx.createGain();
    lg.gain.value = 3;
    lfo.connect(lg).connect(o.detune);
    o.connect(shimmer);
    o.start(t);
    lfo.start(t);
    o.stop(t + 6.2);
    lfo.stop(t + 6.2);
  }
}
