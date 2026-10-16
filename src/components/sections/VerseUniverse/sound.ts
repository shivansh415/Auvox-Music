"use client";

// The turntable's own sounds, voiced through the site's audio bus (so the global mute, the warmth
// filter and the analyser apply): surface crackle while the stylus is down, the scratch while the
// record is pushed off its speed, and the small mechanical sounds of the tonearm. All synthesised —
// nothing to download. Every call is a no-op until the browser has let audio run.

import { audioBus } from "@/components/sections/Session/audio";

type Bus = NonNullable<ReturnType<typeof audioBus>>;

let owner: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let crackle: GainNode | null = null;
let crackleOn = false;
let scratch: { gain: GainNode; band: BiquadFilterNode; osc: OscillatorNode } | null = null;
let scratchLevel = 0;

/** the nodes belong to one AudioContext; if the site ever makes a new one, start over */
function bus(): Bus | null {
  const b = audioBus();
  if (!b) return null;
  if (owner !== b.ctx) {
    owner = b.ctx;
    noise = null;
    crackle = null;
    crackleOn = false;
    scratch = null;
    scratchLevel = 0;
  }
  return b;
}

function whiteNoise(ctx: AudioContext) {
  if (noise) return noise;
  const len = ctx.sampleRate * 2;
  noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noise;
}

/** five seconds of surface: a low hiss and sparse clicks and pops, looped */
function surface(ctx: AudioContext) {
  const sr = ctx.sampleRate;
  const len = sr * 5;
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  let lp = 0;
  for (let i = 0; i < len; i++) {
    lp += (Math.random() * 2 - 1 - lp) * 0.08;
    d[i] = lp * 0.05;
  }
  for (let k = 0; k < 90; k++) {
    const at = (Math.random() * (len - 200)) | 0;
    const amp = Math.random() ** 3 * 0.9 + 0.05;
    const sign = Math.random() < 0.5 ? -1 : 1;
    const n = 20 + ((Math.random() * 60) | 0);
    for (let j = 0; j < n; j++) d[at + j] += sign * amp * Math.exp(-j / (n * 0.25)) * (j % 2 ? -0.6 : 1);
  }
  return buf;
}

/** Surface noise on or off (call freely; it only acts on a change). */
export function setCrackle(on: boolean) {
  if (on === crackleOn) return;
  const b = bus();
  if (!b) return;
  if (!crackle) {
    const src = b.ctx.createBufferSource();
    src.buffer = surface(b.ctx);
    src.loop = true;
    const hp = b.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 900;
    crackle = b.ctx.createGain();
    crackle.gain.value = 0;
    src.connect(hp).connect(crackle).connect(b.master);
    src.start();
  }
  crackleOn = on;
  crackle.gain.setTargetAtTime(on ? 0.22 : 0, b.ctx.currentTime, on ? 0.4 : 0.12);
}

/** The scratch: `speed` is how far the record is off its own speed, in degrees per second. */
export function setScratch(speed: number) {
  const level = Math.min(1, Math.max(0, (speed - 25) / 420));
  if (level === 0 && scratchLevel === 0) return;
  const b = bus();
  if (!b) return;
  if (!scratch) {
    const src = b.ctx.createBufferSource();
    src.buffer = whiteNoise(b.ctx);
    src.loop = true;
    const band = b.ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 1.4;
    const osc = b.ctx.createOscillator();
    osc.type = "sawtooth";
    const lp = b.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    const oscGain = b.ctx.createGain();
    oscGain.gain.value = 0.35;
    const gain = b.ctx.createGain();
    gain.gain.value = 0;
    src.connect(band).connect(gain);
    osc.connect(lp).connect(oscGain).connect(gain);
    gain.connect(b.master);
    src.start();
    osc.start();
    scratch = { gain, band, osc };
  }
  const t = b.ctx.currentTime;
  const s = Math.min(speed, 1500);
  scratch.gain.gain.setTargetAtTime(level ** 1.3 * 0.32, t, 0.025);
  scratch.band.frequency.setTargetAtTime(380 + s * 3.2, t, 0.02);
  scratch.osc.frequency.setTargetAtTime(70 + s * 0.55, t, 0.02);
  scratchLevel = level;
}

function burst(b: Bus, seconds: number, freq: number, gainValue: number, when = 0) {
  const src = b.ctx.createBufferSource();
  src.buffer = whiteNoise(b.ctx);
  const hp = b.ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = freq;
  const g = b.ctx.createGain();
  const t0 = b.ctx.currentTime + when;
  g.gain.setValueAtTime(gainValue, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
  src.connect(hp).connect(g).connect(b.master);
  src.start(t0, Math.random());
  src.stop(t0 + seconds + 0.02);
}

/** The stylus meeting the record: a soft low thump and the tick of the needle. */
export function needleDrop() {
  const b = bus();
  if (!b) return;
  const t = b.ctx.currentTime;
  const osc = b.ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(64, t);
  osc.frequency.exponentialRampToValueAtTime(38, t + 0.3);
  const g = b.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
  osc.connect(g).connect(b.master);
  osc.start(t);
  osc.stop(t + 0.4);
  burst(b, 0.03, 2200, 0.22);
}

/** The arm lifting off: just a light mechanical tick. */
export function armLift() {
  const b = bus();
  if (!b) return;
  burst(b, 0.018, 3200, 0.12);
}
