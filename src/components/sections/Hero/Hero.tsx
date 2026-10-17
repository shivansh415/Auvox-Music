"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { Flip, gsap, ScrollTrigger, SplitText, useGSAP } from "@/lib/gsap";
import { useTransitionStore } from "@/store/transition";
import { hero, roomFit, type Verse } from "./state";

const World = dynamic(() => import("./World"), { ssr: false });

const CALLOUTS: { kind: Verse; label: [string, string]; dx: number; dy: number }[] = [
  { kind: "guitar", label: ["Explore", "Guitar Verse"], dx: -190, dy: -120 },
  { kind: "keyboard", label: ["Explore", "Piano Verse"], dx: 70, dy: -150 },
];

/**
 * Section 3 — the hero. A sunlit room photo with a stone plinth; the 3D guitar and keyboard float
 * above it. Copy is the client's "Verse Universe" T/L/S. The "Reserve Your Spot" button flies into
 * the header's slot as the page scrolls.
 */
export default function Hero() {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
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

      // --- text reveal: lines rise out of a mask, the coloured last word a beat later
      const title = new SplitText(q(".hero-title"), { type: "lines,words", linesClass: "hero-line" });
      gsap.set(title.lines, { overflow: "hidden", paddingBottom: "0.08em", marginBottom: "-0.08em" });
      const intro = gsap.timeline({
        scrollTrigger: { trigger: el, start: "top 70%", once: true },
        defaults: { ease: "expo.out" },
      });
      intro
        .fromTo(q(".hero-room"), { scale: 1.08, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 1.8 }, 0)
        .fromTo(q(".hero-rule"), { scaleX: 0 }, { scaleX: 1, duration: 1.0, transformOrigin: "left" }, 0.2)
        .fromTo(q(".hero-kicker"), { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8 }, 0.3)
        .from(title.words, { yPercent: 110, duration: 1.2, stagger: 0.035 }, 0.35)
        .fromTo(q(".hero-body"), { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9 }, 0.85)
        .fromTo(q(".hero-cta"), { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9 }, 1.0)
        .fromTo(q(".hero-social"), { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8 }, 1.15)
        .to(hero, { enter: 1, duration: 2.2, ease: "expo.out" }, 0.4)
        // once revealed, hand the headline back to normal text so it re-wraps on resize
        .add(() => title.revert());

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

      // --- the CTA and the header slot
      const slot = document.getElementById("header-cta-slot");
      const button = cta.current;
      const home = ctaHome.current;
      let docked = false;
      const toHeader = () => {
        if (docked || !button || !slot) return;
        docked = true;
        gsap.killTweensOf(button);
        gsap.set(button, { clearProps: "transform" });
        button.classList.remove("is-flying");
        slot.appendChild(button);
        button.classList.add("is-docked");
        gsap.fromTo(button, { scale: 0.88 }, { scale: 1, duration: 0.55, ease: "back.out(3)" });
      };
      const toHome = () => {
        if (!docked || !button || !home) return;
        docked = false;
        gsap.killTweensOf(button);
        gsap.set(button, { clearProps: "transform" });
        home.appendChild(button);
        button.classList.remove("is-docked");
      };
      const mm = gsap.matchMedia();

      // desktop: the hero holds still once it covers the screen; scrolling only flies the button —
      // floating up in an arc into the header — and once it has landed the page scrolls on
      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        if (!button || !home || !slot) return;
        // the docked size, measured once on a hidden copy
        const probe = button.cloneNode(true) as HTMLElement;
        probe.classList.add("is-docked");
        Object.assign(probe.style, { position: "fixed", left: "-9999px", top: "0", visibility: "hidden" });
        document.body.appendChild(probe);
        const dock = { w: probe.offsetWidth, h: probe.offsetHeight };
        probe.remove();

        const ease = gsap.parseEase("power2.inOut");
        const flight = { p: 0 };
        const fly = () => {
          const p = flight.p;
          if (p >= 0.995) return toHeader();
          toHome();
          const h = home.getBoundingClientRect();
          const sl = slot.getBoundingClientRect();
          const bw = button.offsetWidth;
          const bh = button.offsetHeight;
          const e = ease(p);
          const lift = Math.sin(Math.PI * p);
          const x = (sl.right - dock.w / 2 - (h.left + bw / 2)) * e;
          // floats up in a gentle arc, never above the top of the screen
          const y = Math.max((sl.top + sl.height / 2 - (h.top + bh / 2)) * e - lift * 55, 14 + bh / 2 - (h.top + bh / 2));
          gsap.set(button, { x, y, scale: 1 + (dock.h / bh - 1) * e, rotation: -5 * lift, transformOrigin: "50% 50%" });
          button.classList.toggle("is-flying", p > 0.01);
        };
        const pin = ScrollTrigger.create({ trigger: el, start: "top top", end: "+=85%", pin: true, pinSpacing: true, anticipatePin: 1 });
        const flightTween = gsap.to(flight, {
          p: 1,
          ease: "none",
          onUpdate: fly,
          scrollTrigger: { trigger: el, start: "top top", end: "+=72%", scrub: 0.5 },
        });
        return () => {
          flightTween.scrollTrigger?.kill();
          flightTween.kill();
          pin.kill();
          button.classList.remove("is-flying");
          gsap.set(button, { clearProps: "transform" });
        };
      });

      // phones / tablets (the hero is taller than the screen there) and reduced motion: no hold,
      // the button simply slides into the header once the hero scrolls away
      mm.add("(max-width: 1023px), (prefers-reduced-motion: reduce)", () => {
        if (!button || !home || !slot) return;
        const go = (toSlot: boolean) => {
          const state = Flip.getState(button);
          if (toSlot) toHeader();
          else toHome();
          Flip.from(state, { duration: 0.8, ease: "expo.inOut", scale: true, absolute: true });
        };
        const st = ScrollTrigger.create({ trigger: el, start: "top -20%", onEnter: () => go(true), onLeaveBack: () => go(false) });
        return () => st.kill();
      });

      return () => {
        window.removeEventListener("pointermove", onMove);
        gsap.ticker.remove(tick);
        io.disconnect();
        sheet.scrollTrigger?.kill();
        sheet.kill();
        mm.revert();
        title.revert();
      };
    },
    { scope: root },
  );

  return (
    <section ref={root} className="hero hero-sheet relative z-10 min-h-[100svh] overflow-clip bg-peach text-ink">
      {/* the room + the 3D instruments: a band on top on phones, full-bleed on wide screens */}
      <div ref={stage} className="absolute inset-x-0 top-0 h-[56svh] lg:inset-0 lg:h-auto">
        <div ref={room} className="hero-room absolute opacity-0 will-change-transform">
          <Image src="/hero/room.jpg" alt="" fill priority sizes="100vw" className="object-cover" />
        </div>
        <div className="hero-light pointer-events-none absolute inset-0" />
        <World />
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
        <div className="flex items-center gap-4">
          <span className="hero-rule block h-px w-10 bg-ink/50" />
          <span className="hero-kicker text-[0.65rem] font-medium tracking-[0.38em] text-ink/70 uppercase">The Verse Universe</span>
        </div>
        <h1 className="hero-title font-display mt-7 max-w-[13ch] text-[clamp(2.7rem,5vw,5.6rem)] leading-[1.0] tracking-[-0.015em]">
          Every instrument has a voice waiting to be <em className="text-red">found.</em>
        </h1>
        <p className="hero-body mt-8 max-w-[30rem] text-[1.05rem] leading-relaxed text-ink/75">
          The Verse Universe is a growing world of music where every voice is trained, shaped, and set free.
          <br />
          One world. Many instruments. One standard of mastery.
        </p>
        <div ref={ctaHome} className="hero-cta mt-10">
          <a
            ref={cta}
            href="#reserve"
            className="cta group inline-flex items-center gap-3 rounded-full bg-ink px-9 py-[1.15rem] text-[0.74rem] font-semibold tracking-[0.3em] text-pearl uppercase transition-colors hover:bg-red"
          >
            <span>Reserve your spot</span>
            <span className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">↗</span>
          </a>
        </div>
        <div className="hero-social mt-10 flex items-center gap-5">
          <div className="flex -space-x-2">
            {["a", "b"].map((k) => (
              <Image key={k} src={`/chat/avatar-${k}.webp`} alt="" width={36} height={36} unoptimized className="h-9 w-9 rounded-full object-cover ring-2 ring-peach" />
            ))}
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-tan text-xs font-semibold text-ink ring-2 ring-peach">+</span>
          </div>
          <span className="block h-px w-10 bg-ink/25" />
          <p className="text-sm leading-snug text-ink/75">
            Join a growing community
            <br />
            of modern music lovers.
          </p>
        </div>
      </div>

    </section>
  );
}
