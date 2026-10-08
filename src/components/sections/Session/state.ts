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
  /** Screen-space position (px) of the guitar hint, projected from the 3D scene each frame */
  hintScreen: { x: 0, y: 0, opacity: 0 },
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
