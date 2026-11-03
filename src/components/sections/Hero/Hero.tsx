"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { useTransitionStore } from "@/store/transition";
import { afterGate, expectReady } from "@/store/preloader";
import { hero, roomFit, type Verse } from "./state";

const World = dynamic(() => import("./World"), { ssr: false });

const CALLOUTS: { kind: Verse; label: [string, string]; dx: number; dy: number }[] = [
  { kind: "guitar", label: ["Explore", "Guitar Verse"], dx: -190, dy: -120 },
  { kind: "keyboard", label: ["Explore", "Piano Verse"], dx: 70, dy: -150 },
];

/**
 * Section 3 — the hero. A sunlit room photo with a stone plinth; the 3D guitar and keyboard float
 * above it. Copy is the client's "Verse Universe" T/L/S. Once the page scrolls on, the "Reserve Your
 * Spot" button leaves the hero and pops up in the header's top-right slot.
 */
export default function Hero() {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  // the instruments' canvas waits for the preloader's gate: parsing the models and uploading their
  // textures mid-preloader stuttered the strings
  const [worldOn, setWorldOn] = useState(false);
  useEffect(() => {
    expectReady("hero");
    return afterGate(() => setWorldOn(true));
  }, []);
  const room = useRef<HTMLDivElement>(null);
  const cta = useRef<HTMLAnchorElement>(null);
  const ctaHome = useRef<HTMLDivElement>(null);
  useEffect(() => {
    hero.navigate = (kind) => useTransitionStore.getState().go(kind === "guitar" ? "/guitar-verse" : "/piano-verse");
  }, []);

  // the room photo is cover-fitted in JS so the 3D layer can find the plinth at the same spot
  useEffect(() => {
    const box = stage.current;
    const img = room.current;
    if (!box || !img) return;
    const fit = () => {
      const f = roomFit(box.clientWidth, box.clientHeight);
      // a little bigger than the box on every side: the pointer parallax moves it ±10px
      const bleed = 18;
      Object.assign(img.style, { left: `${f.x - bleed}px`, top: `${f.y - bleed}px`, width: `${f.w + bleed * 2}px`, height: `${f.h + bleed * 2}px` });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = gsap.utils.selector(el);

      // --- reveal: the AUVOX MUSIC lockup rises out of a mask, the tagline and its wave follow
      const intro = gsap.timeline({
        scrollTrigger: { trigger: el, start: "top 70%", once: true },
        defaults: { ease: "expo.out" },
      });
      intro
        .fromTo(q(".hero-room"), { scale: 1.08, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 1.8 }, 0)
        .fromTo(q(".hero-logo"), { yPercent: 105 }, { yPercent: 0, duration: 1.3 }, 0.35)
        .fromTo(q(".hero-tag"), { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9 }, 0.8)
        .fromTo(q(".hero-cta"), { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9 }, 1.0)
        .to(hero, { enter: 1, duration: 2.2, ease: "expo.out" }, 0.4);

      // --- the sheet: rounded top corners and a lifted shadow while it slides over the studio,
      // squaring off as it lands, so the two read as one page in layers
      const sheet = gsap.fromTo(
        el,
        { "--sheet-r": "28px", "--sheet-shadow": 1 },
        { "--sheet-r": "0px", "--sheet-shadow": 0, ease: "none", scrollTrigger: { trigger: el, start: "top 30%", end: "top top", scrub: true } },
      );

      // --- pointer: the photo drifts against the 3D layer's camera for a little depth
      const onMove = (e: PointerEvent) => {
        hero.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        hero.mouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
      };
      window.addEventListener("pointermove", onMove);
      const roomX = gsap.quickTo(q(".hero-room"), "x", { duration: 1.2, ease: "power3.out" });
      const roomY = gsap.quickTo(q(".hero-room"), "y", { duration: 1.2, ease: "power3.out" });

      // --- callouts follow the instruments, with a thin line to each
      const boxes = CALLOUTS.map((c) => ({
        c,
        el: q<HTMLButtonElement>(`.callout-${c.kind}`)[0],
        line: q<HTMLSpanElement>(`.callout-line-${c.kind}`)[0],
      }));
      // the DOM ticker only runs while the hero is on screen
      let onScreen = true;
      const io = new IntersectionObserver(([e]) => (onScreen = e.isIntersecting), { rootMargin: "10%" });
      io.observe(el);
      const tick = () => {
        if (!onScreen) return;
        roomX(hero.mouse.x * -10);
        roomY(hero.mouse.y * 6);
        const bw = stage.current?.clientWidth ?? window.innerWidth;
        for (const { c, el: box, line } of boxes) {
          if (!box || !line) continue;
          const a = hero.anchors[c.kind];
          // keep the label on screen and clear of the header
          const lx = Math.min(bw - 200, Math.max(24, a.x + c.dx));
          const ly = Math.max(110, a.y + c.dy);
          box.style.transform = `translate(${lx}px, ${ly}px) translate(-12px, -50%)`;
          box.dataset.on = a.on ? "1" : "0";
          box.dataset.active = hero.hover === c.kind ? "1" : "0";
          // a 1px div stretched and turned with a transform: compositor-only, unlike SVG line attributes
          const dx = a.x - lx;
          const dy = a.y - (ly + 14);
          line.style.transform = `translate(${lx}px, ${ly + 14}px) rotate(${Math.atan2(dy, dx)}rad) scaleX(${Math.hypot(dx, dy)})`;
          line.style.opacity = a.on ? (hero.hover === c.kind ? "0.9" : "0.45") : "0";
        }
      };
      gsap.ticker.add(tick);

      // --- the CTA and the header slot: once the hero scrolls on, the button leaves the hero (a quick
      // fade) and pops up in the header's top-right slot; scrolling back brings it home the same way
      const slot = document.getElementById("header-cta-slot");
      const button = cta.current;
      const home = ctaHome.current;
      let docked = false;
      const toHeader = () => {
        if (docked || !button || !slot) return;
        docked = true;
        slot.appendChild(button);
        button.classList.add("is-docked");
      };
      const toHome = () => {
        if (!docked || !button || !home) return;
        docked = false;
        home.appendChild(button);
        button.classList.remove("is-docked");
      };
      let swap: gsap.core.Timeline | null = null;
      const move = (toSlot: boolean) => {
        if (!button) return;
        swap?.kill();
        swap = gsap
          .timeline()
          .to(button, { autoAlpha: 0, scale: 0.9, y: toSlot ? -6 : 6, duration: 0.22, ease: "power2.in" })
          .add(() => (toSlot ? toHeader() : toHome()))
          .fromTo(
            button,
            { autoAlpha: 0, scale: 0.82, y: toSlot ? -8 : 8 },
            { autoAlpha: 1, scale: 1, y: 0, duration: 0.55, ease: "back.out(2.2)", clearProps: "transform" },
          );
      };
      // the hero keeps the button's place while it is up in the header, so nothing below shifts
      if (home && button) home.style.minHeight = `${button.offsetHeight}px`;
      const dock = ScrollTrigger.create({
        trigger: home ?? el,
        start: "top 22%",
        onEnter: () => move(true),
        onLeaveBack: () => move(false),
      });

      return () => {
        window.removeEventListener("pointermove", onMove);
        gsap.ticker.remove(tick);
        io.disconnect();
        sheet.scrollTrigger?.kill();
        sheet.kill();
        dock.kill();
        swap?.kill();
        // the button may be docked in the header (which outlives this page): bring it home first, or
        // it would be left behind in the header when the hero unmounts
        toHome();
        if (button) gsap.set(button, { clearProps: "opacity,visibility,transform" });
      };
    },
    { scope: root },
  );

  return (
    <section ref={root} id="home" className="hero hero-sheet relative z-10 min-h-[100svh] overflow-clip bg-peach text-ink">
      {/* the room + the 3D instruments: a band on top on phones, full-bleed on wide screens */}
      <div ref={stage} className="absolute inset-x-0 top-0 h-[56svh] lg:inset-0 lg:h-auto">
        <div ref={room} className="hero-room absolute opacity-0 will-change-transform">
          <Image src="/hero/room.jpg" alt="" fill priority sizes="100vw" className="object-cover" />
        </div>
        <div className="hero-light pointer-events-none absolute inset-0" />
        {worldOn && <World />}
        {/* callouts + their leader lines */}
        {CALLOUTS.map((c) => (
          <span
            key={c.kind}
            className={`callout-line-${c.kind} pointer-events-none absolute top-0 left-0 hidden h-px w-px origin-left bg-ink opacity-0 transition-opacity duration-500 will-change-transform md:block`}
          />
        ))}
        {CALLOUTS.map((c) => (
          <button
            key={c.kind}
            type="button"
            onClick={() => hero.navigate(c.kind)}
            onPointerEnter={() => (hero.hover = c.kind)}
            onPointerLeave={() => (hero.hover = null)}
            className={`callout callout-${c.kind} absolute top-0 left-0 z-20 hidden items-center gap-3 text-left md:flex`}
          >
            <span className="callout-dot flex h-8 w-8 items-center justify-center rounded-full bg-ink text-base leading-none text-pearl">+</span>
            <span className="text-[0.62rem] leading-[1.6] font-semibold tracking-[0.28em] text-ink uppercase">
              {c.label[0]}
              <br />
              {c.label[1]}
            </span>
          </button>
        ))}
        {/* phones: the band melts into the page */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-peach lg:hidden" />
      </div>
      <div className="grain pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-multiply" />

      {/* copy */}
      <div className="pointer-events-none relative z-10 flex min-h-[100svh] flex-col justify-center px-6 pt-[52svh] pb-28 md:px-12 lg:w-[50%] lg:pt-28 lg:pb-32 lg:pl-[max(3rem,calc((100vw-1440px)/2+3rem))] [&_a]:pointer-events-auto">
        {/* the client's brief: AUVOX MUSIC, and under it the tagline with a small, minimal sound wave */}
        <h1 className="overflow-hidden pb-1">
          <span className="sr-only">AUVOX Music</span>
          <span className="hero-logo block w-[min(78vw,500px)] lg:w-[min(36vw,560px)]" aria-hidden />
        </h1>
        <p className="hero-tag mt-7 flex items-center gap-4 text-[0.7rem] font-semibold tracking-[0.42em] text-ink/70 uppercase md:mt-9 md:text-[0.76rem]">
          <svg className="hero-wave h-5 w-[4.5rem] shrink-0 text-red" viewBox="0 0 72 20" aria-hidden>
            {[3, 6, 10, 14, 18, 14, 9, 13, 17, 12, 8, 5, 3].map((h, i) => (
              <rect key={i} x={i * 5.6 + 1} y={10 - h / 2} width="2" height={h} rx="1" fill="currentColor" style={{ animationDelay: `${(i * 0.11).toFixed(2)}s` }} />
            ))}
          </svg>
          Forged in frequency
        </p>
        <div ref={ctaHome} className="hero-cta mt-10">
          <a
            ref={cta}
            href="/reserve"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              useTransitionStore.getState().go("/reserve");
            }}
            className="cta group inline-flex items-center gap-3 rounded-full bg-ink px-9 py-[1.15rem] text-[0.74rem] font-semibold tracking-[0.3em] text-pearl uppercase transition-colors hover:bg-red"
          >
            <span className="cta-label">
              <span className="cta-long">Reserve your spot</span>
              <span className="cta-short">Reserve</span>
            </span>
            <span className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">↗</span>
          </a>
        </div>
      </div>

    </section>
  );
}
