// Render-free state shared between a verse page's DOM layer and its 3D instrument.
// Written by GSAP / pointer handlers, read every frame inside useFrame — never React state.

export const verseState = {
  /** pointer, -1..1 (y up) */
  mouse: { x: 0, y: 0 },
  /** 0–1, the instrument's entrance (tweened by the hero timeline) */
  enter: 0,
  /** the pointer is on the instrument */
  hovered: false,
};

/** Reset between verse pages (the module object outlives a route change). */
export function resetVerseState() {
  verseState.mouse.x = 0;
  verseState.mouse.y = 0;
  verseState.enter = 0;
  verseState.hovered = false;
}
