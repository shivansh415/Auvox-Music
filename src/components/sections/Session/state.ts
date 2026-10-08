// Mutable, render-free state shared between the DOM layer and the 3D scene.
// Written by GSAP / ScrollTrigger, read every frame inside useFrame — never put this in React state.
export const session = {
  /** Scroll progress through the pinned section, 0–1 */
  progress: 0,
  /** Normalised pointer position, -1..1 (y up) */
  mouse: { x: 0, y: 0 },
  /** Driven by the "lights on" timeline after the preloader. red = wall light on the logo, lamp = warm desk lamp */
  lights: { red: 0, lamp: 0, ambient: 0 },
  /** Fed by the Web Audio analyser so the room can react to the guitar */
  audio: { level: 0, bands: new Float32Array(12) },
  /** 1 = show the TAP hint on the guitar */
  guitarHint: 1,
  /** Screen-space position (px) of the guitar hint, projected from the scene each frame */
  hintScreen: { x: 0, y: 0, opacity: 0 },
  /** Screen-space position (px) of the phone screen, for the play button */
  phoneScreen: { x: 0, y: 0 },
  /** Bumped to 1 when a chat message lands; the phone glow pulses with it */
  phonePulse: 0,
  /** 1 = show the TAP hint on the phone (at rest, before the push) */
  phoneHint: 1,
  /** Set when the phone itself was tapped: scroll to the push and start the chat on arrival */
  autoPlay: false,
  /** Render-loop counter (debug: confirms the canvas is actually drawing) */
  frames: 0,
};

if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  (window as unknown as { __session: typeof session }).__session = session;
}

/** Hide the TAP hint once the guitar has been touched. */
export function dismissGuitarHint() {
  session.guitarHint = 0;
}

/** Hide the TAP hint on the phone (the conversation has been opened one way or another). */
export function dismissPhoneHint() {
  session.phoneHint = 0;
}

/** The phone was tapped at rest: push in, then start the conversation on arrival. */
export function requestAutoPlay() {
  session.phoneHint = 0;
  session.autoPlay = true;
}

// ---------------------------------------------------------------------------
// Plate geometry shared by the scene and the DOM (preloader handoff, play button)
// ---------------------------------------------------------------------------
export const PLATE = { w: 1536, h: 1024 };
/** Image x (0–1) kept in view when a narrow screen crops the plate */
export const HERO_CENTER_X = 0.6;
/** Wall sign on the hero/clean plate, in plate pixels: the "auvox" wordmark box */
export const SIGN_WORDMARK = { x: 505, y: 115, w: 448, h: 104 };
/** Phone screen centre on the hero plate, in plate pixels */
export const HERO_PHONE = { x: 1080, y: 515 };

/** Cover-fit of the plate inside a viewport: plate size in px and the horizontal shift that keeps `centerX` visible. */
export function coverFit(vw: number, vh: number, centerX = HERO_CENTER_X) {
  const s = Math.max(vw / PLATE.w, vh / PLATE.h);
  const w = PLATE.w * s;
  const h = PLATE.h * s;
  const maxShift = Math.max(0, (w - vw) / 2);
  const shift = Math.min(maxShift, Math.max(-maxShift, (0.5 - centerX) * w));
  return { s, w, h, shift };
}

/** Plate pixel → viewport pixel (no zoom/parallax). */
export function plateToScreen(px: number, py: number, vw: number, vh: number) {
  const { s, w, h, shift } = coverFit(vw, vh);
  return { x: vw / 2 + shift + (px / PLATE.w - 0.5) * w, y: vh / 2 + (py / PLATE.h - 0.5) * h, s };
}
