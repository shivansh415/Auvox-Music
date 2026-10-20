"use client";

// Section 7 — The Frequency Box, as a film you scroll through. The section is four screens tall
// and its stage stays pinned: the Journey's peach darkens into a warm studio night, a line of light
// grows into the box, the box turns through a gallery of floating images, a light sweeps across it
// as the headline arrives, then a pedestal rises and the box settles onto it for the final
// showcase (headline above, call to action below). Everything is driven by one scrubbed progress
// value (see Stage.tsx for the keyframes), so it plays the same forwards and backwards. The box
// never opens; Guitar Box / Piano Box switches its print. Reduced motion shows the final frame.

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import Button from "@/components/ui/Button";
import { FREQUENCY_BOX } from "@/content/packages";
import { fbox, kf, nudge } from "./state";
import { afterGate, expectReady } from "@/store/preloader";
import type { Edition } from "./textures";

const EDITIONS: { key: Edition; label: string }[] = [
  { key: "guitar", label: "Guitar Box" },
  { key: "piano", label: "Piano Box" },
];

const Stage = dynamic(() => import("./Stage"), { ssr: false });

/** the headline with its last word in the accent colour */
function Headline({ title, accent }: { title: string; accent: string }) {
  const head = title.endsWith(accent) ? title.slice(0, -accent.length) : title;
  return (
    <>
      {head}
      <em className="text-tan not-italic">{accent}</em>
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
    // one full turn to show the new print (the throw decays to about 2π, then settles facing front)
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

      // the night falls over the first fifth; the vignette and the burgundy glow come with it
      const paint = () => {
        const p = fbox.progress;
        st.style.setProperty("--fb-dark", kf(p, [[0.01, 0], [0.12, 1]]).toFixed(3));
        st.style.setProperty("--fb-glow", kf(p, [[0.12, 0], [0.36, 0.8], [0.86, 0.35]]).toFixed(3));
      };

      if (reduce) {
        // no film: the final frame, with everything in place
        fbox.still = 1;
        fbox.progress = 1;
        paint();
        gsap.set(q(".fb-in"), { autoAlpha: 1, y: 0, filter: "blur(0px)" });
        return;
      }
      fbox.still = 0;

      // the one value the whole film reads, smoothed a little behind the scroll
      const scrub = gsap.fromTo(
        fbox,
        { progress: 0 },
        { progress: 1, ease: "none", scrollTrigger: { trigger: el, start: "top top", end: "bottom bottom", scrub: 0.6 } },
      );
      gsap.ticker.add(paint);

      // the words: the headline blurs in as the light sweeps the box, the copy and the call follow
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top top", end: "bottom bottom", scrub: 0.6 } });
      tl.fromTo(q(".fb-head"), { autoAlpha: 0, y: 34, filter: "blur(16px)" }, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.12, ease: "power2.out" }, 0.48)
        .fromTo(q(".fb-body"), { autoAlpha: 0, y: 20, filter: "blur(10px)" }, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.1, ease: "power2.out" }, 0.55)
        .fromTo(q(".fb-foot"), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.12, ease: "power2.out" }, 0.64)
        .fromTo(q(".fb-hint"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.06 }, 0.7);

      return () => {
        gsap.ticker.remove(paint);
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
    <section ref={root} id="frequency-box" data-theme="dark" className={clsx("fb relative bg-peach text-pearl", reduce ? "h-[100svh]" : "h-[380svh] md:h-[420svh]")}>
      <div ref={stage} className="fb-stage sticky top-0 h-[100svh] overflow-hidden" style={{ "--fb-dark": 0, "--fb-glow": 0 } as React.CSSProperties}>
        {/* the night, the glow behind the box, the vignette: all driven by the film */}
        <div className="fb-night pointer-events-none absolute inset-0" aria-hidden />
        <div className="fb-glow pointer-events-none absolute inset-0" aria-hidden />
        <div className="grain pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-screen" aria-hidden />

        {stageOn && <Stage edition={edition} phone={phone} />}
        <div className="fb-vignette pointer-events-none absolute inset-0" aria-hidden />

        {/* the words, over the scene */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center px-6 pt-[14svh] text-center md:pt-[13svh]">
          <div className="fb-head fb-in w-full opacity-0">
            <span className="block text-[0.62rem] font-semibold tracking-[0.42em] text-tan/90 uppercase">{FREQUENCY_BOX.kicker}</span>
            {/* max-width in the headline's own ch, so it sets as two or three lines */}
            <h2 className="font-display mx-auto mt-5 max-w-[36ch] text-[clamp(1.9rem,3.9vw,3.6rem)] leading-[1.02] tracking-[-0.02em] text-pearl">
              <Headline title={FREQUENCY_BOX.title} accent={FREQUENCY_BOX.accent} />
            </h2>
          </div>
          <div className="fb-body fb-in mt-5 max-w-[30rem] opacity-0">
            {FREQUENCY_BOX.body.map((p, i) => (
              <p key={i} className={clsx("text-[0.9rem] leading-relaxed text-peach/65 md:text-[0.95rem]", i > 0 && "mt-1.5 hidden md:block")}>
                {p}
              </p>
            ))}
          </div>
        </div>

        <div className="fb-foot fb-in pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 px-6 pb-[12svh] opacity-0 md:pb-[11svh]">
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-4">
            <div role="radiogroup" aria-label="Edition" className="inline-flex rounded-full border border-pearl/20 bg-pearl/5 p-1 backdrop-blur-sm">
              {EDITIONS.map((e) => (
                <button
                  key={e.key}
                  type="button"
                  role="radio"
                  aria-checked={edition === e.key}
                  onClick={() => pick(e.key)}
                  className={clsx(
                    "rounded-full px-5 py-2.5 text-[0.78rem] font-medium tracking-[0.06em] transition-colors duration-300",
                    edition === e.key ? "bg-pearl text-ink" : "text-pearl/70 hover:text-pearl",
                  )}
                >
                  {e.label}
                </button>
              ))}
            </div>
            <Button href="/reserve" variant="peach">
              {FREQUENCY_BOX.cta}
            </Button>
          </div>
          <p className="hidden items-center gap-4 text-[0.6rem] font-medium tracking-[0.38em] text-pearl/45 uppercase md:flex">
            <span className="block h-px w-8 bg-pearl/25" aria-hidden />
            <span>15 × 10 × 5 in · sealed until it reaches you</span>
            <span className="block h-px w-8 bg-pearl/25" aria-hidden />
          </p>
        </div>

        <span className="fb-hint fb-in pointer-events-none absolute right-4 bottom-[22svh] hidden opacity-0 pointer-coarse:flex" aria-hidden>
          <span className="tap-ring relative flex h-11 w-11 items-center justify-center rounded-full border border-pearl/50 text-[0.5rem] font-semibold tracking-[0.2em] text-pearl/80 uppercase">Drag</span>
        </span>
      </div>
    </section>
  );
}
