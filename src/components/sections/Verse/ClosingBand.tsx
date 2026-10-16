"use client";

// Section 5 — the red closing band: one line, two buttons, and a slow marquee of the verse's promise.

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import type { Verse } from "@/content/packages";
import SectionHead from "@/components/ui/SectionHead";
import Button from "@/components/ui/Button";
import Marquee from "@/components/ui/Marquee";
import { marqueeItems } from "./copy";

export default function ClosingBand({ verse }: { verse: Verse }) {
  const root = useRef<HTMLElement>(null);
  const items = marqueeItems(verse);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      gsap.fromTo(q(".verse-close-cta"), { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 60%", once: true } });
      gsap.fromTo(q(".verse-marquee"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: q(".verse-marquee")[0], start: "top 95%", once: true } });
    },
    { scope: root },
  );

  return (
    <section ref={root} data-theme="dark" className="verse-close relative overflow-clip bg-red text-peach">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_80%_at_50%_120%,rgba(30,30,30,0.55),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(40%_40%_at_10%_0%,rgba(231,180,126,0.18),transparent_70%)]" />
      <div className="grain pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-screen" />
      <div className="relative mx-auto max-w-[1440px] px-6 pt-24 pb-16 md:px-12 md:pt-36 md:pb-24">
        <SectionHead tone="dark" align="center" size="xl" kicker="Begin" title="Your first song is closer than you think." accent="think." />
        <div className="verse-close-cta mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 opacity-0">
          <Button href={`/enroll?package=${verse}-complete`} variant="peach">
            Enroll now
          </Button>
          <Button href="/reserve" variant="ghost">
            Reserve a free demo
          </Button>
        </div>
      </div>
      <div className="verse-marquee relative border-t border-peach/15 py-6 opacity-0 md:py-8">
        <Marquee speed={70}>
          {items.map((it) => (
            <span key={it} className="font-display flex items-center text-[clamp(1.4rem,3vw,2.4rem)] leading-none text-peach/85">
              <span className="px-6 md:px-8">{it}</span>
              <span aria-hidden className="text-[0.6em] text-tan">
                ✦
              </span>
            </span>
          ))}
        </Marquee>
      </div>
    </section>
  );
}
