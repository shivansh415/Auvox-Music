"use client";

// Section 4 — Core or Complete? The client's comparison table, rows revealing one by one.

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import type { Verse } from "@/content/packages";
import SectionHead from "@/components/ui/SectionHead";
import ComparisonTable from "@/components/ui/packages/ComparisonTable";

export default function CompareBand({ verse }: { verse: Verse }) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      const tl = gsap.timeline({
        defaults: { ease: "expo.out" },
        scrollTrigger: { trigger: q(".verse-table")[0], start: "top 80%", once: true },
      });
      tl.fromTo(q(".verse-table"), { y: 28, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.2 }, 0)
        .fromTo(q("thead"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 }, 0.2)
        .fromTo(q(".cmp-row"), { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.07 }, 0.3);
    },
    { scope: root },
  );

  return (
    <section ref={root} className="verse-compare relative overflow-clip bg-peach text-ink">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(253,242,227,1),rgba(250,227,197,0)_30%)]" />
      <div className="grain pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-multiply" />
      <div className="relative mx-auto max-w-[1440px] px-6 py-24 md:px-12 md:py-36">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-16">
          <SectionHead kicker="Compare" title="Core or Complete?" accent="Complete?" body="Everything in both packages, side by side. Add-ons can be added to Core on the enrollment form." />
          <div className="verse-table opacity-0">
            <div className="verse-table-scroll">
              <ComparisonTable verse={verse} className="bg-cream" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
