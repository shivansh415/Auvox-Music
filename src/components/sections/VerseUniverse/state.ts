// Render-free state shared between the Verse Universe's DOM layer (hit areas, labels, the drag
// surface, the "now spinning" readout) and its 3D layer (the record, the tonearm, the instruments).
// Nothing in here triggers a React render: the GSAP ticker and the R3F frame loop read and write it.

import type { Verse } from "@/content/packages";

export type NodeKey = Verse | "drum" | "production";

export type VerseNode = {
  label: string;
  /** resting position on the disc, degrees clockwise from 3 o'clock */
  angle: number;
} & (
  | { key: Verse; /** a verse that exists today: solid, opens its intro */ active: true }
  | { key: "drum" | "production"; /** still to come: dashed, ghosted */ active: false }
);

// the two verses that exist, opposite each other on the record (the future ones are left off until they're real)
export const NODES: readonly VerseNode[] = [
  { key: "guitar", label: "Guitar Verse", active: true, angle: -64 },
  { key: "piano", label: "Piano Verse", active: true, angle: 116 },
];

export const NODE_BY_KEY = Object.fromEntries(NODES.map((n) => [n.key, n])) as Record<NodeKey, VerseNode>;

// ---------------------------------------------------------------------------------------------
// Geometry. Everything below is a fraction of the disc box's side, so the DOM and the 3D agree.
// ---------------------------------------------------------------------------------------------

/** the record's radius (it sits 2% inside the box) */
export const PLATE_R = 0.48;
/** the paper label in the middle */
export const LABEL_R = 0.125;
/** the ring of type around the label */
export const TEXT_R = 0.157;
/** the circle the verses ride */
export const ORBIT = 0.265;
/** the pucks the verses stand on */
export const PUCK_R = 0.085;
/** labels sit this far outside each node */
export const TAG_OFFSET = 0.128;

/** The canvas bleeds past the box on every side so the tilt, the tonearm and the shadows never clip. */
export const BLEED = 1.3;

export const FOV = 30;
export const CAM_Z = 9;
/** world units visible top-to-bottom at z = 0 — the canvas height */
export const VIEW_H = 2 * CAM_Z * Math.tan(((FOV / 2) * Math.PI) / 180);
/** the disc box's side in world units */
export const U = VIEW_H / BLEED;

/** The tonearm: pivot in the top-right corner, stylus resting on the outer grooves at about 3 o'clock. */
export const ARM_PIVOT = { x: 0.47, y: 0.4 };
export const ARM_LEN = 0.42;
const STYLUS_R = 0.4;
const STYLUS_AT = -2 * (Math.PI / 180);
const PLAY = { x: Math.cos(STYLUS_AT) * STYLUS_R, y: Math.sin(STYLUS_AT) * STYLUS_R };
/** arm direction (radians, y up) when it plays, and when it rests off the record */
export const ARM_PLAY = Math.atan2(PLAY.y - ARM_PIVOT.y, PLAY.x - ARM_PIVOT.x);
export const ARM_REST = ARM_PLAY + 0.52;
/** where the stylus meets the record, degrees clockwise from 3 o'clock (screen) */
export const NEEDLE_DEG = -(STYLUS_AT * 180) / Math.PI;

// ---------------------------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------------------------

/** 33⅓ it is not — a slow, readable turn. Degrees per second. */
export const SPIN_SPEED = 7.5;
/** how much extra rotation a full scroll through the section adds, degrees */
export const SCRUB_DEGREES = 150;

export const DEG = Math.PI / 180;

/** brand colours as 0–1 RGB, for the shader */
export const TONE: Record<NodeKey | "needle", [number, number, number]> = {
  guitar: [0.78, 0.16, 0.12],
  piano: [0.95, 0.72, 0.47],
  drum: [0.75, 0.7, 0.66],
  production: [0.75, 0.7, 0.66],
  needle: [0.98, 0.86, 0.68],
};

type Anchor = { x: number; y: number; on: boolean };
type Ripple = { x: number; y: number; t0: number; strength: number; tone: [number, number, number] };

