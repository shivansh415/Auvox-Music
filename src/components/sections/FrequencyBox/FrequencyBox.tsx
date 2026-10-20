"use client";

// Section 7 — The Frequency Box, as a film you scroll through. The section is four screens tall
// and its stage stays pinned: the camera opens on a macro of the gold ink, pulls back to the
// whole box, moves round to its side to read the four pillars, and comes back wide for the
// headline and the call to action. Everything is driven by one scrubbed progress value (see
// Stage.tsx for the keyframes), so it plays the same forwards and backwards. The words sit in an
// editorial layer over the picture: small notes in the corners, numbered callouts, then the
// headline on the left. The box never opens; Guitar Box / Piano Box switches its print.
// Reduced motion shows the final frame.

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import Button from "@/components/ui/Button";
import { FREQUENCY_BOX } from "@/content/packages";
import { fbox, nudge } from "./state";
import { afterGate, expectReady } from "@/store/preloader";
import type { Edition } from "./textures";

const EDITIONS: { key: Edition; label: string }[] = [
  { key: "guitar", label: "Guitar Box" },
  { key: "piano", label: "Piano Box" },
];

/** the four pillars printed on the box's side, read down as the camera scans them */
const PILLARS = ["Musical Instruments", "Digital Production", "Chromatic Flux", "Harmonic Veil"];

/** the notes that accompany the camera, one at a time */
const NOTES = [
  { n: "01", text: "Gold ink on sand board. Forged in frequency." },
  { n: "02", text: "15 × 10 × 5 in. A rigid mailer, sealed until it reaches you." },
];

const Stage = dynamic(() => import("./Stage"), { ssr: false });

/** the headline with its last word in the accent colour */
function Headline({ title, accent }: { title: string; accent: string }) {
  const head = title.endsWith(accent) ? title.slice(0, -accent.length) : title;
  return (
    <>
      {head}
      <em className="text-red not-italic">{accent}</em>
    </>
  );
}

