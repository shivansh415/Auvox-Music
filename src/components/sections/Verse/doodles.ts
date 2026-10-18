// Hand-drawn ink doodles for the verse showcase (the line art that floats around the instrument, like
// the leaves and drops around a bottle in a product page). Every mark is an open stroke, drawn on with
// DrawSVG. Coordinates are in a 1000 x 1000 box centred on the instrument (0,0 is its middle).

import type { Verse } from "@/content/packages";

/** a small deterministic wobble, so the lines feel drawn by hand rather than plotted */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647 - 0.5;
  };
}
const f = (n: number) => n.toFixed(1);

/** a smooth path through points (Catmull-Rom → cubic Béziers) */
function smooth(pts: [number, number][]) {
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

/** a sound wave: a sine that swells in the middle */
export function wave(x0: number, y: number, x1: number, amp: number, waves: number, seed = 1) {
  const r = rng(seed);
  const pts: [number, number][] = [];
  const n = Math.round(waves * 8);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const env = Math.sin(Math.PI * u);
    pts.push([x0 + (x1 - x0) * u + r() * 4, y + Math.sin(u * waves * Math.PI * 2) * amp * env + r() * 3]);
  }
  return smooth(pts);
}

/** vibration: nested arcs opening to one side */
export function arcs(x: number, y: number, r0: number, n: number, gap: number, dir: number, seed = 2) {
  const rr = rng(seed);
  const out: string[] = [];
  for (let k = 0; k < n; k++) {
    const r = r0 + k * gap;
    const span = 0.55 - k * 0.06;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 8; i++) {
      const a = dir + (i / 8 - 0.5) * span * Math.PI;
      pts.push([x + Math.cos(a) * (r + rr() * 3), y + Math.sin(a) * (r + rr() * 3)]);
    }
    out.push(smooth(pts));
  }
  return out;
}

/** an eighth note: the head (a tilted loop), the stem, the flag */
export function note(x: number, y: number, s: number, seed = 3) {
  const r = rng(seed);
  const head: [number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const px = Math.cos(a) * s * 0.55;
    const py = Math.sin(a) * s * 0.36;
    head.push([x + px * 0.94 - py * 0.34 + r() * 1.2, y + px * 0.34 + py * 0.94 + r() * 1.2]);
  }
  const sx = x + s * 0.5;
  return [
    smooth(head),
    `M${f(sx)} ${f(y - s * 0.1)} L${f(sx + r() * 2)} ${f(y - s * 2.1)}`,
    smooth([
      [sx, y - s * 2.1],
      [sx + s * 0.45, y - s * 1.75],
      [sx + s * 0.75, y - s * 1.35],
      [sx + s * 0.55, y - s * 0.95],
    ]),
  ];
}

/** a guitar pick, outlined */
export function pick(x: number, y: number, s: number, rot: number) {
  const c = Math.cos(rot);
  const si = Math.sin(rot);
  const p = (px: number, py: number): [number, number] => [x + (px * c - py * si) * s, y + (px * si + py * c) * s];
  return smooth([p(0, -0.55), p(0.4, -0.38), p(0.46, 0.05), p(0.22, 0.42), p(0, 0.56), p(-0.22, 0.42), p(-0.46, 0.05), p(-0.4, -0.38), p(0, -0.55)]);
}

/** a four-point sparkle */
export function sparkle(x: number, y: number, s: number) {
  return [`M${f(x)} ${f(y - s)} Q${f(x + s * 0.12)} ${f(y - s * 0.12)} ${f(x + s)} ${f(y)} Q${f(x + s * 0.12)} ${f(y + s * 0.12)} ${f(x)} ${f(y + s)} Q${f(x - s * 0.12)} ${f(y + s * 0.12)} ${f(x - s)} ${f(y)} Q${f(x - s * 0.12)} ${f(y - s * 0.12)} ${f(x)} ${f(y - s)}`];
}

