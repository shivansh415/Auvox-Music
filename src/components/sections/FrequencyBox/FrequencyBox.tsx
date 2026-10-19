"use client";

// Section 7 — The Frequency Box, after the client's reference: the welcome box in 3D on the left (on top on
// phones) on a warm off-white, closed (it stays a surprise). It rises in with a full turn and a light
// sweep, then keeps turning: on its own, with the scroll, under the pointer. A Guitar Box / Piano Box
// switch turns it to the other edition. Copy on the right is the client's T/L/S with "Join AUVOX Today".

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { gsap, useGSAP } from "@/lib/gsap";
import SectionHead from "@/components/ui/SectionHead";
import Button from "@/components/ui/Button";
import { FREQUENCY_BOX } from "@/content/packages";
import { fbox, nudge } from "./state";
import { afterGate, expectReady } from "@/store/preloader";
import type { Edition } from "./textures";

const EDITIONS: { key: Edition; label: string }[] = [
  { key: "guitar", label: "Guitar Box" },
  { key: "piano", label: "Piano Box" },
];

const Stage = dynamic(() => import("./Stage"), { ssr: false });

export default function FrequencyBox() {
  const root = useRef<HTMLElement>(null);
  // the box's canvas mounts once the preloader's lockup is still (it warms there), or when the section comes near
  const [stageOn, setStageOn] = useState(false);
  const [edition, setEdition] = useState<Edition>("guitar");
  const pick = (e: Edition) => {
    if (e === edition) return;
    setEdition(e);
    // the box turns to show its new side
    nudge(e === "piano" ? 7 : -7);
  };
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const on = () => setStageOn(true);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && on(), { rootMargin: "150% 0px" });
    io.observe(el);
    expectReady("fbox");
    const cancel = afterGate(on);
    return () => {
      io.disconnect();
      cancel();
    };
  }, []);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      fbox.enter = 0;
      fbox.sweep = 0;
      fbox.scroll = 0;
      fbox.turnIn = reduce ? 0 : 1;
      fbox.idleSpeed = reduce ? 0.08 : 0.22;

      // entrance: the box lands (rise + scale + one turn), the halo blooms, the sweep crosses, the caption follows
      const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: "top 70%", once: true },
        defaults: { ease: "expo.out" },
      });
      tl.to(fbox, { enter: 1, duration: reduce ? 1.1 : 1.6, ease: reduce ? "power2.out" : "expo.out" }, 0)
        .fromTo(q(".fbox-halo"), { scale: 0.7, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 1.8 }, 0)
        .fromTo(q(".fbox-caption"), { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9 }, 0.8)
        .fromTo(q(".fbox-hint"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, 1.0);
      if (!reduce) tl.to(fbox, { sweep: 1, duration: 1.5, ease: "power2.inOut" }, 0.45);

      // the page scroll adds to the turn
      if (!reduce) {
        gsap.to(fbox, {
          scroll: 1,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 1 },
        });
      }
    },
    { scope: root },
  );

  return (
    <section ref={root} id="frequency-box" className="relative overflow-hidden bg-pearl py-24 text-ink md:py-36">
      {/* the peach of the Journey above melts into the box's warm off-white */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-peach to-transparent" aria-hidden />
      <div className="grain pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-multiply" />
      <div className="relative mx-auto max-w-[1440px] px-6 md:px-12">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          {/* the box */}
          <div className="lg:col-span-7">
            <div className="fbox-stage relative h-[60vw] lg:h-auto lg:aspect-[5/4]">
              <div className="fbox-halo pointer-events-none absolute top-1/2 left-1/2 aspect-square h-[96%] w-auto -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 lg:h-auto lg:w-[92%]" aria-hidden />
              {stageOn && <Stage edition={edition} />}
              <span className="fbox-hint pointer-events-none absolute right-3 bottom-3 hidden opacity-0 pointer-coarse:flex" aria-hidden>
                <span className="tap-ring relative flex h-11 w-11 items-center justify-center rounded-full border border-ink/60 text-[0.5rem] font-semibold tracking-[0.2em] text-ink/80 uppercase">Drag</span>
              </span>
            </div>
            <p className="fbox-caption mt-4 flex items-center justify-center gap-4 text-center text-[0.65rem] font-medium tracking-[0.38em] text-ink/70 uppercase opacity-0">
              <span className="block h-px w-10 bg-ink/40" aria-hidden />
              <span>15 × 10 × 5 in · sealed until it reaches you</span>
              <span className="block h-px w-10 bg-ink/40" aria-hidden />
            </p>
          </div>

          {/* the copy */}
          <div className="lg:col-span-5">
            <SectionHead kicker={FREQUENCY_BOX.kicker} title={FREQUENCY_BOX.title} accent={FREQUENCY_BOX.accent} body={FREQUENCY_BOX.body} />
            {/* the two editions, as in the reference */}
            <div role="radiogroup" aria-label="Edition" className="mt-9 inline-flex rounded-full border border-ink/15 bg-cream/60 p-1">
              {EDITIONS.map((e) => (
                <button
                  key={e.key}
                  type="button"
                  role="radio"
                  aria-checked={edition === e.key}
                  onClick={() => pick(e.key)}
                  className={clsx(
                    "rounded-full px-6 py-2.5 text-[0.8rem] font-medium tracking-[0.06em] transition-colors duration-300",
                    edition === e.key ? "bg-red text-peach" : "text-ink/70 hover:text-ink",
                  )}
                >
                  {e.label}
                </button>
              ))}
            </div>
            <div className="mt-10">
              <Button href="/reserve" variant="ink">
                {FREQUENCY_BOX.cta}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
