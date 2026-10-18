"use client";

// The verse page's opening: a product showcase that plays as you scroll. One stage stays on screen
// for four chapters (the verse, then the client's three points). The instrument, a studio render of
// the same model as the home page, travels from side to side and turns to a new angle each chapter
// without ever shrinking; a colour blob follows it and changes shape; a big word sits over the blob;
// hand-drawn ink marks draw themselves around it; the copy takes the other half of the screen.

import { useMemo, useRef } from "react";
import { useLenis } from "lenis/react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { useTransition } from "@/store/transition";
import { VERSE_COPY, type Verse } from "@/content/packages";
import SectionHead from "@/components/ui/SectionHead";
import Button from "@/components/ui/Button";
import { LEARN_COPY, SHOWCASE_POSES, SHOWCASE_WORDS, VERSE_NAME } from "./copy";
import { DOODLES, blob } from "./doodles";
import RENDERS from "./renders.json";

const NUMERALS = ["I", "II", "III"];
/** chapter k's copy sits on the side away from the instrument */
const sideOf = (x: number) => (x > 0 ? "left" : "right");
/** seconds of timeline: a chapter rests for HOLD, then the change takes 1 */
const HOLD = 0.7;

export default function VerseShowcase({ verse, ready }: { verse: Verse; ready: boolean }) {
  const root = useRef<HTMLElement>(null);
  const go = useTransition();
  const copy = VERSE_COPY[verse];
  const poses = SHOWCASE_POSES[verse];
  const words = SHOWCASE_WORDS[verse];
  const doodles = DOODLES[verse];
  const N = poses.length;
  const lenis = useLenis();
  const blobs = useMemo(() => poses.map((_, i) => blob((verse === "guitar" ? 11 : 37) + i * 13, 330, 0.2)), [poses, verse]);

  // the scroll story
  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const movers = q<HTMLElement>(".vs-move");
      const imgs = q<HTMLElement>(".vs-img");
      const wordEls = q<HTMLElement>(".vs-word");
      const copies = q<HTMLElement>(".vs-copy");
      const sets = q<SVGGElement>(".vs-dset");
      const blobPath = q<SVGPathElement>(".vs-blob-path")[0];
      const blobSvg = q<SVGSVGElement>(".vs-blob")[0];
      const count = q<HTMLElement>(".vs-count")[0];
      const bar = q<HTMLElement>(".vs-bar")[0];

      // where chapter k puts the instrument: wide screens alternate sides, phones keep it up top
      const wide = () => window.innerWidth >= 1024;
      const px = (k: number) => (wide() ? (poses[k].x * window.innerWidth) / 100 : (k % 2 ? -1 : 1) * window.innerWidth * 0.04);
      const py = (k: number) => (wide() ? (poses[k].y * window.innerHeight) / 100 : -window.innerHeight * 0.2);

      // centring is done here (GSAP owns these elements' transforms)
      gsap.set([...imgs, blobSvg, q(".vs-doodles")[0], ...wordEls], { xPercent: -50, yPercent: -50 });
      // the resting state: chapter 0 on, the rest waiting
      gsap.set(movers, { x: () => px(0), y: () => py(0), rotation: poses[0].r });
      gsap.set(imgs.slice(1), { autoAlpha: 0 });
      gsap.set(wordEls.slice(1), { autoAlpha: 0, y: 70 });
      gsap.set(copies.slice(1), { autoAlpha: 0, y: 40 });
      sets.forEach((s, i) => gsap.set(s.querySelectorAll(".vs-ink"), { drawSVG: i === 0 ? "0% 0%" : "0% 0%" }));
      gsap.set(q(".vs-dot"), { autoAlpha: 0 });

      const tl = gsap.timeline({ defaults: { ease: "none" }, paused: true });
      for (let k = 0; k < N - 1; k++) {
        const t = HOLD + k * (1 + HOLD);
        const dir = poses[k + 1].x > poses[k].x ? 1 : -1;
        // the instrument and its blob travel together
        tl.to(movers, { x: () => px(k + 1), y: () => py(k + 1), rotation: poses[k + 1].r, duration: 1, ease: "power2.inOut" }, t);
        // it turns: the old angle leans away and fades as the new one leans in
        tl.to(imgs[k], { autoAlpha: 0, rotation: 7 * dir, duration: 0.28, ease: "power1.in" }, t + 0.3);
        tl.fromTo(imgs[k + 1], { autoAlpha: 0, rotation: -7 * dir }, { autoAlpha: 1, rotation: 0, duration: 0.38, ease: "power2.out", immediateRender: false }, t + 0.47);
        // the blob changes shape and turns a little
        tl.to(blobPath, { morphSVG: { shape: blobs[k + 1], shapeIndex: 0 }, duration: 1, ease: "power2.inOut" }, t);
        tl.to(blobSvg, { rotation: 22 * (k + 1) * dir, duration: 1, ease: "power2.inOut" }, t);
        // the big word
        tl.to(wordEls[k], { autoAlpha: 0, y: -70, duration: 0.35, ease: "power2.in" }, t + 0.05);
        tl.fromTo(wordEls[k + 1], { autoAlpha: 0, y: 70 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: "power3.out", immediateRender: false }, t + 0.55);
        // the copy
        tl.to(copies[k], { autoAlpha: 0, y: -40, duration: 0.3, ease: "power2.in" }, t);
        tl.fromTo(copies[k + 1], { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power3.out", immediateRender: false }, t + 0.6);
        // the ink: this chapter's marks un-draw, the next chapter's draw on
        tl.to(sets[k].querySelectorAll(".vs-ink"), { drawSVG: "100% 100%", duration: 0.35, stagger: 0.03, ease: "power1.in" }, t);
        tl.to(sets[k].querySelectorAll(".vs-dot"), { autoAlpha: 0, duration: 0.25 }, t);
        tl.fromTo(sets[k + 1].querySelectorAll(".vs-ink"), { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 0.5, stagger: 0.05, ease: "power2.out", immediateRender: false }, t + 0.6);
        tl.to(sets[k + 1].querySelectorAll(".vs-dot"), { autoAlpha: 1, duration: 0.3 }, t + 0.75);
      }
      tl.to({}, { duration: HOLD });

      const st = ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: "bottom bottom",
        scrub: reduce ? true : 0.7,
        invalidateOnRefresh: true,
        animation: tl,
        onUpdate: (self) => {
          const k = Math.min(N - 1, Math.max(0, Math.round(((self.progress * tl.duration() - HOLD / 2) / (1 + HOLD)))));
          if (count) count.textContent = String(k + 1).padStart(2, "0");
          if (bar) bar.style.transform = `scaleX(${self.progress})`;
        },
      });

      // when the scroll comes to rest between two chapters, it settles on the nearer one (never on a
      // half-turned instrument). Done through Lenis, which owns the scroll: ScrollTrigger's own snap
      // fought it and could throw the page to the far end.
      const rests = Array.from({ length: N }, (_, k) => (k === 0 ? 0 : k === N - 1 ? 1 : (HOLD / 2 + k * (1 + HOLD)) / tl.duration()));
      let settle = 0;
      let snapping = false;
      const onLenisScroll = () => {
        window.clearTimeout(settle);
        if (snapping || reduce || !lenis) return;
        settle = window.setTimeout(() => {
          const p = st.progress;
          if (p <= 0.001 || p >= 0.999) return;
          // only between chapters: inside a chapter's rest the page stays where it was left
          const t = p * tl.duration();
          const inRest = Array.from({ length: N }, (_, k) => k).some((k) => {
            const a = k === 0 ? 0 : HOLD + (k - 1) * (1 + HOLD) + 1;
            const b = a + (k === 0 ? HOLD : HOLD);
            return t >= a - 0.02 && t <= b + 0.02;
          });
          if (inRest) return;
          const target = rests.reduce((best, r) => (Math.abs(r - p) < Math.abs(best - p) ? r : best), rests[0]);
          snapping = true;
          lenis.scrollTo(st.start + target * (st.end - st.start), { duration: 0.75, easing: (x: number) => 1 - Math.pow(1 - x, 3), onComplete: () => (snapping = false) });
          window.setTimeout(() => (snapping = false), 1000);
        }, 160);
      };
      lenis?.on("scroll", onLenisScroll);

      // the pointer leans the instrument one way and the blob the other, for depth
      const tilt = q<HTMLElement>(".vs-tilt");
      const back = q<HTMLElement>(".vs-back");
      const tx = gsap.quickTo(tilt, "x", { duration: 1.1, ease: "power3.out" });
      const ty = gsap.quickTo(tilt, "y", { duration: 1.1, ease: "power3.out" });
      const bx = gsap.quickTo(back, "x", { duration: 1.4, ease: "power3.out" });
      const by = gsap.quickTo(back, "y", { duration: 1.4, ease: "power3.out" });
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
        lenis?.off("scroll", onLenisScroll);
        window.clearTimeout(settle);
        st.kill();
        tl.kill();
      };
    },
    { scope: root, dependencies: [verse, lenis] },
  );

  // the entrance, once the page is in view (after the preloader or under the page curtain)
  useGSAP(
    () => {
      const el = root.current;
      if (!el || !ready) return;
      const q = gsap.utils.selector(el);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      gsap
        .timeline({ defaults: { ease: "expo.out" } })
        .fromTo(q(".vs-blob"), { scale: 0.4, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: reduce ? 0.6 : 1.8 }, 0)
        .fromTo(q(".vs-word")[0], { y: 80, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.4 }, 0.15)
        .fromTo(q(".vs-img")[0], { y: 90, autoAlpha: 0, rotation: -6 }, { y: 0, autoAlpha: 1, rotation: 0, duration: reduce ? 0.6 : 2 }, 0.25)
        .fromTo(q(".vs-dset")[0].querySelectorAll(".vs-ink"), { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 1.4, stagger: 0.08, ease: "power2.out" }, 0.9)
        .fromTo(q(".vs-dset")[0].querySelectorAll(".vs-dot"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, 1.3)
        .fromTo(q(".vs-cta, .vs-foot"), { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.08 }, 1.0);
    },
    { scope: root, dependencies: [ready] },
  );

  return (
    <section ref={root} className="vs relative bg-peach text-ink" data-verse={verse} style={{ height: `calc(100svh + ${(N - 1) * 115}svh)` }} aria-label={`${VERSE_NAME[verse]} Verse`}>
      <div className="vs-stage sticky top-0 h-[100svh] overflow-hidden">
        <div className="vs-wash pointer-events-none absolute inset-0" />
        <div className="grain pointer-events-none absolute inset-0 opacity-[0.045] mix-blend-multiply" />

        {/* the colour blob follows the instrument, under the word */}
        <div className="vs-move vs-move-blob pointer-events-none absolute top-1/2 left-1/2" aria-hidden>
          <div className="vs-back">
            <svg className="vs-blob opacity-0" viewBox="-500 -500 1000 1000">
              <path className="vs-blob-path" d={blobs[0]} />
            </svg>
          </div>
        </div>

        {/* the big words, each on its chapter's side */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {words.map((w, i) => (
            <span
              key={w}
              className="vs-word font-display absolute leading-none whitespace-nowrap select-none"
              data-side={sideOf(poses[i].x)}
              // sized so the word fits its half of the screen (DM Serif runs ~0.62em a letter), a little toward the middle
              style={{ "--wx": `${poses[i].x * 0.85}vw`, "--wfit": `${Math.min(13, 44 / (w.length * 0.62))}vw` } as React.CSSProperties}
            >
              {w}
            </span>
          ))}
        </div>

        {/* the instrument: four angles of the same render set, one shown at a time */}
        <div className="vs-move pointer-events-none absolute top-1/2 left-1/2" aria-hidden>
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
                    className="vs-img absolute top-1/2 left-1/2 max-w-none"
                    style={{ "--ih": `${p.h}svh`, "--iw": `${p.w}vw`, opacity: i === 0 ? 0 : undefined } as React.CSSProperties}
                  />
                );
              })}
            </div>
            {/* the ink marks around it */}
            <svg className="vs-doodles absolute top-1/2 left-1/2" viewBox="-500 -500 1000 1000">
              {doodles.map((set, i) => (
                <g key={i} className="vs-dset">
                  {set.solid.map((d, j) => (
                    <path key={j} className="vs-ink" d={d} />
                  ))}
                  {set.dotted.map((d, j) => (
                    <path key={`d${j}`} className="vs-dot" d={d} />
                  ))}
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* the copy: the intro, then the three points */}
        <div className="vs-copy absolute z-10" data-side={sideOf(poses[0].x)}>
          {ready && <SectionHead as="h1" size="lg" immediate kicker={copy.kicker} title={copy.title} accent={copy.accent} body={copy.body} />}
          <div className="vs-cta mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 opacity-0">
            <Button href={`/enroll?package=${verse}-complete`} variant="ink">
              Enroll now
            </Button>
            <Button variant="outline" className="border-ink/30 text-ink" onClick={() => go("#packages")}>
              See packages
            </Button>
          </div>
        </div>
        {copy.points.map((p, i) => (
          <div key={p} className="vs-copy absolute z-10" data-side={sideOf(poses[i + 1].x)}>
            <div className="flex items-center gap-4">
              <span className="block h-px w-10 bg-ink/50" />
              <span className="text-[0.65rem] font-medium tracking-[0.38em] text-ink/70 uppercase">
                {VERSE_NAME[verse]} Verse · {NUMERALS[i]} / III
              </span>
            </div>
            <h2 className="font-display mt-6 text-[clamp(2.4rem,4.6vw,5rem)] leading-[1.0] tracking-[-0.015em]">
              {p.replace(/\.$/, "")}
              <span className="text-red">.</span>
            </h2>
            <p className="mt-6 max-w-[30rem] text-[1.05rem] leading-relaxed text-ink/75">{LEARN_COPY[verse][i]}</p>
          </div>
        ))}

        {/* where you are in the story */}
        <div className="vs-foot pointer-events-none absolute inset-x-0 bottom-6 z-10 flex items-center justify-center gap-4 text-[0.6rem] font-semibold tracking-[0.34em] text-ink/60 uppercase opacity-0 md:bottom-8">
          <span className="vs-count tabular-nums text-ink">01</span>
          <span className="relative block h-px w-24 overflow-hidden bg-ink/15">
            <span className="vs-bar absolute inset-0 origin-left bg-red" style={{ transform: "scaleX(0)" }} />
          </span>
          <span className="tabular-nums">{String(N).padStart(2, "0")}</span>
        </div>
      </div>
    </section>
  );
}
