"use client";

// Section 7 — The Frequency Box. The welcome box in 3D on the left (on top on phones): it rises in with
// a full turn and a light sweep, then keeps turning — on its own, with the scroll, and under the pointer.
// It never opens. Copy on the right is the client's T/L/S with the "Join AUVOX Today" button.

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import SectionHead from "@/components/ui/SectionHead";
import Button from "@/components/ui/Button";
import { FREQUENCY_BOX } from "@/content/packages";
import { fbox } from "./state";
import { afterGate, expectReady } from "@/store/preloader";

const Stage = dynamic(() => import("./Stage"), { ssr: false });

export default function FrequencyBox() {
  const root = useRef<HTMLElement>(null);
  // the box's canvas mounts once the preloader's lockup is still (it warms there), or when the section comes near
  const [stageOn, setStageOn] = useState(false);
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
    <section ref={root} id="frequency-box" className="relative overflow-hidden bg-peach py-24 text-ink md:py-36">
      <div className="grain pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-multiply" />
      <div className="relative mx-auto max-w-[1440px] px-6 md:px-12">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          {/* the box */}
          <div className="lg:col-span-7">
            <div className="fbox-stage relative h-[60vw] lg:h-auto lg:aspect-[5/4]">
              <div className="fbox-halo pointer-events-none absolute top-1/2 left-1/2 aspect-square h-[96%] w-auto -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 lg:h-auto lg:w-[92%]" aria-hidden />
              {stageOn && <Stage />}
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