/** a loose spiral */
export function swirl(x: number, y: number, r: number, turns: number, seed = 4) {
  const rr = rng(seed);
  const pts: [number, number][] = [];
  const n = Math.round(turns * 14);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = u * turns * Math.PI * 2;
    const rad = r * (0.15 + 0.85 * u);
    pts.push([x + Math.cos(a) * rad + rr() * 3, y + Math.sin(a) * rad + rr() * 3]);
  }
  return smooth(pts);
}

/** a stave: five gently wavy lines */
export function staff(x0: number, y: number, x1: number, gap: number, seed = 5) {
  const out: string[] = [];
  for (let k = 0; k < 5; k++) {
    const r = rng(seed + k);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 6; i++) {
      const u = i / 6;
      pts.push([x0 + (x1 - x0) * u, y + k * gap + Math.sin(u * Math.PI * 1.4 + k) * 6 + r() * 2]);
    }
    out.push(smooth(pts));
  }
  return out;
}

/** a dotted trail (drawn as short dashes) */
export function trail(pts: [number, number][]) {
  return smooth(pts);
}

/** one chapter's marks (open strokes) and which of them are dotted */
export type DoodleSet = { solid: string[]; dotted: string[] };

export const DOODLES: Record<Verse, DoodleSet[]> = {
  guitar: [
    // the intro: the strings ring out
    { solid: [...arcs(150, -250, 70, 3, 34, -0.35, 11), ...note(-330, -300, 34, 12), ...sparkle(330, 210, 26)], dotted: [trail([[-380, 260], [-300, 330], [-170, 350], [-60, 300]])] },
    // built for beginners: a first pick, a first note
    { solid: [pick(330, -230, 120, 0.4), ...note(-360, 140, 30, 21), ...sparkle(-260, -320, 20)], dotted: [trail([[260, -110], [320, 40], [280, 200], [200, 300]])] },
    // guided by musicians: the sound travels
    { solid: [wave(-440, -330, -40, 34, 3, 31), ...note(360, 280, 36, 32), ...note(420, 120, 24, 33)], dotted: [trail([[-420, 300], [-320, 360], [-200, 340]])] },
    // shape your sound: a swirl of your own
    { solid: [swirl(-360, -260, 90, 2.2, 41), ...sparkle(380, -300, 30), wave(120, 330, 460, 26, 2.5, 42)], dotted: [trail([[-430, 120], [-380, 240], [-280, 320]])] },
  ],
  piano: [
    { solid: [...staff(-470, -360, -60, 22, 51), ...note(300, -290, 32, 52), ...sparkle(380, 260, 24)], dotted: [trail([[-380, 300], [-260, 360], [-120, 330]])] },
    { solid: [...note(-380, -220, 34, 61), ...note(-300, -300, 24, 62), ...arcs(330, 230, 60, 3, 30, 0.6, 63)], dotted: [trail([[220, -320], [330, -250], [400, -140]])] },
    { solid: [wave(80, -360, 470, 30, 3, 71), ...sparkle(-380, 280, 28), ...note(-420, -180, 30, 72)], dotted: [trail([[-200, 360], [-80, 400], [60, 380]])] },
    { solid: [swirl(370, -250, 80, 2.1, 81), ...staff(-460, 300, -120, 18, 82), ...sparkle(-360, -330, 22)], dotted: [trail([[150, 330], [280, 360], [400, 300]])] },
  ],
};

/** The organic shapes the colour blob moves through, one per chapter (a 1000 x 1000 box, centred). */
export function blob(seed: number, r = 330, wobble = 0.22, points = 9) {
  const rr = rng(seed);
  const pts: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const k = 1 + rr() * 2 * wobble;
    pts.push([Math.cos(a) * r * k, Math.sin(a) * r * k * 0.92]);
  }
  // close the loop smoothly
  const loop = [...pts.slice(-2), ...pts, ...pts.slice(0, 3)];
  let d = "";
  for (let i = 2; i < loop.length - 3; i++) {
    const p0 = loop[i - 1], p1 = loop[i], p2 = loop[i + 1], p3 = loop[i + 2];
    if (i === 2) d = `M${f(p1[0])} ${f(p1[1])}`;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + " Z";
}
