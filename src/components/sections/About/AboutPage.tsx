"use client";

// About us: the client's own words for what AUVOX is and why to choose it, set as an editorial page —
// the AUVOX mark and tagline, the headline, the body in two columns, then the four reasons, and the
// two ways to begin.

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import Button from "@/components/ui/Button";
import { ABOUT } from "@/content/packages";

/** the headline with its last word in the accent colour */
function Headline({ title, accent }: { title: string; accent: string }) {
  const head = title.endsWith(accent) ? title.slice(0, -accent.length) : title;
  return (
    <>
      {head}
      <em className="text-red not-italic">{accent}</em>
    </>
  );
}

export default function AboutPage() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const q = gsap.utils.selector(el);
      gsap.fromTo(q(".ab-in"), { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.1, stagger: 0.08, ease: "expo.out", delay: 0.15 });
      q<HTMLElement>(".ab-reveal").forEach((block) => {
        gsap.fromTo(block.querySelectorAll(".ab-item"), { y: 24, autoAlpha: 0 }, {
          y: 0,
          autoAlpha: 1,
          duration: 1,
          stagger: 0.07,
          ease: "expo.out",
          scrollTrigger: { trigger: block, start: "top 80%", once: true },
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative overflow-clip bg-cream text-ink">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_85%_10%,rgba(231,180,126,0.28),transparent_70%)]" aria-hidden />

      {/* what AUVOX is */}
      <div className="relative mx-auto max-w-[1440px] px-6 pt-36 pb-20 md:px-12 md:pt-44 md:pb-28">
        <div className="ab-in flex items-center gap-4">
          <span className="block h-px w-10 bg-ink/40" aria-hidden />
          <span className="text-[0.65rem] font-semibold tracking-[0.38em] text-ink/65 uppercase">About AUVOX</span>
        </div>
        <h1 className="ab-in font-display mt-7 max-w-[16ch] text-[clamp(2.6rem,6vw,5.6rem)] leading-[1.0] tracking-[-0.02em]">
          <Headline title={ABOUT.what.title} accent={ABOUT.what.accent} />
        </h1>
        <div className="mt-12 grid gap-8 md:mt-16 md:grid-cols-2 md:gap-16 lg:max-w-[64rem]">
          {ABOUT.what.body.map((p) => (
            <p key={p} className="ab-in text-[1.05rem] leading-relaxed text-ink/75 md:text-[1.12rem]">
              {p}
            </p>
          ))}
        </div>
        <p className="ab-in mt-14 flex items-center gap-4 text-[0.7rem] font-semibold tracking-[0.42em] text-ink/65 uppercase">
          <span className="ab-mark block h-7 w-8 shrink-0" aria-hidden />
          Forged in frequency
        </p>
      </div>

      {/* why choose AUVOX */}
      <div className="relative border-t border-ink/10 bg-peach">
        <div className="ab-reveal mx-auto grid max-w-[1440px] gap-12 px-6 py-20 md:px-12 md:py-28 lg:grid-cols-[1fr_1.2fr] lg:gap-24">
          <div>
            <span className="ab-item block text-[0.65rem] font-semibold tracking-[0.38em] text-ink/65 uppercase">{ABOUT.why.kicker}</span>
            <h2 className="ab-item font-display mt-6 max-w-[16ch] text-[clamp(2rem,4vw,3.6rem)] leading-[1.02] tracking-[-0.015em]">
              <Headline title={ABOUT.why.title} accent={ABOUT.why.accent} />
            </h2>
          </div>
          <ol className="grid self-end sm:grid-cols-2">
            {ABOUT.why.points.map((p, i) => (
              <li key={p} className="ab-item flex items-baseline gap-5 border-t border-ink/15 py-6 sm:pr-8">
                <span className="font-display text-[1.6rem] leading-none text-red">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[1.05rem] leading-snug">{p}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* begin */}
      <div className="ab-reveal relative mx-auto flex max-w-[1440px] flex-col items-center px-6 py-24 text-center md:px-12 md:py-32">
        <h2 className="ab-item font-display max-w-[18ch] text-[clamp(2rem,4.4vw,3.8rem)] leading-[1.02] tracking-[-0.015em]">
          Your verse begins with one <em className="text-red not-italic">conversation.</em>
        </h2>
        <div className="ab-item mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button href="/reserve" variant="ink">
            Reserve your free demo
          </Button>
          <Button href="/packages" variant="outline" className="border-ink/30 text-ink">
            Explore packages
          </Button>
        </div>
      </div>
    </section>
  );
}
