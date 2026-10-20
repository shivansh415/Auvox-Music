"use client";

import { useEffect, useRef } from "react";
import { useLenis } from "lenis/react";
import { gsap } from "@/lib/gsap";

// what counts as content the cue must not sit on: words, controls, fields, pictures
const CONTENT = "a, button, input, textarea, select, label, p, h1, h2, h3, h4, h5, h6, li, dt, dd, span, em, strong, img, svg, [role='radio']";

/**
 * Whether anything the visitor reads or uses lies under the cue's box. Samples a few points across it
 * (elementsFromPoint skips the cue itself: it is pointer-events: none) and ignores layout boxes —
 * sections, wrappers, canvases — so it only steps aside for real content.
 */
function collides(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const pad = 6;
  const xs = [r.left - pad, r.left + r.width / 2, r.right + pad];
  const ys = [r.top - pad, r.top + r.height / 2, r.bottom + pad];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  for (const x of xs) {
    for (const y of ys) {
      const hit = document.elementFromPoint(x, y);
      if (!hit || hit === document.body || hit === document.documentElement) continue;
      const c = hit.closest(CONTENT);
      if (!c) continue;
      // a big decorative word or a full-width block is a background, not content
      const cr = c.getBoundingClientRect();
      if (cr.width * cr.height > vw * vh * 0.35) continue;
      return true;
    }
  }
  return false;
}

/**
 * The constant scroll cue (client rule). Fades out near the bottom of the page, while a menu/overlay is
 * open, while typing, and whenever words or controls sit under it — it comes back once the spot is clear.
 */
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
      const next = !nearEnd && !locked && !typing && lenis.limit > 10 && !collides(el);
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
    <div ref={ref} className="scroll-cue pointer-events-none fixed bottom-3 left-1/2 z-[80] flex -translate-x-1/2 scale-90 flex-col items-center gap-2 md:bottom-6 md:scale-100 text-ink/70 transition-colors duration-500 data-[dark=1]:text-peach/80">
      <span className="hidden text-[0.55rem] tracking-[0.4em] uppercase md:inline">Scroll</span>
      <span className="flex h-8 w-5 justify-center rounded-full border border-current pt-1.5">
        <span className="scroll-dot block h-1 w-1 rounded-full bg-current" />
      </span>
    </div>
  );
}
