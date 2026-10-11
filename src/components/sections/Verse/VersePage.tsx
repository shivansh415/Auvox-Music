"use client";

// A verse page (Guitar Verse / Piano Verse). One sticky 3D layer carries the instrument through
// the hero, the "what you'll learn" band and the packages: it starts full-size on the hero's right,
// then shrinks into a bottom-right chip as the packages scroll in, and leaves with them.

import dynamic from "next/dynamic";
import { useRef } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { usePreloaderStore } from "@/store/preloader";
import { useTransitionStore } from "@/store/transition";
import type { Verse } from "@/content/packages";
import VerseHero from "./VerseHero";
import LearnBand from "./LearnBand";
import PackagesBand from "./PackagesBand";
import CompareBand from "./CompareBand";
import ClosingBand from "./ClosingBand";
import { resetVerseState, verseState } from "./state";

const InstrumentWorld = dynamic(() => import("./InstrumentWorld"), { ssr: false });

export default function VersePage({ verse }: { verse: Verse }) {
  const root = useRef<HTMLElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  // on a direct load the preloader covers the page: everything waits for it to leave. On a route
  // change the instrument starts under the curtain (it rises as the curtain lifts) and the text
  // starts once the curtain has gone, so its reveal is actually seen.
  const done = usePreloaderStore((s) => s.done);
  const covering = useTransitionStore((s) => s.covering);
  const ready = done && !covering;

  useGSAP(
    () => {
      const el = root.current;
      const canvas = wrap.current;
      if (!el || !canvas) return;
      resetVerseState();
      const q = gsap.utils.selector(el);
      const hero = q(".verse-hero")[0];
      const learn = q(".verse-learn")[0];
      const packages = q(".verse-packages")[0];
      const ghost = q(".verse-ghost");

      const onMove = (e: PointerEvent) => {
        verseState.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        verseState.mouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
      };
      window.addEventListener("pointermove", onMove);

      const mm = gsap.matchMedia();
      mm.add(
        {
          reduce: "(prefers-reduced-motion: reduce)",
          wide: "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
          narrow: "(max-width: 1023px) and (prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
          const { reduce, wide } = ctx.conditions ?? {};
          if (reduce) {
            // no parallax or scrub: the instrument simply fades once the hero is gone
            ScrollTrigger.create({
              trigger: learn,
              start: "top 55%",
              onEnter: () => gsap.to(canvas, { autoAlpha: 0, duration: 0.6 }),
              onLeaveBack: () => gsap.to(canvas, { autoAlpha: 1, duration: 0.6 }),
            });
            return;
          }
          // the ghost word drifts slower than the page
          gsap.to(ghost, { yPercent: 28, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
          if (wide) {
            // the instrument shrinks into a bottom-right chip as the packages arrive
            gsap.fromTo(
              canvas,
              { scale: 1, x: 0, y: 0 },
              {
                scale: 0.26,
                x: -28,
                y: -28,
                transformOrigin: "100% 100%",
                ease: "none",
                scrollTrigger: { trigger: learn, start: "top bottom", endTrigger: packages, end: "top 15%", scrub: 0.6 },
              },
            );
          } else {
            // phones: the instrument band melts away as the next section comes up
            gsap.to(canvas, { autoAlpha: 0, scale: 0.85, yPercent: -12, transformOrigin: "50% 50%", ease: "none", scrollTrigger: { trigger: learn, start: "top 90%", end: "top 35%", scrub: 0.6 } });
          }
        },
      );

      return () => {
        window.removeEventListener("pointermove", onMove);
        mm.revert();
      };
    },
    { scope: root },
  );

  return (
    <main ref={root} className="verse relative bg-peach text-ink">
      <div className="verse-stage relative">
        {/* the sticky 3D layer: a band on top on phones, the right half on wide screens */}
        <div className="verse-sticky pointer-events-none sticky top-0 z-20 h-[100svh]">
          <div ref={wrap} className="verse-canvas absolute inset-x-0 top-0 h-[55svh] will-change-transform lg:inset-y-0 lg:left-auto lg:right-0 lg:h-full lg:w-1/2">
            <InstrumentWorld verse={verse} />
          </div>
        </div>
        <VerseHero verse={verse} enter={done} ready={ready} />
        <LearnBand verse={verse} />
        <PackagesBand verse={verse} />
      </div>
      <CompareBand verse={verse} />
      <ClosingBand verse={verse} />
    </main>
  );
}
