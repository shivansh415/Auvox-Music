"use client";

import { ReactLenis, useLenis, type LenisRef } from "lenis/react";
import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";

/** ScrollTrigger updates on every Lenis scroll (subscribed once Lenis exists: an effect in the
 * provider itself runs before ReactLenis has created the instance, so it would never attach) */
function SyncScrollTrigger() {
  useLenis(ScrollTrigger.update);
  return null;
}

/** dev: the Lenis instance on window, for scripted scrolling */
function DevHandle() {
  const lenis = useLenis();
  useEffect(() => {
    if (process.env.NODE_ENV === "development") (window as unknown as { __lenis: unknown }).__lenis = lenis;
  }, [lenis]);
  return null;
}

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<LenisRef>(null);

  // Drive Lenis from GSAP's ticker so ScrollTrigger and Lenis stay in sync
  useEffect(() => {
    const update = (time: number) => lenisRef.current?.lenis?.raf(time * 1000);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);
    // ScrollTrigger measures by jumping the page to the top and back during a refresh (a resize, a
    // breakpoint, fonts or images settling). Lenis can catch that jump as where the visitor is and
    // carry them to the top. Before each refresh, remember where they are; after, put Lenis back there.
    let before = 0;
    const onInit = () => {
      before = window.scrollY;
    };
    const onRefresh = () => {
      const lenis = lenisRef.current?.lenis;
      if (!lenis) return;
      lenis.resize();
      const y = Math.abs(window.scrollY - before) > 2 && window.scrollY === 0 ? before : window.scrollY;
      lenis.scrollTo(y, { immediate: true, force: true });
    };
    ScrollTrigger.addEventListener("refreshInit", onInit);
    ScrollTrigger.addEventListener("refresh", onRefresh);
    return () => {
      gsap.ticker.remove(update);
      ScrollTrigger.removeEventListener("refreshInit", onInit);
      ScrollTrigger.removeEventListener("refresh", onRefresh);
    };
  }, []);

  return (
    <ReactLenis root options={{ autoRaf: false, lerp: 0.1 }} ref={lenisRef}>
      <SyncScrollTrigger />
      <DevHandle />
      {children}
    </ReactLenis>
  );
}
