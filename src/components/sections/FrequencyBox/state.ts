// Render-free state shared between the Frequency Box section (GSAP) and its 3D stage (R3F).
// Everything here is written from tweens, pointer handlers and useFrame — never from render.

export const fbox = {
  /** 0–1 entrance: rises, scales in, one full turn (tweened on scroll-enter) */
  enter: 0,
  /** 0–1 scroll progress through the section (scrubbed) — adds rotation */
  scroll: 0,
  /** 0–1 position of the light sweep that crosses the box on entrance */
  sweep: 0,
  /** 1 = do the full turn on entrance, 0 = reduced motion */
  turnIn: 1,
  /** idle spin speed, rad/s */
  idleSpeed: 0.22,
  /** accumulated idle rotation, rad */
  idle: 0,
  /** 0–1, the idle spin fades out while dragging and back in after */
  idleGain: 1,

  // --- drag (pointer handlers write, useFrame reads)
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

/** a push on the spin (the edition switch turns the box; inertia slows it back to idle) */
export function nudge(amount: number) {
  fbox.vel += amount;
}
