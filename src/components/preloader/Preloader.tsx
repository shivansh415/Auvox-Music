"use client";

import { useRef, useState } from "react";
import { useLenis } from "lenis/react";
import { gsap, useGSAP } from "@/lib/gsap";
import { usePreloaderStore } from "@/store/preloader";
import { MUSIC, WORDMARK } from "./logo-paths";

/** Flip to true before launch so returning visitors only see the preloader once per tab. */
const ONCE_PER_SESSION = false;
const SESSION_KEY = "auvox:preloader-seen";

const RED = "#850909";
const TAN = "#e7b47e";
const PEARL = "#f1ede9";
const BLACK = "#000000";

// Stage geometry (SVG user units). Wordmark sits at the top, MUSIC below, "presents" under that.
const W = WORDMARK.width; // 1309
const STAGE_H = 580;
const MUSIC_SCALE = (W * 0.4) / MUSIC.width;
const MUSIC_X = (W - MUSIC.width * MUSIC_SCALE) / 2;
const MUSIC_Y = WORDMARK.height + 44;
const PRESENTS_Y = MUSIC_Y + MUSIC.height * MUSIC_SCALE + 92;

// The five strings — one per letter — rest around the wordmark's vertical centre.
const STRING_CY = WORDMARK.height / 2;
const STRING_GAP = 26;
const STRING_THICKNESS = 1.4;
// Strings span the middle 56% of the wordmark width while they vibrate.
const STRING_X0 = W * 0.22;
const STRING_X1 = W * 0.78;
const STRING_SEGMENTS = 90;
const MAX_AMPLITUDE = 44;

/** Horizontal extent of each letter, so a string can gather over its letter before morphing. */
const LETTER_SPANS = WORDMARK.letters.map(({ d }) => {
  const xs = d.match(/-?\d*\.?\d+/g)!.map(Number).filter((_, k) => k % 2 === 0);
  return { x0: Math.min(...xs), x1: Math.max(...xs) };
});

/**
 * Builds a closed, filled "ribbon" for string `i`: a thin band whose centre line vibrates
 * like a plucked string (ends pinned). Being a closed shape lets MorphSVG morph it into a letter.
 */
function ribbonPath(i: number, t: number, amp: number, x0 = STRING_X0, x1 = STRING_X1) {
  const cy = STRING_CY + (i - 2) * STRING_GAP;
  const top: string[] = [];
  const bottom: string[] = [];
  for (let k = 0; k <= STRING_SEGMENTS; k++) {
    const u = k / STRING_SEGMENTS;
    const x = x0 + u * (x1 - x0);
    const envelope = Math.sin(Math.PI * u);
    const wave =
      Math.sin(u * Math.PI * 3.1 + t * 2.3 + i * 1.3) * 0.6 +
      Math.sin(u * Math.PI * 7.3 - t * 3.7 + i * 0.7) * 0.3 +
      Math.sin(u * Math.PI * 13 + t * 5.1 + i * 2.1) * 0.1;
    const y = cy + amp * envelope * wave;
    top.push(`${x.toFixed(1)} ${(y - STRING_THICKNESS / 2).toFixed(1)}`);
    bottom.push(`${x.toFixed(1)} ${(y + STRING_THICKNESS / 2).toFixed(1)}`);
  }
  return `M${top.join(" L")} L${bottom.reverse().join(" L")} Z`;
}

