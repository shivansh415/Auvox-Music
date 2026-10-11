"use client";

import { useRef, useState } from "react";
import SectionHead from "@/components/ui/SectionHead";
import Disclosure from "./Disclosure";
import { GROUPS } from "./search";
import { useReveal } from "./reveal";

/** Every preloaded answer, grouped by topic. One open at a time across the whole list. */
export default function FaqAccordion() {
  const root = useRef<HTMLElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  useReveal(root, ".support-group", 0.1);

  return (
    <section ref={root} className="bg-peach py-24 md:py-36" aria-label="All answers">
      <div className="mx-auto max-w-[1440px] px-6 md:px-12">
        <SectionHead kicker="All answers" title="Everything, by topic." accent="topic." body="The full set of preloaded answers. Open one at a time." />

        <div className="mt-14 md:mt-20">
          {GROUPS.map((g) => (
            <div key={g.tag} className="support-group grid gap-4 border-t border-ink/15 py-8 opacity-0 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] md:gap-12 md:py-12">
              <h3 className="flex items-baseline gap-4 md:sticky md:top-32 md:self-start">
                <span className="text-[0.65rem] font-medium tracking-[0.38em] text-ink/55 uppercase">{String(g.items.length).padStart(2, "0")}</span>
                <span className="font-display text-[clamp(1.5rem,2.4vw,2.2rem)] leading-[1.1] text-ink">{g.label}</span>
              </h3>
              <ul className="-mt-3 md:mt-0">
                {g.items.map((faq) => (
                  <li key={faq.id} className="border-b border-ink/10 last:border-b-0">
                    <Disclosure
                      id={`all-${faq.id}`}
                      open={open === faq.id}
                      onToggle={() => setOpen((o) => (o === faq.id ? null : faq.id))}
                      title={faq.q}
                      titleClass="text-[1.15rem] leading-snug md:text-[1.25rem]"
                    >
                      <p className="max-w-[36rem] text-[1.02rem] leading-relaxed text-ink/75">{faq.a}</p>
                    </Disclosure>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
