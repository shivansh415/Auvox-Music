"use client";

// Section 8, page 1 — "Begin". A split-choice moment: the section is two huge hover zones
// (Guitar | Piano) in ghosted display type. A thin seam follows the pointer between them, the side
// under the pointer brightens, leans toward it and washes the background (red / tan). The copy and
// the two CTAs stay centred on top. On touch the two words sit side by side with TAP chips.

import { useRef } from "react";
import clsx from "clsx";
import { gsap, useGSAP } from "@/lib/gsap";
import { useTransition } from "@/store/transition";
import { BEGIN } from "@/content/packages";
import SectionHead from "@/components/ui/SectionHead";
import Button from "@/components/ui/Button";

const SIDES = [
  { key: "guitar", word: "Guitar", href: "/guitar-verse", label: "Guitar Verse" },
  { key: "piano", word: "Piano", href: "/piano-verse", label: "Piano Verse" },
] as const;

export default function Begin() {
  const root = useRef<HTMLElement>(null);
  const go = useTransition();

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const coarse = window.matchMedia("(pointer: coarse)").matches;

      // --- entrance: the two words rise out of the floor, then the CTAs
      gsap
        .timeline({ scrollTrigger: { trigger: el, start: "top 75%", once: true }, defaults: { ease: "expo.out" } })
        .fromTo(q(".begin-word-wrap"), { yPercent: 24, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.8, stagger: 0.12 }, 0)
        .fromTo(q(".begin-seam"), { scaleY: 0 }, { scaleY: 1, duration: 1.4, transformOrigin: "top" }, 0.2)
        .fromTo(q(".begin-cta"), { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.08 }, 0.8);

      if (coarse || reduced) return;

      // --- pointer: the seam tracks x, the words lean toward the pointer, the hovered side wakes up
      const seamX = gsap.quickTo(q(".begin-seam"), "x", { duration: 0.55, ease: "power3.out" });
      const dotY = gsap.quickTo(q(".begin-seam-dot"), "y", { duration: 0.55, ease: "power3.out" });
      const wraps = q<HTMLElement>(".begin-word-wrap");
      const tos = wraps.map((w) => ({
        x: gsap.quickTo(w, "x", { duration: 0.9, ease: "power3.out" }),
        y: gsap.quickTo(w, "y", { duration: 0.9, ease: "power3.out" }),
        r: gsap.quickTo(w, "rotation", { duration: 0.9, ease: "power3.out" }),
        s: gsap.quickTo(w, "scale", { duration: 0.9, ease: "power3.out" }),
      }));
      let side = "";
      const onMove = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        const px = e.clientX - r.left;
        const py = e.clientY - r.top;
        const nx = (px / r.width) * 2 - 1;
        const ny = (py / r.height) * 2 - 1;
        seamX(px - r.width / 2);
        dotY(py);
        const next = nx < 0 ? "guitar" : "piano";
        if (next !== side) {
          side = next;
          el.dataset.side = side;
        }
        wraps.forEach((_, i) => {
          const on = SIDES[i].key === side;
          tos[i].x(nx * (on ? 34 : 12));
          tos[i].y(ny * (on ? 22 : 8));
          tos[i].r(on ? nx * 3.2 : nx * 0.8);
          tos[i].s(on ? 1.05 : 0.98);
        });
      };
      const onLeave = () => {
        side = "";
        el.dataset.side = "";
        seamX(0);
        tos.forEach((t) => {
          t.x(0);
          t.y(0);
          t.r(0);
          t.s(1);
        });
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerleave", onLeave);
      return () => {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerleave", onLeave);
      };
    },
    { scope: root },
  );

  return (
    <section ref={root} id="begin" className="begin relative flex min-h-[100svh] flex-col items-center justify-center overflow-clip bg-cream py-24 text-ink md:py-36">
      {/* base gradient + the two side washes (driven by data-side, see globals.css) */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_112%,rgba(222,184,134,0.5),transparent_70%)]" />
      <div className="begin-wash begin-wash-guitar pointer-events-none absolute inset-0 bg-[radial-gradient(55%_95%_at_10%_50%,rgba(133,9,9,0.28),transparent_72%)]" />
      <div className="begin-wash begin-wash-piano pointer-events-none absolute inset-0 bg-[radial-gradient(55%_95%_at_90%_50%,rgba(231,180,126,0.85),transparent_72%)]" />
      <div className="grain pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-multiply" />

      {/* the two choice zones */}
      <div className="begin-zones" aria-label="Choose your verse">
        {SIDES.map((s, i) => (
          <button
            key={s.key}
            type="button"
            className={clsx("begin-zone group relative flex items-center", i === 0 ? "justify-start pl-[3vw] md:pl-[5vw]" : "justify-end pr-[3vw] md:pr-[5vw]")}
            onClick={() => go(s.href)}
            data-cursor={s.label}
            aria-label={`Explore ${s.label}`}
          >
            <span className="begin-word-wrap block will-change-transform">
              <span className={clsx("begin-word font-display block text-[12vw] leading-none tracking-[-0.02em] select-none", `begin-word-${s.key}`)}>{s.word}</span>
            </span>
            <span className="begin-tap" aria-hidden>
              <span className="tap-ring relative flex h-11 w-11 items-center justify-center rounded-full border border-current">
                <span className="text-[9px] font-semibold tracking-[0.3em]">TAP</span>
              </span>
              <span className="text-[0.6rem] tracking-[0.3em] uppercase">{s.label}</span>
            </span>
          </button>
        ))}
      </div>

      {/* the seam between them */}
      <div className="begin-seam pointer-events-none absolute top-0 bottom-0 left-1/2 w-px bg-ink/20">
        <span className="begin-seam-dot absolute top-0 -left-[3px] block h-[7px] w-[7px] rounded-full bg-red" />
      </div>

      {/* the copy stays centred on top; only the buttons take the pointer */}
      <div className="begin-copy pointer-events-none relative z-10 mx-auto w-full max-w-[1440px] px-6 text-center md:px-12">
        <SectionHead kicker={BEGIN.kicker} title={BEGIN.title} accent={BEGIN.accent} body={BEGIN.body} align="center" size="xl" />
        <div className="pointer-events-auto mt-12 flex flex-wrap justify-center gap-4">
          <Button className="begin-cta" href="/reserve" variant="ink">
            {BEGIN.primary}
          </Button>
          <Button className="begin-cta" href="/packages" variant="outline">
            {BEGIN.secondary}
          </Button>
        </div>
      </div>
    </section>
  );
}
