"use client";

// The verse page's opening: a product showcase that plays as you scroll. Four full-screen chapters
// (the verse, then the client's three points) scroll by like ordinary sections, each with its own
// colour blob, big word, ink marks and copy. The instrument doesn't scroll with them: it rides a
// sticky layer above them and never stops moving. It travels on one smooth curve through every
// chapter's spot, leaning into the direction it travels, and turns the whole way (a Blender image
// sequence scrubbed by the scroll, so it is a real render turning in 3D, not a swap between
// pictures). On wide screens it then carries on into the packages and lands beside their heading.

import { useEffect, useMemo, useRef } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { useTransition } from "@/store/transition";
import { VERSE_COPY, type Verse } from "@/content/packages";
import SectionHead from "@/components/ui/SectionHead";
import Button from "@/components/ui/Button";
import { LEARN_COPY, SHOWCASE_POSES, SHOWCASE_SEQ, SHOWCASE_SIZE, SHOWCASE_WORDS, VERSE_NAME } from "./copy";
import { DOODLES, blob } from "./doodles";

const NUMERALS = ["I", "II", "III"];
/** the copy sits on the side away from the instrument */
const sideOf = (x: number) => (x > 0 ? "left" : "right");
/** on phones the instrument lives in the top part of the screen */
const PHONE_Y = -0.2;
/** how much of its square the instrument fills at the landing angle (measured on the renders) */
const FILL = 0.82;

type P = { x: number; y: number };

/** a Catmull-Rom curve through the points, at t (0 = first point, 1 = second, ...) */
function curve(pts: P[], t: number): P {
  const n = pts.length - 1;
  const i = Math.min(Math.max(Math.floor(t), 0), n - 1);
  const u = Math.min(Math.max(t - i, 0), 1);
  const p1 = pts[i];
  const p2 = pts[i + 1];
  // past the ends, mirror the neighbour so the curve leaves and arrives smoothly
  const p0 = pts[i - 1] ?? { x: 2 * p1.x - p2.x, y: 2 * p1.y - p2.y };
  const p3 = pts[i + 2] ?? { x: 2 * p2.x - p1.x, y: 2 * p2.y - p1.y };
  const u2 = u * u;
  const u3 = u2 * u;
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
  return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) };
}

/** the square the instrument turns in, in px */
function sideFor(verse: Verse, W: number, H: number) {
  const s = SHOWCASE_SIZE[verse];
  return W >= 1024 ? Math.min((s.svh * H) / 100, (s.vw * W) / 100) : Math.min(W * 0.92, H * 0.52);
}

