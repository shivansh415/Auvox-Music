"use client";

// The verse page's opening: a product showcase that plays as you scroll. Four full-screen chapters
// (the verse, then the client's three points) scroll by like ordinary sections, each with its own
// colour blob, big word, ink marks and copy. The instrument doesn't scroll with them: it stays on
// screen the whole way down, gliding from one chapter's spot to the next and turning to a new angle
// as it goes (studio renders of the same model as the home page), so it is always where the chapter
// you're looking at expects it. Nothing waits or fades in place; everything moves with the scroll.

import { useMemo, useRef } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { useTransition } from "@/store/transition";
import { VERSE_COPY, type Verse } from "@/content/packages";
import SectionHead from "@/components/ui/SectionHead";
import Button from "@/components/ui/Button";
import { LEARN_COPY, SHOWCASE_POSES, SHOWCASE_WORDS, VERSE_NAME } from "./copy";
import { DOODLES, blob } from "./doodles";
import RENDERS from "./renders.json";

const NUMERALS = ["I", "II", "III"];
/** the copy sits on the side away from the instrument */
const sideOf = (x: number) => (x > 0 ? "left" : "right");
/** on phones the instrument lives in the top part of the screen */
const PHONE_Y = -0.2;

export default function VerseShowcase({ verse, ready }: { verse: Verse; ready: boolean }) {
  const root = useRef<HTMLElement>(null);
  const go = useTransition();
  const copy = VERSE_COPY[verse];
  const poses = SHOWCASE_POSES[verse];
  const words = SHOWCASE_WORDS[verse];
  const doodles = DOODLES[verse];
  const N = poses.length;
  const blobs = useMemo(() => poses.map((_, i) => blob((verse === "guitar" ? 11 : 37) + i * 13, 330, 0.2)), [poses, verse]);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const mover = q<HTMLElement>(".vs-move")[0];
      const imgs = q<HTMLElement>(".vs-img");
      const chapters = q<HTMLElement>(".vs-ch");
      const count = q<HTMLElement>(".vs-count")[0];
      const bar = q<HTMLElement>(".vs-bar")[0];

      const wide = () => window.innerWidth >= 1024;
      const px = (k: number) => (wide() ? (poses[k].x * window.innerWidth) / 100 : (k % 2 ? -1 : 1) * window.innerWidth * 0.04);
      const py = (k: number) => (wide() ? (poses[k].y * window.innerHeight) / 100 : window.innerHeight * PHONE_Y);

      gsap.set(imgs, { xPercent: -50, yPercent: -50, transformPerspective: 1400 });
      gsap.set(imgs.slice(1), { autoAlpha: 0 });
      gsap.set(mover, { x: () => px(0), y: () => py(0), rotation: poses[0].r });

      // the instrument's glide: chapter k is centred on screen at exactly k/(N-1) of the way, and the
      // instrument is exactly at chapter k's spot then; between them it travels and turns, no pauses
      const tl = gsap.timeline({ defaults: { ease: "none" }, paused: true });
      for (let k = 0; k < N - 1; k++) {
        const dir = poses[k + 1].x > poses[k].x ? 1 : -1;
        tl.to(mover, { x: () => px(k + 1), y: () => py(k + 1), rotation: poses[k + 1].r, duration: 1, ease: "sine.inOut" }, k);
        // a lift in the middle of the trip, so it reads as being carried, not slid
        tl.to(mover, { scale: 1.05, duration: 0.5, ease: "sine.out" }, k).to(mover, { scale: 1, duration: 0.5, ease: "sine.in" }, k + 0.5);
        // the turn: the old angle spins away edge-on as the new one spins in from the other side, so
        // the two only overlap while both are thin and faint (a spin, not a double exposure)
        tl.to(imgs[k], { rotationY: 78 * dir, rotation: 6 * dir, autoAlpha: 0, duration: 0.3, ease: "power1.in" }, k + 0.34);
        tl.fromTo(
          imgs[k + 1],
          { rotationY: -78 * dir, rotation: -6 * dir, autoAlpha: 0 },
          { rotationY: 0, rotation: 0, autoAlpha: 1, duration: 0.3, ease: "power1.out", immediateRender: false },
          k + 0.56,
        );
      }

      const st = ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: "bottom bottom",
        scrub: reduce ? true : 0.6,
        invalidateOnRefresh: true,
        animation: tl,
        onUpdate: (self) => {
          const k = Math.round(self.progress * (N - 1));
          if (count) count.textContent = String(k + 1).padStart(2, "0");
          if (bar) bar.style.transform = `scaleX(${self.progress})`;
        },
      });

      // each chapter as it comes up: the blob swells and turns, the word rises, the ink draws on,
      // the copy arrives (all tied to the scroll, so they reverse on the way back up)
      chapters.forEach((ch, k) => {
        if (k === 0) return; // the first chapter is on screen from the start (see the entrance)
        const c = gsap.utils.selector(ch);
        gsap
          .timeline({ scrollTrigger: { trigger: ch, start: "top 85%", end: "top 15%", scrub: reduce ? true : 0.5 } })
          .fromTo(c(".vs-blob"), { scale: 0.55, rotation: -30 }, { scale: 1, rotation: 0, ease: "power2.out", duration: 1 }, 0)
          .fromTo(c(".vs-word"), { yPercent: 40, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, ease: "power2.out", duration: 0.7 }, 0.15)
          .fromTo(c(".vs-ink"), { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", ease: "none", duration: 0.6, stagger: 0.06 }, 0.3)
          .fromTo(c(".vs-dot"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 0.6)
          .fromTo(c(".vs-copy-in"), { y: 60, autoAlpha: 0 }, { y: 0, autoAlpha: 1, ease: "power2.out", duration: 0.6 }, 0.35);
      });

      // the pointer leans the instrument; the blobs lean the other way, for depth
      const tilt = q<HTMLElement>(".vs-tilt")[0];
      const tx = gsap.quickTo(tilt, "x", { duration: 1.1, ease: "power3.out" });
      const ty = gsap.quickTo(tilt, "y", { duration: 1.1, ease: "power3.out" });
      const backs = q<HTMLElement>(".vs-back");
      const bx = gsap.quickTo(backs, "x", { duration: 1.4, ease: "power3.out" });
      const by = gsap.quickTo(backs, "y", { duration: 1.4, ease: "power3.out" });
      const onMove = (e: PointerEvent) => {
        if (e.pointerType !== "mouse" || reduce) return;
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        tx(nx * 26);
        ty(ny * 18);
        bx(nx * -14);
        by(ny * -10);
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      return () => {
        window.removeEventListener("pointermove", onMove);
        st.kill();
        tl.kill();
      };
    },
    { scope: root, dependencies: [verse] },
  );

  // the entrance, once the page is in view (after the preloader or under the page curtain)
  useGSAP(
    () => {
      const el = root.current;
      if (!el || !ready) return;
      const q = gsap.utils.selector(el);
      const first = gsap.utils.selector(q(".vs-ch")[0]);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      gsap
        .timeline({ defaults: { ease: "expo.out" } })
        .fromTo(first(".vs-blob"), { scale: 0.4, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: reduce ? 0.6 : 1.8 }, 0)
        .fromTo(first(".vs-word"), { yPercent: 40, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.4 }, 0.15)
        .fromTo(q(".vs-img")[0], { y: 90, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: reduce ? 0.6 : 2 }, 0.25)
        .fromTo(first(".vs-ink"), { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 1.4, stagger: 0.08, ease: "power2.out" }, 0.9)
        .fromTo(first(".vs-dot"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, 1.3)
        .fromTo(q(".vs-cta, .vs-foot"), { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.08 }, 1.0);
    },
    { scope: root, dependencies: [ready] },
  );

  return (
    <section ref={root} className="vs relative bg-peach text-ink" data-verse={verse} aria-label={`${VERSE_NAME[verse]} Verse`}>
      {/* the instrument: one screen-sized layer that stays put while the chapters scroll under it */}
      <div className="vs-pin pointer-events-none sticky top-0 z-20 -mb-[100svh] h-[100svh] overflow-hidden" aria-hidden>
        <div className="vs-move absolute top-1/2 left-1/2">
          <div className="vs-tilt">
            <div className="vs-float">
              {poses.map((p, i) => {
                const r = (RENDERS as Record<string, { w: number; h: number }>)[`${verse}-${i}`];
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={`/verse/${verse}-${i}.webp`}
                    width={r.w}
                    height={r.h}
                    alt=""
                    decoding="async"
                    loading="eager"
                    fetchPriority={i === 0 ? "high" : "low"}
                    className="vs-img absolute top-0 left-0 max-w-none"
                    style={{ "--ih": `${p.h}svh`, "--iw": `${p.w}vw`, opacity: 0 } as React.CSSProperties}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* where you are in the story (bottom left: the site-wide scroll cue owns the bottom centre) */}
        <div className="vs-foot absolute bottom-8 left-[max(6vw,calc((100vw-1440px)/2+3rem))] hidden items-center gap-4 text-[0.6rem] font-semibold tracking-[0.34em] text-ink/60 uppercase opacity-0 lg:flex">
          <span className="vs-count tabular-nums text-ink">01</span>
          <span className="relative block h-px w-24 overflow-hidden bg-ink/15">
            <span className="vs-bar absolute inset-0 origin-left bg-red" style={{ transform: "scaleX(0)" }} />
          </span>
          <span className="tabular-nums">{String(N).padStart(2, "0")}</span>
        </div>
      </div>

      {/* the chapters: ordinary full-screen sections, scrolling by under the instrument */}
      {poses.map((pose, i) => {
        const side = sideOf(pose.x);
        const word = words[i];
        const set = doodles[i];
        return (
          <div key={i} className="vs-ch relative h-[100svh] overflow-hidden" data-k={i}>
            <div className="vs-wash pointer-events-none absolute inset-0" />
            <div className="grain pointer-events-none absolute inset-0 opacity-[0.045] mix-blend-multiply" />

            {/* this chapter's spot: where the instrument will be when the chapter is centred */}
            <div className="vs-spot pointer-events-none absolute" style={{ "--sx": `${pose.x}vw`, "--sy": `${pose.y}svh` } as React.CSSProperties} aria-hidden>
              <div className="vs-back">
                <svg className="vs-blob" viewBox="-500 -500 1000 1000">
                  <path className="vs-blob-path" d={blobs[i]} />
                </svg>
              </div>
            </div>

            {/* the big word, on the instrument's side, over the blob */}
            <span
              className="vs-word font-display pointer-events-none absolute leading-none whitespace-nowrap select-none"
              aria-hidden
              // sized so the word fits its half of the screen (DM Serif runs ~0.62em a letter), a little toward the middle
              style={{ "--wx": `${pose.x * 0.85}vw`, "--wfit": `${Math.min(13, 44 / (word.length * 0.62))}vw` } as React.CSSProperties}
            >
              {word}
            </span>

            {/* the ink marks around the spot */}
            <div className="vs-spot pointer-events-none absolute z-30" style={{ "--sx": `${pose.x}vw`, "--sy": `${pose.y}svh` } as React.CSSProperties} aria-hidden>
              <svg className="vs-doodles" viewBox="-500 -500 1000 1000">
                {set.solid.map((d, j) => (
                  <path key={j} className="vs-ink" d={d} />
                ))}
                {set.dotted.map((d, j) => (
                  <path key={`d${j}`} className="vs-dot" d={d} />
                ))}
              </svg>
            </div>

            {/* the copy, on the other half */}
            <div className="vs-copy absolute z-10" data-side={side}>
              {i === 0 ? (
                <>
                  {ready && <SectionHead as="h1" size="lg" immediate kicker={copy.kicker} title={copy.title} accent={copy.accent} body={copy.body} />}
                  <div className="vs-cta mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 opacity-0">
                    <Button href={`/enroll?package=${verse}-complete`} variant="ink">
                      Enroll now
                    </Button>
                    <Button variant="outline" className="border-ink/30 text-ink" onClick={() => go("#packages")}>
                      See packages
                    </Button>
                  </div>
                </>
              ) : (
                <div className="vs-copy-in">
                  <div className="flex items-center gap-4">
                    <span className="block h-px w-10 bg-ink/50" />
                    <span className="text-[0.65rem] font-medium tracking-[0.38em] text-ink/70 uppercase">
                      {VERSE_NAME[verse]} Verse · {NUMERALS[i - 1]} / III
                    </span>
                  </div>
                  <h2 className="font-display mt-6 text-[clamp(2.4rem,4.6vw,5rem)] leading-[1.0] tracking-[-0.015em]">
                    {copy.points[i - 1].replace(/\.$/, "")}
                    <span className="text-red">.</span>
                  </h2>
                  <p className="mt-6 max-w-[30rem] text-[1.05rem] leading-relaxed text-ink/75">{LEARN_COPY[verse][i - 1]}</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
