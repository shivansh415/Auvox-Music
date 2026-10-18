"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import clsx from "clsx";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { useTransition } from "@/store/transition";
import Button from "./Button";
import Marquee from "./Marquee";
import TransitionLink from "./TransitionLink";
import { SHOWCASE } from "@/lib/showcase";

export const NAV = [
  { label: "The Verse Universe", href: "/#verse-universe" },
  { label: "Guitar Verse", href: "/guitar-verse" },
  { label: "Piano Verse", href: "/piano-verse" },
  { label: "Journey", href: "/#journey" },
  // the preview build hides the Frequency Box section, so its link goes to the coming-soon page
  { label: "The Frequency Box", href: SHOWCASE ? "/coming-soon" : "/#frequency-box" },
  { label: "Support", href: "/support" },
];

/**
 * Fixed header: logo, the nav, and the slot the hero's "Reserve Your Spot" button flies into.
 * Sections marked `data-theme="dark"` flip it to light text while they are under it.
 * On phones the nav lives in a full-screen menu.
 */
export default function Header() {
  const pathname = usePathname();
  const go = useTransition();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const root = useRef<HTMLElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const home = pathname === "/";

  // home page: the header stays out of the studio and drops in once the hero has covered the screen;
  // elsewhere it simply arrives with the page
  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      const parts = q(".hdr-logo, .nav-link, .hdr-right");
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let shown = false;
      const show = () => {
        if (shown) return;
        shown = true;
        gsap.killTweensOf([el, ...parts]);
        gsap
          .timeline({ defaults: { ease: "expo.out" } })
          .to(el, { autoAlpha: 1, yPercent: 0, duration: reduce ? 0.3 : 0.9 }, 0)
          .fromTo(parts, { y: reduce ? 0 : -18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.05 }, 0.12);
      };
      const hide = () => {
        if (!shown) return;
        shown = false;
        gsap.killTweensOf([el, ...parts]);
        gsap.to(el, { autoAlpha: 0, yPercent: -100, duration: 0.45, ease: "power3.in" });
      };
      const heroEl = home ? document.querySelector<HTMLElement>(".hero") : null;
      if (!heroEl) {
        gsap.set(el, { autoAlpha: 0, yPercent: -100 });
        show();
        return;
      }
      gsap.set(el, { autoAlpha: 0, yPercent: -100 });
      // refreshPriority -1: compute after the splash/hero pins have added their scroll distance
      const st = ScrollTrigger.create({ trigger: heroEl, start: "top top", onEnter: show, onLeaveBack: hide, refreshPriority: -1 });
      if (st.progress > 0 || window.scrollY >= heroEl.getBoundingClientRect().top + window.scrollY - 1) show();
      return () => st.kill();
    },
    { dependencies: [pathname, home] },
  );

  // while reading: a soft glass ground once content passes under it; out of the way when scrolling
  // down, back the moment you scroll up (never while the menu is open)
  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let hidden = false;
      let lastY = window.scrollY;
      let acc = 0;
      const heroTop = () => {
        const h = home ? document.querySelector<HTMLElement>(".hero") : null;
        return h ? h.getBoundingClientRect().top + window.scrollY : 0;
      };
      let top0 = heroTop();
      const setHidden = (h: boolean) => {
        if (h === hidden) return;
        hidden = h;
        gsap.to(el, { y: h ? -120 : 0, duration: h ? 0.5 : 0.7, ease: h ? "power3.in" : "expo.out", overwrite: "auto" });
      };
      const onScroll = () => {
        const y = window.scrollY;
        const dy = y - lastY;
        lastY = y;
        el.dataset.solid = y > top0 + 60 ? "1" : "";
        if (reduce || document.documentElement.dataset.overlay === "1") return setHidden(false);
        // only once well past the hero; a little hysteresis so a trackpad's jitter doesn't flap it
        if (y < top0 + window.innerHeight * 0.9) {
          acc = 0;
          return setHidden(false);
        }
        acc = Math.sign(dy) === Math.sign(acc) ? acc + dy : dy;
        if (acc > 80) setHidden(true);
        else if (acc < -40) setHidden(false);
      };
      const onResize = () => {
        top0 = heroTop();
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize);
      ScrollTrigger.addEventListener("refresh", onResize);
      onScroll();
      return () => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onResize);
        ScrollTrigger.removeEventListener("refresh", onResize);
        gsap.set(el, { y: 0 });
      };
    },
    { dependencies: [pathname, home] },
  );

  // which theme is under the header right now
  useGSAP(
    () => {
      const els = Array.from(document.querySelectorAll<HTMLElement>("[data-theme='dark']"));
      let under = 0;
      const triggers = els.map((el) =>
        ScrollTrigger.create({
          trigger: el,
          start: "top 48px",
          end: "bottom 48px",
          refreshPriority: -1,
          onToggle: (self) => {
            under += self.isActive ? 1 : -1;
            setDark(under > 0);
          },
        }),
      );
      return () => triggers.forEach((t) => t.kill());
    },
    { dependencies: [pathname] },
  );

  // the full-screen menu
  useGSAP(
    () => {
      const el = menu.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      document.documentElement.dataset.overlay = open ? "1" : "";
      if (open) {
        gsap.set(el, { display: "flex" });
        gsap
          .timeline({ defaults: { ease: "expo.out" } })
          .fromTo(el, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.9, ease: "expo.inOut" })
          .from(q(".menu-link"), { yPercent: 110, duration: 1, stagger: 0.06 }, 0.35)
          .from(q(".menu-foot"), { autoAlpha: 0, y: 16, duration: 0.8 }, 0.7);
      } else {
        gsap.to(el, { clipPath: "inset(0 0 100% 0)", duration: 0.7, ease: "expo.inOut", onComplete: () => gsap.set(el, { display: "none" }) });
      }
    },
    { dependencies: [open] },
  );
  // close the menu when the route changes (state derived during render, not in an effect)
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }

  const nav = (href: string) => {
    setOpen(false);
    go(href);
  };

  return (
    <>
      <header
        ref={root}
        className={clsx(
          "hdr pointer-events-none invisible fixed inset-x-0 top-0 z-[120] flex items-center justify-between px-6 py-5 transition-colors duration-500 md:px-12",
          dark && !open ? "text-peach" : "text-ink",
        )}
        data-dark={dark && !open ? "1" : ""}
      >
        {/* the glass ground (only once content has scrolled under the header) */}
        <span className="hdr-glass pointer-events-none absolute inset-0 -z-10" aria-hidden />
        <TransitionLink href="/" className="hdr-logo pointer-events-auto" aria-label="AUVOX Music — home">
          <Image src="/svg/auvox-primary-logo.svg" alt="AUVOX Music" width={130} height={45} unoptimized className={clsx("h-10 w-auto md:h-12 transition-[filter] duration-500", dark && !open && "brightness-0 invert-[0.92] sepia-[0.3]")} />
        </TransitionLink>

        <nav className="pointer-events-auto hidden items-center gap-9 lg:flex" aria-label="Primary">
          {NAV.map((n) => {
            const active = n.href === pathname;
            return (
              <TransitionLink key={n.href} href={n.href} className={clsx("nav-link relative text-[0.95rem] font-medium tracking-[0.01em]", active && "is-active")}>
                {n.label}
              </TransitionLink>
            );
          })}
        </nav>

        <div className="hdr-right pointer-events-auto flex items-center gap-3">
          {/* the hero docks its button here on the home page; elsewhere the header brings its own */}
          <div id="header-cta-slot" className="flex min-h-10 items-center justify-end lg:min-w-[13rem]">
            {!home && (
              <div className="hidden md:block">
                <Button href="/reserve" size="sm">
                  Reserve your spot
                </Button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className={clsx("burger relative flex h-10 w-10 items-center justify-center rounded-full border lg:hidden", open ? "border-peach/40 text-peach" : "border-current")}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            data-open={open ? "1" : "0"}
          >
            <span className="burger-line" />
            <span className="burger-line" />
          </button>
        </div>
      </header>

      {/* full-screen menu */}
      <div ref={menu} className="fixed inset-0 z-[110] hidden flex-col bg-ink text-peach" style={{ clipPath: "inset(0 0 100% 0)" }} data-lenis-prevent>
        <div className="grain pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-screen" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_80%_90%,rgba(133,9,9,0.45),transparent_70%)]" />
        <nav className="relative flex flex-1 flex-col justify-center px-6 pt-24 md:px-12" aria-label="Menu">
          {[...NAV, { label: "Reserve your spot", href: "/reserve" }].map((n, i) => (
            <div key={n.href} className="overflow-hidden">
              <button type="button" onClick={() => nav(n.href)} className="menu-link group flex w-full items-baseline gap-4 py-1.5 text-left">
                <span className="w-7 text-[0.6rem] tracking-[0.3em] text-tan/70">0{i + 1}</span>
                <span className="font-display text-[clamp(2.2rem,8vw,4.6rem)] leading-[1.05] transition-colors group-hover:text-tan">{n.label}</span>
              </button>
            </div>
          ))}
        </nav>
        <div className="menu-foot relative border-t border-peach/15">
          <Marquee speed={28} className="py-3 text-[0.62rem] tracking-[0.35em] text-peach/60 uppercase">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className="mx-6">
                Music builds a better you <span className="mx-6 text-tan">✦</span>
              </span>
            ))}
          </Marquee>
        </div>
      </div>
    </>
  );
}