export default function VerseShowcase({ verse, ready }: { verse: Verse; ready: boolean }) {
  const root = useRef<HTMLElement>(null);
  const readyRef = useRef(ready);
  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);
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
      const cv = q<HTMLCanvasElement>(".vs-cv")[0];
      const ctx = cv.getContext("2d");
      const chapters = q<HTMLElement>(".vs-ch");
      const foot = q<HTMLElement>(".vs-foot")[0];
      const count = q<HTMLElement>(".vs-count")[0];
      const bar = q<HTMLElement>(".vs-bar")[0];
      const { legs, perLeg } = SHOWCASE_SEQ;

      // ---- the frames: every frame at 1200px for big/dense squares, every other one at 720px for phones
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const small = sideFor(verse, window.innerWidth, window.innerHeight) * dpr <= SHOWCASE_SEQ.sm + 40;
      const step = small ? 2 : 1;
      const total = (legs * perLeg) / step + 1;
      const px = small ? SHOWCASE_SEQ.sm : SHOWCASE_SEQ.lg;
      const frames: (HTMLImageElement | undefined)[] = new Array(total);
      const state = { t: 0 };
      let alive = true;
      let drawn = -1;

      // the nearest frame that has arrived
      const draw = () => {
        if (!ctx) return;
        const want = Math.round((state.t * perLeg) / step);
        let i = -1;
        for (let d = 0; d < total && i < 0; d++) {
          if (frames[want - d]) i = want - d;
          else if (frames[want + d]) i = want + d;
        }
        if (i < 0 || i === drawn) return;
        drawn = i;
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.drawImage(frames[i]!, 0, 0, cv.width, cv.height);
      };

      // first frame first, then coarse to fine (every 8th, 4th, 2nd, all): the turn works early
      // and only gets smoother as the rest arrive
      const order: number[] = [0, total - 1];
      const seen = new Set(order);
      for (const s of [8, 4, 2, 1]) {
        for (let i = 0; i < total; i += s) {
          if (seen.has(i)) continue;
          seen.add(i);
          order.push(i);
        }
      }
      const url = (i: number) => `/verse/seq/${verse}/${small ? "sm" : "lg"}/${String(i).padStart(3, "0")}.webp`;
      let next = 0;
      const pull = async () => {
        while (alive && next < order.length) {
          const i = order[next++];
          const img = new Image();
          img.decoding = "async";
          if (i !== 0) img.fetchPriority = "low";
          img.src = url(i);
          try {
            await img.decode();
          } catch {
            continue;
          }
          if (!alive) return;
          frames[i] = img;
          drawn = -1; // a nearer frame may have arrived
          draw();
        }
      };
      for (let k = 0; k < 4; k++) void pull();

      // ---- the layout, measured again on every refresh (resize, fonts, the page growing)
      let W = 0;
      let pts: P[] = [];
      let land = 1;
      const measure = () => {
        W = window.innerWidth;
        const H = window.innerHeight;
        const wide = W >= 1024;
        const side = sideFor(verse, W, H);
        cv.style.width = cv.style.height = `${side}px`;
        const back = Math.min(px, Math.round(side * dpr));
        if (cv.width !== back) {
          cv.width = cv.height = back;
          drawn = -1;
        }
        pts = poses.map((p, k) => (wide ? { x: (p.x * W) / 100, y: (p.y * H) / 100 } : { x: (k % 2 ? -1 : 1) * W * 0.04, y: H * PHONE_Y }));
        // the landing, beside the packages heading: where that spot will be on screen when the
        // stage lets go (the packages' top at the top of the screen)
        const spot = document.querySelector<HTMLElement>(".vs-land");
        const pk = document.getElementById("packages");
        land = 1;
        if (wide && spot && pk) {
          const r = spot.getBoundingClientRect();
          const top = pk.getBoundingClientRect().top;
          pts.push({ x: r.left + r.width / 2 - W / 2, y: r.top - top + r.height / 2 - H / 2 });
          land = Math.min(1, r.height / (side * FILL));
        }
      };

      const setX = gsap.quickSetter(mover, "x", "px");
      const setY = gsap.quickSetter(mover, "y", "px");
      const setS = gsap.quickSetter(mover, "scale");
      const setR = gsap.quickSetter(mover, "rotation", "deg");
      const render = () => {
        const t = Math.min(state.t, pts.length - 1);
        const p = curve(pts, t);
        // lean into the travel: a few degrees, from how fast it is moving sideways right now
        const a = curve(pts, Math.max(0, t - 0.02));
        const b = curve(pts, Math.min(pts.length - 1, t + 0.02));
        const lean = reduce ? 0 : gsap.utils.clamp(-6, 6, ((b.x - a.x) / 0.04 / Math.max(W, 1)) * 4);
        // the landing leg settles it into the spot beside the heading
        const k = gsap.utils.clamp(0, 1, t - (N - 1));
        const ease = k * k * (3 - 2 * k);
        setX(p.x);
        setY(p.y);
        setS(1 + (land - 1) * ease);
        setR(lean * (1 - ease));
        draw();
        if (count) count.textContent = String(Math.min(N - 1, Math.round(t)) + 1).padStart(2, "0");
        if (bar) bar.style.transform = `scaleX(${Math.min(1, t / (N - 1))})`;
        if (foot && readyRef.current) foot.style.opacity = String(1 - k);
      };

      measure();
      render();

      // the whole trip is one scrubbed value: chapter k is centred at exactly t = k; on wide screens
      // one more screen of scroll after the last chapter is the landing
      const mm = gsap.matchMedia();
      mm.add({ wide: "(min-width: 1024px)", narrow: "(max-width: 1023px)" }, (c) => {
        const isWide = !!c.conditions?.wide;
        gsap.fromTo(
          state,
          { t: 0 },
          {
            t: isWide ? N : N - 1,
            ease: "none",
            onUpdate: render,
            scrollTrigger: { trigger: el, start: "top top", end: isWide ? "bottom top" : "bottom bottom", scrub: reduce ? true : 0.6 },
          },
        );
      });
      const onRefresh = () => {
        measure();
        drawn = -1;
        render();
      };
      ScrollTrigger.addEventListener("refresh", onRefresh);

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
        alive = false;
        window.removeEventListener("pointermove", onMove);
        ScrollTrigger.removeEventListener("refresh", onRefresh);
        mm.revert();
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
        .fromTo(q(".vs-tilt"), { y: 90 }, { y: 0, duration: reduce ? 0.6 : 2 }, 0.25)
        .fromTo(q(".vs-float"), { autoAlpha: 0 }, { autoAlpha: 1, duration: reduce ? 0.6 : 1.4, ease: "power2.out" }, 0.25)
        .fromTo(first(".vs-ink"), { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 1.4, stagger: 0.08, ease: "power2.out" }, 0.9)
        .fromTo(first(".vs-dot"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, 1.3)
        .fromTo(q(".vs-cta, .vs-foot"), { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.08 }, 1.0);
    },
    { scope: root, dependencies: [ready] },
  );

  return (
    <section ref={root} className="vs relative bg-peach text-ink" data-verse={verse} aria-label={`${VERSE_NAME[verse]} Verse`}>
      {/* the instrument: a screen-sized stage that stays put while the chapters scroll under it (on
          wide screens the rail runs one screen past the section, for the landing by the packages) */}
      <div className="vs-rail pointer-events-none absolute inset-x-0 top-0 z-20" aria-hidden>
        <div className="vs-stage sticky top-0 h-[100svh] overflow-hidden">
          <div className="vs-move absolute top-1/2 left-1/2">
            <div className="vs-tilt">
              <div className="vs-float opacity-0">
                <canvas className="vs-cv block" width={1} height={1} />
              </div>
            </div>
          </div>

          {/* where you are in the story (bottom left: the site-wide scroll cue owns the bottom centre) */}
          <div className="vs-foot absolute bottom-8 left-[max(6vw,calc((100vw_-_1440px)/2_+_3rem))] hidden items-center gap-4 text-[0.6rem] font-semibold tracking-[0.34em] text-ink/60 uppercase opacity-0 lg:flex">
            <span className="vs-count text-ink tabular-nums">01</span>
            <span className="relative block h-px w-24 overflow-hidden bg-ink/15">
              <span className="vs-bar absolute inset-0 origin-left bg-red" style={{ transform: "scaleX(0)" }} />
            </span>
            <span className="tabular-nums">{String(N).padStart(2, "0")}</span>
          </div>
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

            {/* this chapter's spot: where the instrument passes while the chapter is centred */}
            <div className="vs-spot pointer-events-none absolute" style={{ "--sx": `${pose.x}vw`, "--sy": `${pose.y}svh` } as React.CSSProperties} aria-hidden>
              <div className="vs-back">
                <svg className="vs-blob" viewBox="-500 -500 1000 1000">
                  <path className="vs-blob-path" d={blobs[i]} />
                </svg>
              </div>
            </div>

            {/* the big word, on the instrument side, over the blob */}
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
                  {ready ? (
                    <SectionHead as="h1" size="lg" immediate kicker={copy.kicker} title={copy.title} accent={copy.accent} body={copy.body} />
                  ) : (
                    // the heading animates in once the page is in view; until then (and in the server
                    // HTML, for search engines and screen readers) the page still has its h1
                    <h1 className="sr-only">{copy.title}</h1>
                  )}
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
