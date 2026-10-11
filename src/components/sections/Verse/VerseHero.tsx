"use client";

// Section 1 — the verse hero. The client's "low opacity / gradient" panel: peach with a faint
// red→peach wash and grain, the T/L/S copy and the three points on the left, the 3D instrument
// (rendered by the sticky layer in VersePage) over a huge ghost word on the right.

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { useTransition } from "@/store/transition";
import { VERSE_COPY, type Verse } from "@/content/packages";
import SectionHead from "@/components/ui/SectionHead";
import Button from "@/components/ui/Button";
import { VERSE_NAME } from "./copy";
import { verseState } from "./state";

/**
 * `enter` starts the instrument, wash and ghost word (0.3s after mount, so they rise while the page
 * curtain lifts); `ready` starts the text once the curtain has fully gone (direct loads: both at once).
 */
export default function VerseHero({ verse, enter, ready }: { verse: Verse; enter: boolean; ready: boolean }) {
  const root = useRef<HTMLElement>(null);
  const go = useTransition();
  const copy = VERSE_COPY[verse];

  // the instrument rises and turns in, the wash and ghost word fade up
  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      verseState.enter = 0;
      if (!enter) return;
      const q = gsap.utils.selector(el);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // the page arrives under the curtain: give it a beat before anything moves
      gsap
        .timeline({ delay: 0.3, defaults: { ease: "expo.out" } })
        .fromTo(q(".verse-wash"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.6 }, 0)
        .fromTo(q(".verse-ghost"), { autoAlpha: 0, xPercent: 6 }, { autoAlpha: 1, xPercent: 0, duration: 1.8 }, 0.1)
        .to(verseState, { enter: 1, duration: reduce ? 0.8 : 2.2, ease: "expo.out" }, 0);
    },
    { scope: root, dependencies: [enter] },
  );

  // the points, buttons and index follow the headline (SectionHead plays its own reveal on mount)
  useGSAP(
    () => {
      const el = root.current;
      if (!el || !ready) return;
      const q = gsap.utils.selector(el);
      gsap
        .timeline({ defaults: { ease: "expo.out" } })
        .fromTo(q(".verse-point-rule"), { scaleX: 0 }, { scaleX: 1, duration: 0.9, stagger: 0.1, transformOrigin: "left" }, 0.7)
        .fromTo(q(".verse-point"), { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.1 }, 0.75)
        .fromTo(q(".verse-cta"), { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9 }, 1.05)
        .fromTo(q(".verse-index"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 }, 1.3);
    },
    { scope: root, dependencies: [ready] },
  );

  return (
    <section ref={root} className="verse-hero relative -mt-[100svh] min-h-[100svh] overflow-clip bg-peach text-ink">
      {/* the low-opacity red→peach wash the client describes, plus grain */}
      <div className="verse-wash pointer-events-none absolute inset-0 opacity-0" />
      <div className="grain pointer-events-none absolute inset-[-50%] opacity-[0.04] mix-blend-multiply" />

      {/* the ghost word sits where the instrument floats: top band on phones, right half on wide screens */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[55svh] items-center justify-center overflow-hidden lg:inset-y-0 lg:left-auto lg:right-0 lg:h-auto lg:w-1/2 lg:justify-end">
        <span aria-hidden className="verse-ghost font-display block leading-none whitespace-nowrap text-peach-deep opacity-0 select-none lg:translate-x-[0.08em]">
          {VERSE_NAME[verse]}
        </span>
      </div>

      {/* copy */}
      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-[1440px] flex-col justify-center px-6 pt-[55svh] pb-24 md:px-12 lg:w-1/2 lg:pt-32 lg:pr-12 lg:pb-32">
        {ready && <SectionHead as="h1" size="xl" immediate kicker={copy.kicker} title={copy.title} accent={copy.accent} body={copy.body} />}
        <ul className="mt-10 space-y-3.5">
          {copy.points.map((p) => (
            <li key={p} className="verse-point flex items-center gap-4 opacity-0">
              <span className="verse-point-rule block h-px w-7 bg-red" />
              <span className="font-display text-[1.35rem] leading-none text-ink md:text-[1.6rem]">{p}</span>
            </li>
          ))}
        </ul>
        <div className="verse-cta mt-11 flex flex-wrap items-center gap-x-8 gap-y-4 opacity-0">
          <Button href={`/enroll?package=${verse}-complete`} variant="ink">
            Enroll now
          </Button>
          <Button variant="ghost" onClick={() => go("#packages")}>
            See packages
          </Button>
        </div>
      </div>

      {/* section index */}
      <div className="verse-index pointer-events-none absolute bottom-8 left-6 z-10 flex items-center gap-4 opacity-0 md:left-12">
        <span className="font-display text-2xl text-ink/40">01</span>
        <span className="flex gap-2">
          <span className="block h-[2px] w-9 bg-red" />
          <span className="block h-[2px] w-9 bg-ink/15" />
          <span className="block h-[2px] w-9 bg-ink/15" />
          <span className="block h-[2px] w-9 bg-ink/15" />
        </span>
      </div>
    </section>
  );
}
