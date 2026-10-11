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

export const NAV = [
  { label: "The Verse Universe", href: "/#verse-universe" },
  { label: "Guitar Verse", href: "/guitar-verse" },
  { label: "Piano Verse", href: "/piano-verse" },
  { label: "Journey", href: "/#journey" },
  { label: "The Frequency Box", href: "/#frequency-box" },
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
          "pointer-events-none fixed inset-x-0 top-0 z-[120] flex items-center justify-between px-6 py-5 transition-colors duration-500 md:px-12",
          dark && !open ? "text-peach" : "text-ink",
        )}
      >
        <TransitionLink href="/" className="pointer-events-auto" aria-label="AUVOX Music — home">
          <Image src="/svg/auvox-primary-logo.svg" alt="AUVOX Music" width={96} height={33} unoptimized className={clsx("h-8 w-auto transition-[filter] duration-500", dark && !open && "brightness-0 invert-[0.92] sepia-[0.3]")} />
        </TransitionLink>

        <nav className="pointer-events-auto hidden items-center gap-8 lg:flex" aria-label="Primary">
          {NAV.map((n) => {
            const active = n.href === pathname;
            return (
              <TransitionLink key={n.href} href={n.href} className={clsx("nav-link relative text-[0.8rem] tracking-[0.02em]", active && "is-active")}>
                {n.label}
              </TransitionLink>
            );
          })}
        </nav>

        <div className="pointer-events-auto flex items-center gap-3">
          {/* the hero docks its button here on the home page; elsewhere the header brings its own */}
          <div id="header-cta-slot" className="flex min-h-10 items-center">
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
        <div className="grain pointer-events-none absolute inset-[-50%] opacity-[0.06] mix-blend-screen" />
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
