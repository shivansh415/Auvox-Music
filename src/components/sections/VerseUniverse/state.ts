// Render-free state shared between the Verse Universe's DOM layer (the disc, its nodes and labels)
// and its 3D layer (the live guitar and keyboard). Nothing in here triggers a React render: the
// ticker and the R3F frame loop read and write it directly.

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

export const NODES: readonly VerseNode[] = [
  { key: "guitar", label: "Guitar Verse", active: true, angle: -64 },
  { key: "piano", label: "Piano Verse", active: true, angle: 26 },
  { key: "drum", label: "Drum Verse", active: false, angle: 116 },
  { key: "production", label: "Production Verse", active: false, angle: 206 },
];

export const NODE_BY_KEY = Object.fromEntries(NODES.map((n) => [n.key, n])) as Record<NodeKey, VerseNode>;

/** Verse nodes orbit at this fraction of the disc box's height (the canvas's visible height at z = 0). */
export const ORBIT = 0.265;
/** labels sit this far outside each node, as a fraction of the box */
export const TAG_OFFSET = 0.128;

export const FOV = 30;
export const CAM_Z = 9;
/** world units visible top-to-bottom at z = 0, i.e. the disc box's height in 3D units */
export const VIEW_H = 2 * CAM_Z * Math.tan(((FOV / 2) * Math.PI) / 180);

/** idle spin, degrees per second */
export const SPIN_SPEED = 7.5;
/** how much extra rotation a full scroll through the section adds, degrees */
export const SCRUB_DEGREES = 150;

export const DEG = Math.PI / 180;

type Anchor = { x: number; y: number; on: boolean };

export const disc = {
  /** idle rotation, degrees (accumulated by the DOM ticker) */
  spin: 0,
  /** extra rotation scrubbed in by scroll, degrees (tweened by a ScrollTrigger) */
  scrub: 0,
  /** 0–1, the disc's entrance (the models scale in with it) */
  enter: 0,
  /** which node the pointer is on */
  hover: null as NodeKey | null,
  /** the section is near the viewport, so the 3D loop and the ticker run */
  inView: false,
  /** prefers-reduced-motion: no idle spin, no scrub, no bobbing */
  still: false,
  /** each node's orbit point in disc-box pixels — written by the 3D layer every frame */
  anchors: {
    guitar: { x: 0, y: 0, on: false },
    piano: { x: 0, y: 0, on: false },
    drum: { x: 0, y: 0, on: false },
    production: { x: 0, y: 0, on: false },
  } as Record<NodeKey, Anchor>,
};

/** the disc's total rotation right now, degrees */
export const discAngle = () => disc.spin + disc.scrub;

/** which node the pointer is on (event handlers write it through here, so nothing mutates during render) */
export function setHover(key: NodeKey | null) {
  disc.hover = key;
}

if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  (window as unknown as { __disc: typeof disc }).__disc = disc;
}
