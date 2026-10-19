"use client";

import { useRef, useState } from "react";
import SectionHead from "@/components/ui/SectionHead";
import Disclosure from "./Disclosure";
import { FAQS } from "./search";
import { useReveal } from "./reveal";

const TOP = FAQS.slice(0, 6);

/** The six answers people open most — each unfolds inline. One open at a time. */
export default function QuickLinks() {
  const root = useRef<HTMLElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  useReveal(root, ".support-quick", 0.06);

  return (
    <section ref={root} className="bg-peach py-24 text-ink md:py-36" aria-label="Quick links">
      <div className="mx-auto max-w-[1440px] px-6 md:px-12">
        <div className="grid gap-12 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16">
          <SectionHead kicker="Quick links" title="The answers people open most." accent="most." body="Tap a question to read its answer right here." size="md" className="md:sticky md:top-32 md:self-start" />
          <ul className="border-t border-ink/15">
            {TOP.map((faq, i) => (
              <li key={faq.id} className="support-quick border-b border-ink/15 opacity-0">
                <Disclosure
                  id={`quick-${faq.id}`}
                  index={String(i + 1).padStart(2, "0")}
                  open={open === faq.id}
                  onToggle={() => setOpen((o) => (o === faq.id ? null : faq.id))}
                  title={faq.q}
                  titleClass="font-display text-[clamp(1.25rem,2vw,1.8rem)] leading-[1.15]"
                >
                  <p className="max-w-[36rem] text-[1.05rem] leading-relaxed text-ink/75">{faq.a}</p>
                </Disclosure>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
