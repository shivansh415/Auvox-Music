"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { gsap } from "@/lib/gsap";
import { prewarming } from "./Prewarm";

const debug: Record<string, string> = {};
if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  (window as unknown as { __pause: typeof debug }).__pause = debug;
}

/**
 * Stops a canvas's render loop while it is off-screen or the tab is hidden, and restarts it when it
 * comes back. The default margin is slightly negative on purpose: IntersectionObserver counts a canvas
 * that merely touches the viewport edge as visible, and two full-screen canvases rendering together
 * (splash + hero) was the main cause of the lag. The first `warmMs` after mount always render, so models load and shaders compile before
 * the canvas is first scrolled to (no hitch on arrival).
 */
export default function PauseOffscreen({
  name = "canvas",
  margin = "-2px",
  warmMs = 2500,
  coveredWhen,
}: {
  name?: string;
  margin?: string;
  warmMs?: number;
  /** extra condition for "nobody can see this" — e.g. another layer sits on top of it */
  coveredWhen?: () => boolean;
}) {
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);

  useEffect(() => {
    const el = gl.domElement;
    let visible = true;
    let warm = true;
    let covered = false;
    const apply = () => {
      // a Prewarm is holding this canvas's loop; it re-applies when it lets go
      if (prewarming.has(el)) return;
      const next = (visible || warm) && !covered && !document.hidden ? "always" : "never";
      const state = get();
      debug[name] = next;
      if (state.frameloop === next) return;
      state.setFrameloop(next);
      // R3F's shared loop stops once every root is idle — kick it so this one starts drawing again
      if (next === "always") state.invalidate();
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        apply();
      },
      { rootMargin: margin },
    );
    io.observe(el);
    const warmTimer = window.setTimeout(() => {
      warm = false;
      apply();
    }, warmMs);
    document.addEventListener("visibilitychange", apply);
    el.addEventListener("prewarmed", apply);
    // polled on the GSAP ticker (it keeps running while the canvas loop is paused)
    const poll = () => {
      const c = !!coveredWhen?.();
      if (c === covered) return;
      covered = c;
      apply();
    };
    if (coveredWhen) gsap.ticker.add(poll);
    return () => {
      el.removeEventListener("prewarmed", apply);
      if (coveredWhen) gsap.ticker.remove(poll);
      io.disconnect();
      window.clearTimeout(warmTimer);
      document.removeEventListener("visibilitychange", apply);
    };
  }, [gl, get, name, margin, warmMs, coveredWhen]);

  return null;
}
