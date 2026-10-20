// Render-free state shared between the Frequency Box section (GSAP) and its 3D stage (R3F).
// Everything here is written from tweens, pointer handlers and useFrame — never from render.

export const fbox = {
  /**
   * 0–1 through the pinned film, scrubbed (and smoothed) by the scroll. Every camera, light, box,
   * panel and pedestal value is a pure function of this, so the film plays the same forwards,
   * backwards, fast or slow.
   */
  progress: 0,
  /** 1 = reduced motion: no film, the final frame only */
  still: 0,

  // --- drag (pointer handlers write, useFrame reads): a turn on top of the film's own
  dragging: false,
  /** accumulated drag rotation, rad */
  spin: 0,
  /** drag velocity, rad/s — decays after release (inertia) */
  vel: 0,
  /** vertical drag tilt and where it is easing to */
  tilt: 0,
  tiltTarget: 0,
  lastX: 0,
  lastY: 0,
  lastT: 0,
};

if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  (window as unknown as { __fbox: typeof fbox }).__fbox = fbox;
}

/** a push on the spin (the edition switch turns the box; inertia slows it back) */
export function nudge(amount: number) {
  fbox.vel += amount;
}

type Key = readonly [number, number];
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** a value along keyframes [[progress, value], ...], eased between neighbours, held past the ends */
export function kf(p: number, keys: readonly Key[], ease: (t: number) => number = smooth) {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, va] = keys[i];
    const [b, vb] = keys[i + 1];
    if (p <= b) return va + (vb - va) * ease((p - a) / (b - a));
  }
  return keys[keys.length - 1][1];
}
