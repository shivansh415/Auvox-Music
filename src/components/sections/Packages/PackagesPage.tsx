"use client";

// Section 8, page 3 — /packages. Black, text-focused: all four packages in one screen,
// the optional add-ons, and a pointer to each verse's comparison table. A red glow drifts
// slowly behind the grid; the cards rise in with a stagger. Nothing heavier.

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { ADD_ON_CLASSES, ADD_ON_WHATSAPP, PACKAGES } from "@/content/packages";
import PackageCard from "@/components/ui/packages/PackageCard";
import SectionHead from "@/components/ui/SectionHead";
import TransitionLink from "@/components/ui/TransitionLink";

const money = (n: number) => `$${n.toFixed(2)}`;
const ADD_ONS = [ADD_ON_WHATSAPP, ADD_ON_CLASSES];

export default function PackagesPage() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      gsap.fromTo(
        q(".pkgs-card"),
        { y: 44, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 1.3, stagger: 0.1, ease: "expo.out", scrollTrigger: { trigger: q(".pkgs-grid"), start: "top 80%", once: true } },
      );
      gsap.fromTo(
        q(".pkgs-in"),
        { y: 20, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 1, stagger: 0.1, ease: "expo.out", scrollTrigger: { trigger: q(".pkgs-foot"), start: "top 88%", once: true } },
      );
    },
    { scope: root },
  );

  return (
    <section ref={root} data-theme="dark" className="pkgs relative min-h-[100svh] overflow-clip bg-ink text-peach">
      <div className="pkgs-glow pointer-events-none absolute top-[38%] left-1/2 h-[70vw] max-h-[900px] w-[70vw] max-w-[900px] rounded-full bg-[radial-gradient(circle,rgba(133,9,9,0.55),transparent_62%)] blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_40%_at_50%_0%,rgba(231,180,126,0.08),transparent_70%)]" />
      <div className="grain pointer-events-none absolute inset-[-50%] opacity-[0.06] mix-blend-screen" />

      <div className="relative mx-auto max-w-[1440px] px-6 pt-32 pb-24 md:px-12 md:pt-40 md:pb-32">
        <SectionHead as="h1" kicker="Packages" title="Four ways to begin." accent="begin." body="Core for the essentials, Complete for the full AUVOX experience — on guitar or piano." tone="dark" align="center" immediate />

        {/* all four, one screen */}
        <div className="pkgs-grid mt-16 grid gap-5 md:mt-20 md:grid-cols-2 xl:grid-cols-4">
          {PACKAGES.map((p) => (
            <PackageCard key={p.id} pkg={p} tone="dark" compact className="pkgs-card" />
          ))}
        </div>

        <div className="pkgs-foot mt-10 grid gap-5 lg:grid-cols-12">
          {/* optional add-ons */}
          <div className="pkgs-in relative overflow-hidden rounded-[1.6rem] p-7 ring-1 ring-peach/15 md:p-9 lg:col-span-7">
            <div className="grain pointer-events-none absolute inset-[-50%] opacity-[0.05] mix-blend-screen" />
            <span className="text-[0.6rem] tracking-[0.35em] text-peach/60 uppercase">Optional add-ons</span>
            <ul className="mt-5 divide-y divide-peach/15">
              {ADD_ONS.map((a) => (
                <li key={a.name} className="flex items-baseline justify-between gap-6 py-4 first:pt-0 last:pb-0">
                  <span className="font-display text-[1.5rem] leading-none md:text-[1.8rem]">{a.name}</span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    <span className="font-display text-[1.3rem] leading-none md:text-[1.5rem]">{money(a.price)}</span>
                    <span className="text-[0.6rem] tracking-[0.3em] text-peach/60 uppercase">CAD</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-peach/55">Add either at enrollment or later from your dashboard. WhatsApp support is already included with Complete.</p>
          </div>

          {/* the comparison note */}
          <div className="pkgs-in flex flex-col justify-between rounded-[1.6rem] bg-[radial-gradient(90%_80%_at_80%_0%,rgba(133,9,9,0.45),transparent_70%)] p-7 ring-1 ring-tan/30 md:p-9 lg:col-span-5">
            <div>
              <span className="text-[0.6rem] tracking-[0.35em] text-peach/60 uppercase">Core or Complete?</span>
              <p className="font-display mt-4 text-[1.6rem] leading-[1.1] md:text-[1.9rem]">
                Compare them line by line on each verse page.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-[0.7rem] font-semibold tracking-[0.3em] uppercase">
              <TransitionLink href="/guitar-verse" className="link-line pb-1 text-tan">
                Guitar Verse ↗
              </TransitionLink>
              <TransitionLink href="/piano-verse" className="link-line pb-1 text-tan">
                Piano Verse ↗
              </TransitionLink>
            </div>
          </div>
        </div>

        <p className="pkgs-in mt-10 text-center text-sm text-peach/45">
          All prices in CAD. Not sure yet?{" "}
          <TransitionLink href="/reserve" className="link-line text-peach/80">
            Reserve a free demo first
          </TransitionLink>
          .
        </p>
      </div>
    </section>
  );
}
