// Render-free state shared between the hero's DOM layer and its 3D world.

/** The room photo (public/hero/room.jpg) and where its stone plinth sits in it, in plate pixels. */
export const ROOM = { w: 1536, h: 1024 };
export const PLINTH = { x: 920, y: 834, w: 650 };
/** which point of the photo stays in view when the hero's aspect crops it (0–1) */
const FOCUS = { x: 0.62, y: 0.72 };

export type Verse = "guitar" | "keyboard";

export const hero = {
  /** pointer, -1..1 (y up) */
  mouse: { x: 0, y: 0 },
  /** 0–1, the instruments' entrance (tweened by the hero timeline) */
  enter: 0,
  /** which instrument the pointer is on */
  hover: null as Verse | null,
  /** where each instrument's callout line ends (px, relative to the hero) — written by the 3D world */
  anchors: { guitar: { x: 0, y: 0, on: false }, keyboard: { x: 0, y: 0, on: false } },
  /** set by the Hero component: routes to a verse page with the page transition */
  navigate: (kind: Verse) => {
    void kind;
  },
};

/** Cover-fit of the room photo into a w×h box, keeping FOCUS in view. */
export function roomFit(w: number, h: number) {
  const s = Math.max(w / ROOM.w, h / ROOM.h);
  const pw = ROOM.w * s;
  const ph = ROOM.h * s;
  const x = Math.min(0, Math.max(w - pw, w / 2 - FOCUS.x * pw));
  const y = Math.min(0, Math.max(h - ph, h / 2 - FOCUS.y * ph));
  return { s, x, y, w: pw, h: ph };
}

/** The plinth's top-centre and width in box pixels. */
export function plinthOnScreen(w: number, h: number) {
  const f = roomFit(w, h);
  return { x: f.x + PLINTH.x * f.s, y: f.y + PLINTH.y * f.s, w: PLINTH.w * f.s };
}

if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  (window as unknown as { __hero: typeof hero }).__hero = hero;
}