export default function Preloader() {
  const [mounted, setMounted] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const lenis = useLenis();
  const { setProgress, finish } = usePreloaderStore();

  useGSAP(
    () => {
      const overlay = root.current;
      if (!overlay) return;

      const done = () => {
        finish();
        lenis?.start();
        setMounted(false);
      };

      if (ONCE_PER_SESSION && sessionStorage.getItem(SESSION_KEY)) {
        done();
        return;
      }
      if (ONCE_PER_SESSION) sessionStorage.setItem(SESSION_KEY, "1");
      lenis?.stop();

      const q = gsap.utils.selector(overlay);
      const stage = q<SVGSVGElement>(".stage")[0];
      const strings = q<SVGPathElement>(".string");
      const musicLetters = q<SVGPathElement>(".music-letter");
      const presents = q<SVGTextElement>(".presents")[0];
      const bars = q<HTMLDivElement>(".bar");
      const counter = q<HTMLDivElement>(".counter")[0];
      const content = q<HTMLDivElement>(".content")[0];

      const state = { progress: 0, t: 0, wave: true };
      const setCounter = () => {
        const p = Math.round(state.progress);
        if (counterRef.current) counterRef.current.textContent = String(p).padStart(3, "0");
        setProgress(p);
      };

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reduceMotion) {
        // Static lockup, quick count, fade out.
        strings.forEach((el, i) => el.setAttribute("d", WORDMARK.letters[i].d));
        gsap.set([musicLetters, presents], { autoAlpha: 1 });
        gsap
          .timeline({ onComplete: done })
          .to(state, { progress: 100, duration: 0.8, ease: "power2.out", onUpdate: setCounter })
          .to(overlay, { autoAlpha: 0, duration: 0.6 }, "+=0.3");
        return;
      }

      // Strings vibrate while the counter runs; amplitude swells with progress then settles at 100.
      const tick = (_time: number, delta: number) => {
        if (!state.wave) return;
        state.t += delta / 1000;
        const p = state.progress / 100;
        const beat = 0.85 + 0.15 * Math.sin(state.t * 6);
        const amp = MAX_AMPLITUDE * Math.pow(Math.sin(Math.PI * p), 0.9) * beat;
        strings.forEach((el, i) => el.setAttribute("d", ribbonPath(i, state.t, amp)));
      };
      gsap.ticker.add(tick);

      // Counter: builds, hangs on 99 for a beat, then lands on 100.
      const count = gsap
        .timeline({ defaults: { onUpdate: setCounter } })
        .to(state, { progress: 99, duration: 2.3, ease: "power2.inOut" })
        .to(state, { progress: 100, duration: 0.25, ease: "power3.out" }, "+=0.35");

      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
        onComplete: () => {
          gsap.ticker.remove(tick);
          done();
        },
      });

      tl.fromTo(bars, { scaleY: 0 }, { scaleY: 1, duration: 0.9, ease: "expo.out" }, 0)
        .fromTo(
          strings,
          { scaleX: 0, opacity: 0, transformOrigin: "50% 50%" },
          { scaleX: 1, opacity: 1, duration: 1.1, stagger: 0.07, ease: "expo.out", smoothOrigin: false },
          0.25,
        )
        .fromTo(counter, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9 }, 0.4)
        .add(count, 0.7)

        // Strings resolve into the wordmark.
        .add("morph", ">-0.05")
        .add(() => {
          state.wave = false;
        }, "morph")
        // Drop the intro transform + its cached %-origin, otherwise GSAP's smoothOrigin re-centres each
        // letter on the old string midpoint once the shape changes and the wordmark piles up mid-screen.
        .set(strings, { clearProps: "transform,transformOrigin" }, "morph");
      // Two beats per string: gather over its letter's width, then bloom into the letter.
      strings.forEach((el, i) => {
        const { x0, x1 } = LETTER_SPANS[i];
        const gathered = ribbonPath(i, 0, 0, x0, x1);
        tl.to(
          el,
          { morphSVG: { shape: gathered, shapeIndex: "auto" }, duration: 0.7, ease: "expo.inOut" },
          `morph+=${i * 0.06}`,
        ).to(
          el,
          {
            morphSVG: { shape: WORDMARK.letters[i].d, shapeIndex: "auto" },
            duration: 1.1,
            ease: "power3.inOut",
          },
          `morph+=${0.55 + i * 0.07}`,
        );
      });
      tl.fromTo(
          musicLetters,
          { y: 34, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.05, ease: "expo.out" },
          "morph+=1.55",
        )
        .fromTo(
          presents,
          { autoAlpha: 0, attr: { "letter-spacing": 34 } },
          { autoAlpha: 1, attr: { "letter-spacing": 15 }, duration: 1.3, ease: "expo.out" },
          "morph+=1.8",
        )

        // The brand lockup lands in its true colours: red on pearl.
        .add("flip", "morph+=2.35")
        .to(overlay, { backgroundColor: PEARL, duration: 0.75, ease: "power2.inOut" }, "flip")
        .to([stage, counter], { color: RED, duration: 0.75, ease: "power2.inOut" }, "flip")

        // Exit: curtain lifts, the lockup lags behind for parallax.
        .add("exit", "flip+=1.05")
        .to(counter, { autoAlpha: 0, y: -12, duration: 0.45 }, "exit")
        .to(content, { y: 160, duration: 1.15, ease: "expo.inOut" }, "exit")
        .to(overlay, { yPercent: -100, duration: 1.15, ease: "expo.inOut" }, "exit");

      // React StrictMode mounts twice — without this the first ticker keeps overwriting `d` and blocks the morph.
      return () => {
        state.wave = false;
        gsap.ticker.remove(tick);
      };
    },
    { scope: root, dependencies: [lenis] },
  );

  if (!mounted) return null;

  return (
    <div
      ref={root}
      aria-hidden
      className="fixed inset-0 z-100 overflow-hidden bg-black text-tan select-none"
      style={{ backgroundColor: BLACK }}
    >
      {/* film grain */}
      <div className="grain pointer-events-none absolute inset-[-50%] opacity-[0.07] mix-blend-overlay" />

      {/* letterbox bars */}
      <div className="bar absolute inset-x-0 top-0 h-[11vh] origin-top bg-black" />
      <div className="bar absolute inset-x-0 bottom-0 h-[11vh] origin-bottom bg-black" />

      {/* logo stage */}
      <div className="content absolute inset-0 flex items-center justify-center">
        <svg
          className="stage w-[min(74vw,980px)] overflow-visible"
          viewBox={`0 0 ${W} ${STAGE_H}`}
          fill="currentColor"
          style={{ color: TAN }}
        >
          <g className="strings">
            {WORDMARK.letters.map((letter, i) => (
              <path key={letter.char} className="string" d={ribbonPath(i, 0, 0)} />
            ))}
          </g>
          <g transform={`translate(${MUSIC_X} ${MUSIC_Y}) scale(${MUSIC_SCALE})`}>
            {MUSIC.letters.map((letter) => (
              <path key={letter.char} className="music-letter opacity-0" d={letter.d} />
            ))}
          </g>
          <text
            className="presents opacity-0"
            x={W / 2}
            y={PRESENTS_Y}
            textAnchor="middle"
            fontSize={38}
            fontWeight={500}
            letterSpacing={15}
            style={{ fontFamily: "var(--font-afacad-flux), sans-serif" }}
          >
            PRESENTS
          </text>
        </svg>
      </div>

      {/* counter */}
      <div
        className="counter absolute right-[5vw] bottom-[calc(11vh-0.18em)] z-10 flex items-baseline gap-4 opacity-0"
        style={{ color: TAN }}
      >
        <span className="text-[0.7rem] font-medium tracking-[0.35em] uppercase opacity-60">
          Loading
        </span>
        <span
          ref={counterRef}
          className="font-sans text-[clamp(3.5rem,9vw,8.5rem)] leading-none font-semibold tabular-nums"
        >
          000
        </span>
      </div>
    </div>
  );
}
