"use client";

// Section 2 — "What you'll learn": the client's three points as three numbered columns.

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { VERSE_COPY, type Verse } from "@/content/packages";
import SectionHead from "@/components/ui/SectionHead";
import { LEARN_COPY, VERSE_NAME } from "./copy";

const NUMERALS = ["I", "II", "III"];

export default function LearnBand({ verse }: { verse: Verse }) {
  const root = useRef<HTMLElement>(null);
  const points = VERSE_COPY[verse].points;

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      const tl = gsap.timeline({
        defaults: { ease: "expo.out" },
        scrollTrigger: { trigger: q(".verse-cols")[0], start: "top 78%", once: true },
      });
      tl.fromTo(q(".verse-col-rule"), { scaleX: 0 }, { scaleX: 1, duration: 1.2, stagger: 0.12, transformOrigin: "left" }, 0)
        .fromTo(q(".verse-col"), { y: 36, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.2, stagger: 0.12 }, 0.1);
    },
    { scope: root },
  );

  return (
    <section ref={root} className="verse-learn relative overflow-clip bg-peach text-ink">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_0%_100%,rgba(222,184,134,0.45),transparent_70%)]" />
      <div className="grain pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-multiply" />
      <div className="relative mx-auto max-w-[1440px] px-6 py-24 md:px-12 md:py-36">
        <SectionHead kicker="What you'll learn" title={`Your ${VERSE_NAME[verse]} Verse, step by step.`} accent="step." />
        <div className="verse-cols mt-16 grid gap-10 md:mt-24 md:grid-cols-3 md:gap-8">
          {points.map((p, i) => (
            <div key={p} className="relative">
              <span className="verse-col-rule block h-px w-full bg-tan" />
              <div className="verse-col pt-7 opacity-0">
                <span className="font-display block text-[2rem] leading-none text-red">{NUMERALS[i]}</span>
                <h3 className="font-display mt-6 text-[1.75rem] leading-[1.05] tracking-[-0.01em] md:text-[2.1rem]">{p}</h3>
                <p className="mt-5 max-w-[26rem] text-[1rem] leading-relaxed text-ink/70">{LEARN_COPY[verse][i]}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
