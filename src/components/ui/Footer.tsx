"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { CONTACT_EMAIL } from "@/content/packages";
import Button from "./Button";
import TransitionLink from "./TransitionLink";
import { NAV } from "./Header";

// a constant on purpose: Next flags `new Date()` in client components during prerender
const YEAR = 2026;

const SOCIAL = [
  { label: "Instagram", href: "https://instagram.com" },
  { label: "YouTube", href: "https://youtube.com" },
  { label: "TikTok", href: "https://tiktok.com" },
];

/** Section 10 — black footer: last call, links, newsletter, socials, and the wordmark filling the bottom. */
export default function Footer() {
  const root = useRef<HTMLElement>(null);
  const [sent, setSent] = useState(false);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root.current);
      gsap.fromTo(
        q(".footer-mark"),
        { yPercent: 40, autoAlpha: 0 },
        { yPercent: 0, autoAlpha: 1, duration: 1.6, ease: "expo.out", scrollTrigger: { trigger: q(".footer-mark"), start: "top 95%", once: true } },
      );
    },
    { scope: root },
  );

  return (
    <footer ref={root} data-theme="dark" className="relative overflow-clip bg-ink text-peach">
      <div className="grain pointer-events-none absolute inset-[-50%] opacity-[0.06] mix-blend-screen" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_90%_0%,rgba(133,9,9,0.35),transparent_70%)]" />

      <div className="relative mx-auto max-w-[1440px] px-6 pt-24 md:px-12 md:pt-32">
        {/* last call */}
        <div className="flex flex-col gap-10 border-b border-peach/15 pb-16 md:flex-row md:items-end md:justify-between">
          <div className="max-w-[36rem]">
            <span className="text-[0.65rem] font-medium tracking-[0.38em] text-peach/60 uppercase">Begin</span>
            <h2 className="font-display mt-4 text-[clamp(2.2rem,4.5vw,4.4rem)] leading-[1.0]">
              Your verse is waiting to be <em className="text-tan not-italic">played.</em>
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button href="/reserve" variant="peach">Reserve a free demo</Button>
            <Button href="/packages" variant="outline" className="border-peach/40 text-peach hover:bg-peach hover:text-ink">Explore packages</Button>
          </div>
        </div>

        {/* columns */}
        <div className="grid gap-12 py-16 md:grid-cols-12">
          <div className="md:col-span-4">
            <Image src="/svg/auvox-primary-logo.svg" alt="AUVOX Music" width={120} height={41} unoptimized className="h-10 w-auto brightness-0 invert-[0.92] sepia-[0.3]" />
            <p className="mt-5 max-w-[20rem] text-sm leading-relaxed text-peach/60">
              Live instruction, structured learning, premium materials and personal guidance — one connected musical world. Toronto, Canada.
            </p>
          </div>
          <div className="md:col-span-2">
            <h3 className="text-[0.62rem] tracking-[0.35em] text-peach/50 uppercase">Explore</h3>
            <ul className="mt-5 space-y-2.5 text-sm">
              {NAV.map((n) => (
                <li key={n.href}>
                  <TransitionLink href={n.href} className="link-line text-peach/85">{n.label}</TransitionLink>
                </li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-2">
            <h3 className="text-[0.62rem] tracking-[0.35em] text-peach/50 uppercase">Start</h3>
            <ul className="mt-5 space-y-2.5 text-sm">
              <li><TransitionLink href="/reserve" className="link-line text-peach/85">Free demo</TransitionLink></li>
              <li><TransitionLink href="/packages" className="link-line text-peach/85">Packages</TransitionLink></li>
              <li><TransitionLink href="/enroll" className="link-line text-peach/85">Enroll</TransitionLink></li>
              <li><TransitionLink href="/dashboard" className="link-line text-peach/85">Student space</TransitionLink></li>
            </ul>
          </div>
          <div className="md:col-span-4">
            <h3 className="text-[0.62rem] tracking-[0.35em] text-peach/50 uppercase">Newsletter</h3>
            <form
              className="mt-5"
              onSubmit={(e) => {
                e.preventDefault();
                setSent(true);
              }}
            >
              <label className="field-line flex items-end gap-3 border-b border-peach/30 pb-2 focus-within:border-tan">
                <span className="sr-only">Email address</span>
                <input type="email" required placeholder="Your email" className="w-full bg-transparent py-1 text-sm text-peach placeholder:text-peach/35 focus:outline-none" />
                <button type="submit" className="text-[0.62rem] tracking-[0.3em] text-tan uppercase" aria-label="Subscribe">
                  {sent ? "Sent ✦" : "Join ↗"}
                </button>
              </label>
              <p className="mt-3 text-xs text-peach/45">Occasional notes on new verses, sessions and the Frequency Box. No noise.</p>
            </form>
            <ul className="mt-8 flex gap-5 text-[0.62rem] tracking-[0.3em] uppercase">
              {SOCIAL.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noreferrer" className="link-line text-peach/70">{s.label}</a>
                </li>
              ))}
              <li><a href={`mailto:${CONTACT_EMAIL}`} className="link-line text-peach/70">Email</a></li>
            </ul>
          </div>
        </div>
      </div>

      {/* the wordmark, filling the bottom */}
      <div className="footer-mark relative mx-auto max-w-[1440px] px-6 md:px-12" aria-hidden>
        <Image src="/svg/auvox-wordmark.svg" alt="" width={1309} height={300} unoptimized className="h-auto w-full brightness-0 invert-[0.92] sepia-[0.3] opacity-90" />
      </div>

      <div className="relative border-t border-peach/10">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-6 py-5 text-[0.62rem] tracking-[0.2em] text-peach/45 uppercase md:flex-row md:items-center md:justify-between md:px-12">
          <span>© {YEAR} AUVOX Music · Toronto</span>
          <span className="normal-case tracking-normal">
            3D models: “ibanez jem guitar” by abazibiz, “Casio MT-55” by Lassi Kaukonen — CC BY 4.0, modified.
          </span>
          <span className="flex gap-5">
            <TransitionLink href="/support" className="link-line">Support</TransitionLink>
            <span>Privacy</span>
            <span>Terms</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
