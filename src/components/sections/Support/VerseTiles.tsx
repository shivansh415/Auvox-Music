"use client";

import { useRef } from "react";
import SectionHead from "@/components/ui/SectionHead";
import TransitionLink from "@/components/ui/TransitionLink";
import { packagesFor, VERSE_COPY, type Verse } from "@/content/packages";
import { useReveal } from "./reveal";

const TILES: { verse: Verse; href: string; title: string }[] = [
  { verse: "guitar", href: "/guitar-verse", title: "Guitar Verse" },
  { verse: "piano", href: "/piano-verse", title: "Piano Verse" },
];

function Arrow() {
  return (
    <svg className="support-arrow h-6 w-9" viewBox="0 0 36 24" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden="true">
      <path d="M2 12h31M24 3l9 9-9 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The two product tiles — a lift, a soft shadow and a red arrow slide on hover. */
export default function VerseTiles() {
  const root = useRef<HTMLElement>(null);
  useReveal(root, ".support-tile", 0.12);

  return (
    <section ref={root} className="bg-peach py-24 text-ink md:py-36" aria-label="Products">
      <div className="mx-auto max-w-[1440px] px-6 md:px-12">
        <SectionHead kicker="Products" title="Which verse are you in?" accent="in?" body="Pick your instrument to see its packages, classes and what ships in your kit." />

        <div className="mt-14 grid gap-5 md:mt-20 md:grid-cols-2 md:gap-8">
          {TILES.map(({ verse, href, title }) => {
            const copy = VERSE_COPY[verse];
            const from = Math.min(...packagesFor(verse).map((p) => p.price));
            return (
              <TransitionLink
                key={verse}
                href={href}
                data-cursor="Open"
                className="support-tile group relative flex min-h-[18rem] flex-col justify-between overflow-hidden rounded-[1.75rem] bg-cream p-8 text-ink opacity-0 md:min-h-[24rem] md:p-12"
              >
                <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-tan/50 blur-3xl transition-transform duration-700 group-hover:scale-125" aria-hidden="true" />
                <div className="relative flex items-center gap-4">
                  <span className="block h-px w-10 bg-ink/50" />
                  <span className="text-[0.65rem] font-medium tracking-[0.38em] text-ink/70 uppercase">{copy.kicker}</span>
                </div>
                <div className="relative mt-10">
                  <h3 className="font-display text-[clamp(2.4rem,4.5vw,4.4rem)] leading-[0.95] tracking-[-0.015em]">
                    {title.split(" ")[0]} <em className="text-red not-italic">{title.split(" ")[1]}</em>
                  </h3>
                  <p className="mt-5 max-w-[26rem] text-[1.05rem] leading-relaxed text-ink/75">{copy.title}</p>
                </div>
                <div className="relative mt-10 flex items-end justify-between gap-6">
                  <p className="text-[0.7rem] font-semibold tracking-[0.3em] text-ink/70 uppercase">
                    From ${from} CAD · Core &amp; Complete
                  </p>
                  <Arrow />
                </div>
              </TransitionLink>
            );
          })}
        </div>
      </div>
    </section>
  );
}