export default function FrequencyBox() {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  // the box's canvas mounts once the preloader's lockup is still (it warms there), or when the section comes near
  const [stageOn, setStageOn] = useState(false);
  const [phone, setPhone] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [edition, setEdition] = useState<Edition>("guitar");
  const pick = (e: Edition) => {
    if (e === edition) return;
    setEdition(e);
    // one full turn to show the new print (the throw decays to about 2π, then settles back)
    nudge(e === "piano" ? 15 : -15);
  };

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const on = () => setStageOn(true);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && on(), { rootMargin: "150% 0px" });
    io.observe(el);
    expectReady("fbox");
    const cancel = afterGate(on);
    const mq = window.matchMedia("(max-width: 767px)");
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setPhone(mq.matches);
      setReduce(rm.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    rm.addEventListener("change", sync);
    return () => {
      io.disconnect();
      cancel();
      mq.removeEventListener("change", sync);
      rm.removeEventListener("change", sync);
    };
  }, []);

  useGSAP(
    () => {
      const el = root.current;
      const st = stage.current;
      if (!el || !st) return;
      const q = gsap.utils.selector(el);
      fbox.spin = 0;
      fbox.vel = 0;

      if (reduce) {
        // no film: the final frame, with everything in place
        fbox.still = 1;
        fbox.progress = 1;
        gsap.set(q(".fb-final"), { autoAlpha: 1, y: 0, filter: "blur(0px)" });
        gsap.set(q(".fb-corner"), { autoAlpha: 1 });
        return;
      }
      fbox.still = 0;

      // the one value the whole film reads, smoothed a little behind the scroll
      const scrub = gsap.fromTo(
        fbox,
        { progress: 0 },
        { progress: 1, ease: "none", scrollTrigger: { trigger: el, start: "top top", end: "bottom bottom", scrub: 0.6 } },
      );

      // the words, cut to the camera: corner notes, then the two notes, the four callouts, the headline.
      // The positions below are fractions of the film, so the timeline is pinned to a duration of 1.
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top top", end: "bottom bottom", scrub: 0.6 } });
      tl.set({}, {}, 1);
      tl.fromTo(q(".fb-corner"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.04, ease: "none" }, 0.15);
      const notes = q<HTMLElement>(".fb-note");
      notes.forEach((n, i) => {
        const at = i === 0 ? 0.03 : 0.16;
        const until = i === 0 ? 0.13 : 0.29;
        tl.fromTo(n, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.04, ease: "power2.out" }, at).to(n, { autoAlpha: 0, y: -10, duration: 0.03, ease: "power2.in" }, until);
      });
      const callouts = q<HTMLElement>(".fb-callout");
      callouts.forEach((c, i) => {
        const at = 0.37 + i * 0.045;
        tl.fromTo(c, { autoAlpha: 0, x: -18 }, { autoAlpha: 1, x: 0, duration: 0.04, ease: "power2.out" }, at);
        tl.fromTo(c.querySelector(".fb-callout-line"), { scaleX: 0 }, { scaleX: 1, duration: 0.05, ease: "power2.inOut" }, at + 0.01);
      });
      tl.to(callouts, { autoAlpha: 0, x: -10, duration: 0.04, ease: "power2.in", stagger: 0.005 }, 0.6);
      tl.fromTo(q(".fb-head"), { autoAlpha: 0, y: 30, filter: "blur(14px)" }, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.1, ease: "power2.out" }, 0.66)
        .fromTo(q(".fb-body"), { autoAlpha: 0, y: 18, filter: "blur(8px)" }, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.08, ease: "power2.out" }, 0.73)
        .fromTo(q(".fb-foot"), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.1, ease: "power2.out" }, 0.78)
        .fromTo(q(".fb-hint"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.05 }, 0.82);

      return () => {
        scrub.scrollTrigger?.kill();
        scrub.kill();
        tl.scrollTrigger?.kill();
        tl.kill();
        ScrollTrigger.refresh();
      };
    },
    { scope: root, dependencies: [reduce] },
  );

  return (
    <section ref={root} id="frequency-box" className={clsx("fb relative bg-peach text-ink", reduce ? "h-[100svh]" : "h-[400svh] md:h-[440svh]")}>
      <div ref={stage} className="fb-stage sticky top-0 h-[100svh] overflow-hidden">
        <div className="fb-world absolute inset-0">{stageOn && <Stage edition={edition} phone={phone} />}</div>
        <div className="grain pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-multiply" aria-hidden />

        {/* the corners: what this is, and its size */}
        <div className="fb-corner pointer-events-none absolute top-[5.5rem] left-6 flex items-center gap-3 opacity-0 md:top-28 md:left-10">
          <span className="block h-px w-8 bg-ink/40" aria-hidden />
          <span className="text-[0.6rem] font-semibold tracking-[0.38em] text-ink/70 uppercase">{FREQUENCY_BOX.kicker}</span>
        </div>
        <div className="fb-corner pointer-events-none absolute top-[5.5rem] right-6 hidden items-center gap-3 opacity-0 md:top-28 md:right-10 md:flex">
          <span className="text-[0.6rem] font-semibold tracking-[0.38em] text-ink/70 uppercase">15 × 10 × 5 in</span>
          <span className="block h-px w-8 bg-ink/40" aria-hidden />
        </div>

        {/* the notes that travel with the camera */}
        {NOTES.map((n) => (
          <div key={n.n} className="fb-note pointer-events-none absolute bottom-[16svh] left-6 max-w-[18rem] opacity-0 md:bottom-[14svh] md:left-10 md:max-w-[22rem]">
            <span className="block text-[0.62rem] font-semibold tracking-[0.3em] text-red uppercase">{n.n}</span>
            <p className="mt-2 text-[0.95rem] leading-snug text-ink/85 md:text-[1.05rem]">{n.text}</p>
          </div>
        ))}

        {/* the four pillars, called out as the camera reads them off the side */}
        <ol className="pointer-events-none absolute top-1/2 left-6 -translate-y-1/2 md:left-10" aria-label="What the box holds">
          {PILLARS.map((p, i) => (
            <li key={p} className="fb-callout flex items-center gap-4 py-2.5 opacity-0 md:py-3.5">
              <span className="text-[0.6rem] font-semibold tracking-[0.3em] text-red">0{i + 1}</span>
              <span className="fb-callout-line block h-px w-10 origin-left bg-ink/45 md:w-16" aria-hidden />
              <span className="font-display text-[1.15rem] leading-none tracking-[-0.01em] text-ink md:text-[1.6rem]">{p}</span>
            </li>
          ))}
        </ol>

        {/* the showcase: words on the left, the box on the right (above and below it on phones) */}
        <div className="fb-final pointer-events-none absolute inset-x-0 top-0 flex flex-col px-6 pt-[9rem] md:inset-y-0 md:left-10 md:max-w-[34rem] md:justify-center md:px-0 md:pt-0">
          <div className="fb-head fb-final opacity-0">
            <h2 className="font-display max-w-[14ch] text-[clamp(2rem,4.4vw,4.2rem)] leading-[1.0] tracking-[-0.02em] text-ink">
              <Headline title={FREQUENCY_BOX.title} accent={FREQUENCY_BOX.accent} />
            </h2>
          </div>
          {/* the copy sits under the headline on wide screens; phones keep the headline and the call only */}
          <div className="fb-body fb-final mt-4 max-w-[26rem] opacity-0 md:mt-6">
            {FREQUENCY_BOX.body.map((p, i) => (
              <p key={i} className={clsx("hidden text-[0.9rem] leading-relaxed text-ink/70 md:block md:text-[1rem]", i > 0 && "mt-2")}>
                {p}
              </p>
            ))}
          </div>
          <div className="fb-foot fb-final pointer-events-auto mt-6 hidden flex-wrap items-center gap-4 opacity-0 md:mt-9 md:flex">
            <Button href="/reserve" variant="ink">
              {FREQUENCY_BOX.cta}
            </Button>
            <div role="radiogroup" aria-label="Edition" className="inline-flex rounded-full border border-ink/15 bg-ink/[0.04] p-1">
              {EDITIONS.map((e) => (
                <button
                  key={e.key}
                  type="button"
                  role="radio"
                  aria-checked={edition === e.key}
                  onClick={() => pick(e.key)}
                  className={clsx(
                    "rounded-full px-5 py-2.5 text-[0.78rem] font-medium tracking-[0.06em] transition-colors duration-300",
                    edition === e.key ? "bg-ink text-peach" : "text-ink/65 hover:text-ink",
                  )}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* phones: the call and the edition at the bottom, under the box */}
        <div className="fb-foot fb-final pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-6 pb-[7svh] opacity-0 md:hidden">
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3">
            <div role="radiogroup" aria-label="Edition" className="inline-flex rounded-full border border-ink/15 bg-ink/[0.04] p-1">
              {EDITIONS.map((e) => (
                <button
                  key={e.key}
                  type="button"
                  role="radio"
                  aria-checked={edition === e.key}
                  onClick={() => pick(e.key)}
                  className={clsx(
                    "rounded-full px-4 py-2 text-[0.74rem] font-medium tracking-[0.06em] transition-colors duration-300",
                    edition === e.key ? "bg-ink text-peach" : "text-ink/65",
                  )}
                >
                  {e.label}
                </button>
              ))}
            </div>
            <Button href="/reserve" variant="ink" size="sm">
              {FREQUENCY_BOX.cta}
            </Button>
          </div>
        </div>

        <span className="fb-hint fb-final pointer-events-none absolute right-4 bottom-[20svh] hidden opacity-0 pointer-coarse:flex" aria-hidden>
          <span className="tap-ring relative flex h-11 w-11 items-center justify-center rounded-full border border-ink/40 text-[0.5rem] font-semibold tracking-[0.2em] text-ink/70 uppercase">Drag</span>
        </span>
      </div>
    </section>
  );
}
