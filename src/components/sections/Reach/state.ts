// Render-free state shared by The Reach's DOM layer (copy, the hold ring, the flood) and its 3D layer
// (the AUVOX hand, the picks, the spark, the dust). Written by GSAP tweens, the hold handlers (through
// the setters below) and the tickers — nothing here triggers a React render.

export const reach = {
  /** the section is near the viewport, so the 3D loop runs */
  inView: false,
  /** prefers-reduced-motion */
  still: false,
  /** 0-1: the AUVOX hand comes out of the clouds (scrubbed) */
  guideIn: 0,
  /** 0-1: the student's hand rises into frame (scrubbed) */
  studentIn: 0,
  /** 0-1: the clouds part and the light comes through (scrubbed) */
  open: 0,
  /** 0-1: the picks gather round the AUVOX hand (scrubbed) */
  tokens: 0,
  /** 0-1: how far a press-and-hold has brought the fingertips together */
  hold: 0,
  /** 0-1: scrolling on through the end of the scene brings them together too */
  assist: 0,
  /** the visitor is holding */
  holding: false,
  /** the ring is up, so a hold counts */
  armed: false,
  /** 0-1: the moment of touch (flash, spark) */
  touch: 0,
  /** radius of the red wave from the touch, in stage heights (0 = none) */
  flood: 0,
  /** 0-1: the picks are thrown outward by the touch */
  burst: 0,
  /** the touch has happened */
  connected: false,
  /** pointer, -1..1 (y down) */
  pointer: { x: 0, y: 0 },
  /** where the AUVOX fingertip should be, as a fraction of the stage (written by the DOM ticker) */
  tip: { x: 0.44, y: 0.44 },
  /** the middle of the gap between the fingertips, as a fraction of the stage */
  gap: { x: 0.5, y: 0.5 },
  /** the hand's length (wrist to fingertip) as a fraction of the stage height */
  handLen: 0.3,
};

/** how far the fingertips have come together, 0-1 */
export const together = () => (reach.connected ? 1 : Math.max(reach.hold, reach.assist));

/** a fresh scene every time the section mounts (this object outlives route changes) */
export function resetReach(still: boolean) {
  Object.assign(reach, {
    inView: false,
    still,
    guideIn: still ? 1 : 0,
    studentIn: still ? 1 : 0,
    open: still ? 1 : 0,
    tokens: still ? 1 : 0,
    hold: 0,
    assist: 0,
    holding: false,
    armed: still,
    touch: 0,
    flood: 0,
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
export const HOLD_SECONDS = 1.8;

if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  (window as unknown as { __reach: typeof reach }).__reach = reach;
}
