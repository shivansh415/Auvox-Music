/**
 * Pure geometry for the Journey wave line.
 * A sine ribbon that breathes along its length, tapers to the centre at both ends and bulges toward the pointer.
 * All values are SVG px (the viewBox is kept equal to the rendered size).
 */
export type WaveState = {
  /** rendered width of the svg strip */
  w: number;
  /** rendered height of the svg strip (= the steps list) */
  h: number;
  /** seconds */
  t: number;
  /** eased pointer position in svg space */
  px: number;
  py: number;
  /** eased 0..1 pointer influence */
  strength: number;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** x of the line at height y */
export const waveX = (y: number, s: WaveState): number => {
  const cx = s.w / 2;
  const taper = clamp(Math.min(y / 180, (s.h - y) / 180), 0, 1);
  const breathe = 0.6 + 0.4 * Math.sin(y / 380 - s.t * 0.4);
  const ribbon = Math.sin(y / 44 + s.t * 1.15) * s.w * 0.11 * breathe * taper;
  const d = (y - s.py) / 140;
  const bulge = s.strength * clamp(s.px - cx, -34, 34) * Math.exp(-d * d) * taper;
  return cx + ribbon + bulge;
};

/** the full path, sampled every `step` px */
export const wavePath = (s: WaveState, step = 8): string => {
  if (s.h <= 0 || s.w <= 0) return "";
  const pts: string[] = [`M${waveX(0, s).toFixed(2)} 0`];
  for (let y = step; y < s.h; y += step) pts.push(`L${waveX(y, s).toFixed(2)} ${y}`);
  pts.push(`L${waveX(s.h, s).toFixed(2)} ${s.h.toFixed(1)}`);
  return pts.join(" ");
};
