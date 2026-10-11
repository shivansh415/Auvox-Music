"use client";

import { useEffect, useRef } from "react";
import { useLenis } from "lenis/react";
import { gsap } from "@/lib/gsap";

/** The constant scroll cue (client rule). Fades out near the bottom of the page and while a menu/overlay is open. */
export default function ScrollCue() {
  const ref = useRef<HTMLDivElement>(null);
  const lenis = useLenis();

  useEffect(() => {
    const el = ref.current;
    if (!el || !lenis) return;
    let shown = true;
    const update = () => {
      const nearEnd = lenis.limit > 0 && lenis.scroll > lenis.limit - window.innerHeight * 0.6;
      const locked = document.documentElement.dataset.overlay === "1";
      const next = !nearEnd && !locked && lenis.limit > 10;
      if (next !== shown) {
        shown = next;
        gsap.to(el, { autoAlpha: next ? 1 : 0, y: next ? 0 : 10, duration: 0.5, ease: "power2.out" });
      }
    };
    lenis.on("scroll", update);
    const id = window.setInterval(update, 400);
    update();
    return () => {
      lenis.off("scroll", update);
      window.clearInterval(id);
    };
  }, [lenis]);

  return (
    <div ref={ref} className="scroll-cue pointer-events-none fixed bottom-6 left-1/2 z-[80] flex -translate-x-1/2 flex-col items-center gap-2 mix-blend-difference">
      <span className="text-[0.55rem] tracking-[0.4em] text-white/80 uppercase">Scroll</span>
      <span className="flex h-8 w-5 justify-center rounded-full border border-white/70 pt-1.5">
        <span className="scroll-dot block h-1 w-1 rounded-full bg-white" />
      </span>
    </div>
  );
}
