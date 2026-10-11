"use client";

// Section 3 — the verse's two packages side by side (Complete is Best Value). The cards rise in
// with a stagger and tilt a few degrees toward the pointer.

import { useRef, type PointerEvent } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { packagesFor, type Verse } from "@/content/packages";
import SectionHead from "@/components/ui/SectionHead";
import PackageCard from "@/components/ui/packages/PackageCard";
import { VERSE_NAME } from "./copy";

const MAX_TILT = 4;

export default function PackagesBand({ verse }: { verse: Verse }) {
  const root = useRef<HTMLElement>(null);
  const packages = packagesFor(verse);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      gsap.fromTo(
        q(".verse-card"),
        { y: 48, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 1.3, stagger: 0.15, ease: "expo.out", scrollTrigger: { trigger: q(".verse-cards")[0], start: "top 78%", once: true } },
      );
    },
    { scope: root },
  );

  const tilt = (e: PointerEvent<HTMLDivElement>) => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const box = e.currentTarget;
    const inner = box.firstElementChild;
    if (!inner) return;
    const r = box.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    gsap.to(inner, { rotateY: px * MAX_TILT * 2, rotateX: -py * MAX_TILT * 2, duration: 0.7, ease: "power3.out", overwrite: "auto" });
  };
  const rest = (e: PointerEvent<HTMLDivElement>) => {
    const inner = e.currentTarget.firstElementChild;
    if (inner) gsap.to(inner, { rotateY: 0, rotateX: 0, duration: 1.1, ease: "expo.out", overwrite: "auto" });
  };

  return (
    <section ref={root} id="packages" className="verse-packages relative scroll-mt-4 overflow-clip bg-cream text-ink">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_100%_0%,rgba(250,227,197,0.9),transparent_70%)]" />
      <div className="grain pointer-events-none absolute inset-[-50%] opacity-[0.04] mix-blend-multiply" />
      <div className="relative mx-auto max-w-[1440px] px-6 py-24 md:px-12 md:py-36">
        <SectionHead
          kicker="Packages"
          title={`Choose your ${VERSE_NAME[verse]} Verse`}
          accent="Verse"
          body="Core for the essentials, Complete for the full AUVOX experience — with the instrument included."
        />
        <div className="verse-cards mt-14 grid gap-6 md:mt-20 md:grid-cols-2 md:gap-8 lg:gap-10">
          {packages.map((pkg) => (
            <div key={pkg.id} className="verse-card opacity-0" onPointerMove={tilt} onPointerLeave={rest}>
              <PackageCard pkg={pkg} className="verse-card-inner h-full" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
