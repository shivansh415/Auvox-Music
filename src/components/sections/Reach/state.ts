// Render-free state shared by The Reach's DOM layer (copy, the hold ring) and its 3D layer (the fog,
// the sky, the AUVOX hand, the picks, the petals, the student's hand, the grade). Written by GSAP
// tweens, the hold handlers (through the setters below) and the tickers — nothing here triggers a
// React render.

export const reach = {
  /** the section is near the viewport, so the 3D loop runs */
  inView: false,
  /** prefers-reduced-motion */
  still: false,

  // ---- scrubbed by the scroll
  /** 1-0: the fog we start in (1 = all light, 0 = the sky is clear) */
  fog: 1,
  /** 1-0: the glow below, in the fog, that the hand reaches down toward */
  light: 1,
  /** 0-1: the AUVOX hand comes down out of the light */
  descend: 0,
  /** 0-1: the hand turns from reaching down to reaching across */
  turn: 0,
  /** 0-1: the scene opens: the sky, the rays, the clouds, the petals */
  open: 0,
  /** 0-1: the picks gather round the hand */
  tokens: 0,
  /** 0-1: the student's hand rises into frame */
  studentIn: 0,
  /** 0-1: scrolling on through the end of the scene brings the fingertips together too */
  assist: 0,

  // ---- the hold and the touch
  /** 0-1: how far a press-and-hold has brought the fingertips together */
  hold: 0,
  /** the visitor is holding */
  holding: false,
  /** the ring is up, so a hold counts */
  armed: false,
  /** 0-1: the moment of touch (flash, spark) */
  touch: 0,
  /** radius of the red wave from the touch, in stage heights (0 = none) */
  flood: 0,
  /** 0-1: the grade has gone crimson */
  red: 0,
  /** 0-1: the picks are thrown outward by the touch */
  burst: 0,
  /** the touch has happened */
  connected: false,

  // ---- layout (written by the DOM ticker, read by the 3D layer)
  /** pointer, -1..1 (y down) */
  pointer: { x: 0, y: 0 },
  /** where the AUVOX fingertip should be, as a fraction of the stage (x right, y down) */
  tip: { x: 0.5, y: -0.3 },
  /** where the student's fingertip should be, as a fraction of the stage */
  studentTip: { x: 0.6, y: 0.9 },
  /** the middle of the gap between the fingertips, as a fraction of the stage */
  gap: { x: 0.5, y: 0.47 },
  /** the hand's length (wrist to fingertip) as a fraction of the stage height */
  handLen: 0.34,
  /** the stage's aspect ratio */
  aspect: 1.6,
};

/** how far the fingertips have come together, 0-1 */
export const together = () => (reach.connected ? 1 : Math.max(reach.hold, reach.assist));

/** a fresh scene every time the section mounts (this object outlives route changes) */
export function resetReach(still: boolean) {
  Object.assign(reach, {
    inView: false,
    still,
    fog: still ? 0 : 1,
    light: still ? 0 : 1,
    descend: still ? 1 : 0,
    turn: still ? 1 : 0,
    open: still ? 1 : 0,
    tokens: 0,
    studentIn: still ? 1 : 0,
    assist: 0,
    hold: 0,
    holding: false,
    armed: still,
    touch: 0,
    flood: 0,
    red: 0,
    burst: 0,
    connected: false,
  });
}

export function setHolding(on: boolean) {
  reach.holding = on && reach.armed && !reach.connected;
}

export function setPointer(x: number, y: number) {
  reach.pointer.x = x;
  reach.pointer.y = y;
}

/** how long a full hold takes, seconds */
export const HOLD_SECONDS = 1.6;

if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  (window as unknown as { __reach: typeof reach }).__reach = reach;
}
