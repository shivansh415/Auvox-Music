// Render-free state shared between the reserve page's DOM and its 3D ghost instrument.

export type DemoInstrument = "guitar" | "keyboard";

export const reserve = {
  /** pointer, -1..1 (y up) — written by the page, read by the 3D rig every frame */
  mouse: { x: 0, y: 0 },
};
