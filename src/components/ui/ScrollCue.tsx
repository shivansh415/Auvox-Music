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
    let dark = false;
    const update = () => {
      // light ink over peach, peach over dark sections — read what sits under the cue (no blend mode)
      const under = document.elementFromPoint(window.innerWidth / 2, window.innerHeight - 40);
      const nextDark = !!under?.closest("[data-theme='dark']");
      if (nextDark !== dark) {
        dark = nextDark;
        el.dataset.dark = dark ? "1" : "0";
      }
      const nearEnd = lenis.limit > 0 && lenis.scroll > lenis.limit - window.innerHeight * 0.6;
      const locked = document.documentElement.dataset.overlay === "1";
      // out of the way while typing in a form (on phones it would sit over the fields)
      const typing = !!document.activeElement?.matches("input, textarea, select");
      const next = !nearEnd && !locked && !typing && lenis.limit > 10;
      if (next !== shown) {
        shown = next;
        gsap.to(el, { autoAlpha: next ? 1 : 0, y: next ? 0 : 10, duration: 0.5, ease: "power2.out" });
      }
    };
    let raf = 0;
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(() => ((raf = 0), update()));
    };
    lenis.on("scroll", onScroll);
    document.addEventListener("focusin", onScroll);
    document.addEventListener("focusout", onScroll);
    const id = window.setInterval(update, 600);
    update();
    return () => {
      lenis.off("scroll", onScroll);
      document.removeEventListener("focusin", onScroll);
      document.removeEventListener("focusout", onScroll);
      window.clearInterval(id);
      cancelAnimationFrame(raf);
    };
  }, [lenis]);

  return (
    <div ref={ref} className="scroll-cue pointer-events-none fixed bottom-6 left-1/2 z-[80] flex -translate-x-1/2 flex-col items-center gap-2 text-ink/70 transition-colors duration-500 data-[dark=1]:text-peach/80">
      <span className="text-[0.55rem] tracking-[0.4em] uppercase">Scroll</span>
      <span className="flex h-8 w-5 justify-center rounded-full border border-current pt-1.5">
        <span className="scroll-dot block h-1 w-1 rounded-full bg-current" />
      </span>
    </div>
  );
}