export const disc = {
  /** rotation, degrees: integrated from `vel` by the DOM ticker, or written directly while dragging */
  spin: 0,
  /** extra rotation scrubbed in by scroll, degrees (tweened by a ScrollTrigger) */
  scrub: 0,
  /** current angular velocity, degrees per second */
  vel: 0,
  /** 0–1, the platter motor: 0 is still, 1 is SPIN_SPEED */
  motor: 0,
  /** 0–1, the instruments scale in with it */
  enter: 0,
  /** 0–1, the grooves cut outward from the label to the rim */
  reveal: 0,
  /** 0–1, the scroll-in tilt: 0 is seen from low and far, 1 is face-on */
  tilt: 0,
  /** the tonearm: swing 0 = resting off the record, 1 = over the grooves; lift 1 = raised, 0 = playing */
  arm: { swing: 0, lift: 1 },
  /** the stylus is in the groove */
  needleDown: false,
  /** the visitor has hold of the record */
  dragging: false,
  /** which node the pointer is on */
  hover: null as NodeKey | "core" | null,
  /** a verse sheet is open: its instrument lifts to the centre of the record */
  focus: null as Verse | null,
  /** pointer relative to the box centre, in box sides (y down), and whether it is over the section */
  pointer: { x: 0, y: 0, on: false },
  /** the section is near the viewport, so the 3D loop and the ticker run */
  inView: false,
  /** prefers-reduced-motion: no idle spin, no tilt, no ripples */
  still: false,
  /** the 3D layer has drawn at least one frame (the CSS stand-in record can go) */
  gl: false,
  /** smoothed output level of the site's audio bus, 0–1 */
  level: 0,
  /** waves running through the grooves; positions in record radii (y up) */
  ripples: [] as Ripple[],
  /** each node's orbit point and the record's centre, in disc-box pixels — written by the 3D layer */
  anchors: {
    guitar: { x: 0, y: 0, on: false },
    piano: { x: 0, y: 0, on: false },
    drum: { x: 0, y: 0, on: false },
    production: { x: 0, y: 0, on: false },
    core: { x: 0, y: 0, on: false },
  } as Record<NodeKey | "core", Anchor>,
};

/** the disc's total rotation right now, degrees */
export const discAngle = () => disc.spin + disc.scrub;

/** a node's position on the record right now, in record radii (y up) */
export function nodePoint(key: NodeKey) {
  const t = (discAngle() + NODE_BY_KEY[key].angle) * DEG;
  const r = ORBIT / PLATE_R;
  return { x: Math.cos(t) * r, y: -Math.sin(t) * r };
}

/** the stylus position, in record radii (y up) */
export function stylusPoint() {
  const a = ARM_REST + (ARM_PLAY - ARM_REST) * disc.arm.swing;
  return { x: (ARM_PIVOT.x + Math.cos(a) * ARM_LEN) / PLATE_R, y: (ARM_PIVOT.y + Math.sin(a) * ARM_LEN) / PLATE_R };
}

/** send a wave through the grooves from (x, y), in record radii */
export function ripple(x: number, y: number, tone: [number, number, number], strength = 1) {
  if (disc.still) return;
  disc.ripples.push({ x, y, t0: performance.now() / 1000, strength, tone });
  if (disc.ripples.length > 6) disc.ripples.shift();
}

/** which node the pointer is on (event handlers write it through here, so nothing mutates during render) */
export function setHover(key: NodeKey | "core" | null) {
  disc.hover = key;
}

export function setFocus(key: Verse | null) {
  disc.focus = key;
}

/** a fresh turntable: the record unseen and uncut, the arm on its rest, the platter still */
export function resetDisc(still: boolean) {
  Object.assign(disc, { still, spin: 0, scrub: 0, vel: 0, motor: 0, enter: 0, reveal: 0, tilt: still ? 1 : 0, needleDown: false, dragging: false, hover: null, focus: null, gl: false });
  disc.arm.swing = 0;
  disc.arm.lift = 1;
  disc.ripples.length = 0;
  for (const a of Object.values(disc.anchors)) a.on = false;
}

/** the visitor takes hold of the record, or lets go */
export function setDragging(on: boolean) {
  disc.dragging = on;
}

/** the hand turns the record by `delta` degrees over `dt` seconds */
export function turnBy(delta: number, dt: number) {
  disc.spin += delta;
  disc.vel = Math.min(1500, Math.max(-1500, disc.vel * 0.55 + (delta / dt) * 0.45));
}

// "now spinning": the node that last passed under the needle. A tiny emitter so only the readout re-renders.
type NowListener = (key: NodeKey) => void;
const nowListeners = new Set<NowListener>();
export function onNowSpinning(fn: NowListener) {
  nowListeners.add(fn);
  return () => {
    nowListeners.delete(fn);
  };
}
export function emitNowSpinning(key: NodeKey) {
  nowListeners.forEach((fn) => fn(key));
}

if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  (window as unknown as { __disc: typeof disc }).__disc = disc;
}
