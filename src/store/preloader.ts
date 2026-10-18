import { create } from "zustand";

type PreloaderState = {
  /** 0–100, mirrors the on-screen counter */
  progress: number;
  /**
   * true once the lockup has formed and the Enter gate is up. Until then the preloader is animating,
   * and the page's heavy 3D work (model parsing, texture uploads, shader compiles) waits, so it
   * doesn't stutter the strings and the counter.
   */
  gate: boolean;
  /** true once the preloader has fully left the screen — hero animations key off this */
  done: boolean;
  setProgress: (progress: number) => void;
  openGate: () => void;
  finish: () => void;
};

export const usePreloaderStore = create<PreloaderState>((set) => ({
  progress: 0,
  gate: false,
  done: false,
  setProgress: (progress) => set({ progress }),
  openGate: () => set({ gate: true }),
  finish: () => set({ done: true, gate: true, progress: 100 }),
}));

/** Resolves once the preloader's gate is open (or it's done / skipped). */
export function afterGate(fn: () => void) {
  const s = usePreloaderStore.getState();
  if (s.gate || s.done) {
    fn();
    return () => {};
  }
  return usePreloaderStore.subscribe((st) => {
    if (st.gate || st.done) fn();
  });
}

/** Runs `fn` in idle time once the preloader's gate is open (and at most `timeout` ms after that). */
export function idleAfterGate(fn: () => void, timeout = 2000) {
  let handle = 0;
  let fired = false;
  const run = () => {
    if (fired) return;
    fired = true;
    handle = window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout }) : window.setTimeout(fn, Math.min(timeout, 600));
  };
  const unsub = afterGate(run);
  return () => {
    unsub();
    if (!handle) return;
    if (window.cancelIdleCallback) window.cancelIdleCallback(handle);
    else window.clearTimeout(handle);
  };
}

// ---- readiness: the home page's 3D canvases say when they're warm; the preloader shows its Enter
// button once they all have (or after a timeout), so nothing heavy is left to do once you click it.

const expected = new Set<string>();
const ready = new Set<string>();
const waiters = new Set<() => void>();

/** A section declares, on mount, that its canvas will report `name` ready. */
export function expectReady(name: string) {
  expected.add(name);
}

/** A canvas reports it has finished compiling and uploading (see lib/r3f/Prewarm). */
export function markReady(name: string) {
  ready.add(name);
  if ([...expected].every((n) => ready.has(n))) waiters.forEach((w) => w());
}

/** Resolves when every expected canvas is ready, or after `timeout` ms. */
export function whenReady(timeout: number) {
  return new Promise<void>((resolve) => {
    if ([...expected].every((n) => ready.has(n))) return resolve();
    const done = () => {
      waiters.delete(done);
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, timeout);
    waiters.add(done);
  });
}
