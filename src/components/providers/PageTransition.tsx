"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useLenis } from "lenis/react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useTransitionStore } from "@/store/transition";

/**
 * The curtain between pages: a peach panel sweeps up with the logomark, the route changes
 * underneath it, then it sweeps on and away. Hash links on the same page scroll instead.
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

  // --- close: cover the page, then push the route
  useEffect(() => {
    if (!pending) return;
    const [path, hash] = pending.split("#");
    const samePage = (path === "" || path === pathname) && hash;
    if (samePage) {
      const el = document.getElementById(hash);
      if (el) lenis?.scrollTo(el, { offset: -8, duration: 1.4 });
      set({ pending: null });
      return;
    }
    if (path === pathname && !hash) {
      lenis?.scrollTo(0, { duration: 1.2 });
      set({ pending: null });
      return;
    }
    set({ covering: true });
    const tl = gsap.timeline({ defaults: { ease: "expo.inOut" } });
    tl.set(panel.current, { yPercent: 100, display: "block" })
      .to(panel.current, { yPercent: 0, duration: 0.85 })
      .fromTo(mark.current, { autoAlpha: 0, scale: 0.9, y: 14 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.6, ease: "expo.out" }, 0.45)
      .add(() => {
        lenis?.stop();
        router.push(pending);
      }, 0.9);
    return () => {
      tl.kill();
    };
  }, [pending, pathname, router, lenis, set]);

  // --- open: the new page is in, sweep the curtain away
  useEffect(() => {
    const { covering, pending: target } = useTransitionStore.getState();
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;
    if (!covering) return;
    lenis?.scrollTo(0, { immediate: true });
    window.scrollTo(0, 0);
    ScrollTrigger.refresh();
    // a hash on the target (e.g. /#journey from another page): land on it under the curtain
    const hash = target?.split("#")[1];
    if (hash) {
      window.setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) lenis?.scrollTo(el, { immediate: true, offset: -8 });
        ScrollTrigger.refresh();
      }, 350);
    }
    const tl = gsap.timeline({
      defaults: { ease: "expo.inOut" },
      onComplete: () => {
        set({ covering: false, pending: null });
        lenis?.start();
        ScrollTrigger.refresh();
      },
    });
    tl.to(mark.current, { autoAlpha: 0, y: -14, duration: 0.4, ease: "power2.in" }, 0.15)
      .to(panel.current, { yPercent: -100, duration: 0.85 }, 0.25)
      .set(panel.current, { display: "none" });
    return () => {
      tl.kill();
    };
  }, [pathname, lenis, set]);

  return (
    <div ref={panel} className="fixed inset-0 z-[190] hidden overflow-hidden bg-peach" aria-hidden>
      <div className="grain pointer-events-none absolute inset-[-50%] opacity-[0.05] mix-blend-multiply" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_100%,rgba(222,184,134,0.55),transparent_70%)]" />
      <div ref={mark} className="absolute inset-0 flex items-center justify-center opacity-0">
        <Image src="/svg/auvox-logomark.svg" alt="" width={72} height={64} unoptimized className="h-14 w-auto" />
      </div>
    </div>
  );
}
