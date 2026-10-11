"use client";

import type { RefObject } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

export const prefersReduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Staggered rise-in of `selector` children when `scope` scrolls into view (once). Reduced motion keeps the fade. */
export function useReveal(scope: RefObject<HTMLElement | null>, selector: string, stagger = 0.08) {
  useGSAP(
    () => {
      const el = scope.current;
      if (!el) return;
      const targets = gsap.utils.toArray<HTMLElement>(selector, el);
      if (!targets.length) return;
      const reduced = prefersReduced();
      gsap.fromTo(
        targets,
        { y: reduced ? 0 : 32, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 1.2, ease: "expo.out", stagger, scrollTrigger: { trigger: el, start: "top 75%", once: true } },
      );
    },
    { scope },
  );
}
