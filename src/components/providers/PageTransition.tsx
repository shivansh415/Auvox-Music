"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useLenis } from "lenis/react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useTransitionStore } from "@/store/transition";

/** if the route hasn't changed this long after the push (a redirect back to the same page, a slow
 * network that gave up), the curtain opens anyway rather than leaving the page covered */
const FALLBACK_MS = 2600;

/**
 * The new page mounts while the old one is still scrolled (the browser keeps that position for
 * Back), so its scroll animations are created at that scroll; a scrubbed one can jump to its end
 * then and stay there after the page moves to the top (its catch-up tween is paused by the refresh
 * and nothing restarts it until the visitor scrolls). Under the curtain, snap each to where it
 * belongs.
 */
function syncScrubbed() {
  for (const st of ScrollTrigger.getAll()) {
    const anim = st.animation;
    if (!anim || !st.vars.scrub) continue;
    if (Math.abs(anim.progress() - st.progress) > 0.001) anim.progress(st.progress);
  }
}

/** the transition in flight: its target, its timelines and its fallback timer */
type Flight = { target: string; close?: gsap.core.Timeline; open?: gsap.core.Timeline; timer?: number };

/**
 * The curtain between pages: a peach panel sweeps up with the logomark, the route changes
 * underneath it, then it sweeps on and away. Hash links on the same page scroll instead.
 *
 * `go(href)` puts the href in the store; the close effect takes it straight out again (into a ref),
 * so nothing re-runs when the route changes under the curtain. The curtain opens when the pathname
 * changes, or, when it can't (the same path with a new query, a redirect back to this page), on a
 * timer. Back/forward while it is closing opens it on the page the browser went to.
 */
export default function PageTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const lenis = useLenis();
  const pending = useTransitionStore((s) => s.pending);
  const set = useTransitionStore((s) => s._set);
  const panel = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLDivElement>(null);
  const lastPath = useRef(pathname);
  const pathRef = useRef(pathname);
  const lenisRef = useRef(lenis);
  const flight = useRef<Flight | null>(null);

  useEffect(() => {
    pathRef.current = pathname;
    lenisRef.current = lenis;
  }, [pathname, lenis]);

  // --- open: the new page is in (or the fallback fired), sweep the curtain away
  const reveal = useRef(() => {});
  useEffect(() => {
    reveal.current = () => {
      const f = flight.current;
      if (!f || f.open) return;
      window.clearTimeout(f.timer);
      f.close?.kill();
      const lenis = lenisRef.current;
      lenis?.scrollTo(0, { immediate: true, force: true });
      window.scrollTo(0, 0);
      ScrollTrigger.refresh();
      syncScrubbed();
      // a hash on the target (e.g. /#journey from another page): land on it under the curtain
      const hash = f.target.split("#")[1];
      if (hash) {
        window.setTimeout(() => {
          const el = document.getElementById(hash);
          if (el) lenisRef.current?.scrollTo(el, { immediate: true, force: true, offset: -8 });
          ScrollTrigger.refresh();
          syncScrubbed();
        }, 350);
      }
      f.open = gsap
        .timeline({
          defaults: { ease: "expo.inOut" },
          delay: hash ? 0.4 : 0,
          onComplete: () => {
            flight.current = null;
            set({ covering: false });
            lenisRef.current?.start();
            ScrollTrigger.refresh();
          },
        })
        .to(mark.current, { autoAlpha: 0, y: -14, duration: 0.4, ease: "power2.in" }, 0.15)
        .to(panel.current, { yPercent: -100, duration: 0.85 }, 0.25)
        .set(panel.current, { display: "none" });
    };
  }, [set]);

  // --- close: cover the page, then push the route
  useEffect(() => {
    if (!pending) return;
    set({ pending: null });
    // one transition at a time: a second click while the curtain is moving is dropped
    if (flight.current) return;
    const url = new URL(pending, window.location.href);
    const path = url.pathname;
    const hash = url.hash.slice(1);
    const here = path === pathRef.current;
    const lenis = lenisRef.current;
    if (here && hash && !url.search) {
      const el = document.getElementById(hash);
      if (el) lenis?.scrollTo(el, { offset: -8, duration: 1.4, force: true });
      return;
    }
    if (here && !url.search && !hash) {
      lenis?.scrollTo(0, { duration: 1.2, force: true });
      return;
    }
    const f: Flight = { target: pending };
    flight.current = f;
    set({ covering: true });
    f.close = gsap
      .timeline({ defaults: { ease: "expo.inOut" } })
      .set(panel.current, { yPercent: 100, display: "block" })
      .to(panel.current, { yPercent: 0, duration: 0.85 })
      .fromTo(mark.current, { autoAlpha: 0, scale: 0.9, y: 14 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.6, ease: "expo.out" }, 0.45)
      .add(() => {
        lenisRef.current?.stop();
        router.push(pending);
        // the same path (only the query changes) never changes the pathname: open once it's pushed
        f.timer = window.setTimeout(() => reveal.current(), here ? 450 : FALLBACK_MS);
      }, 0.9);
  }, [pending, router, set]);

  // the pathname changed: either the push landed, or the visitor went back/forward mid-transition
  useEffect(() => {
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;
    if (flight.current) reveal.current();
  }, [pathname]);

  // leaving the app shell entirely (never in practice): don't leave timers behind
  useEffect(
    () => () => {
      const f = flight.current;
      if (!f) return;
      window.clearTimeout(f.timer);
      f.close?.kill();
      f.open?.kill();
    },
    [],
  );

  return (
    <div ref={panel} className="fixed inset-0 z-[190] hidden overflow-hidden bg-peach" aria-hidden>
      <div className="grain pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-multiply" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_100%,rgba(222,184,134,0.55),transparent_70%)]" />
      <div ref={mark} className="absolute inset-0 flex items-center justify-center opacity-0">
        <Image src="/svg/auvox-logomark.svg" alt="" width={72} height={64} unoptimized className="h-14 w-auto" />
      </div>
    </div>
  );
}
