"use client";

import { useEffect, useRef, useState } from "react";
import { useLenis } from "lenis/react";
import { gsap, useGSAP } from "@/lib/gsap";
import { usePreloaderStore, whenReady } from "@/store/preloader";
import { plateToScreen, session, SIGN_WORDMARK } from "@/components/sections/Session/state";
import { setMuted, unlockAudio } from "@/components/sections/Session/audio";
import { MUSIC, WORDMARK } from "./logo-paths";

/** Flip to true before launch so returning visitors only see the preloader once per tab. */
const ONCE_PER_SESSION = false;
const SESSION_KEY = "auvox:preloader-seen";

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
  const enterGo = useRef<(withSound: boolean) => void>(() => {});
  const lenis = useLenis();
  const lenisRef = useRef(lenis);
  const { setProgress, finish, openGate } = usePreloaderStore();

  // Lenis is created a moment after this mounts: hold the page still as soon as it exists (until
  // the preloader is done). The timeline below is built once and reaches Lenis through the ref; if
  // it depended on `lenis` it would be built twice, with the first run's key listener and ticker
  // left behind (a later Space or Enter anywhere would then "enter with sound" and unmute the site).
  useEffect(() => {
    lenisRef.current = lenis;
    if (lenis && !usePreloaderStore.getState().done) lenis.stop();
  }, [lenis]);

  useGSAP(
    () => {
      const overlay = root.current;
      if (!overlay) return;

      const done = () => {
        finish();
        lenisRef.current?.start();
        setMounted(false);
      };

      // Dev shortcut: /?nopreloader skips straight to the site.
      const skip =
        process.env.NODE_ENV === "development" &&
        new URLSearchParams(window.location.search).has("nopreloader");
      // never replay within the same app session (route changes keep this component mounted)
      if (skip || usePreloaderStore.getState().done || (ONCE_PER_SESSION && sessionStorage.getItem(SESSION_KEY))) {
        done();
        return;
      }
      // the lockup only flies onto the studio wall on the home page; elsewhere it simply lifts away
      const home = window.location.pathname === "/";
      if (ONCE_PER_SESSION) sessionStorage.setItem(SESSION_KEY, "1");
      lenisRef.current?.stop();

      // while the strings play, only the network works: fetch the 3D models into the HTTP cache so
      // parsing them can start the moment the gate opens (fetching doesn't block the main thread)
      if (home) {
        for (const url of ["/models/guitar-red.glb", "/models/casio.glb", "/models/guitar-red-sm.glb", "/models/casio-sm.glb", "/world/studio_1k.hdr"]) {
          void fetch(url, { priority: "low" } as RequestInit).catch(() => {});
        }
      }

      const q = gsap.utils.selector(overlay);
      const stage = q<SVGSVGElement>(".stage")[0];
      const strings = q<SVGPathElement>(".string");
      const musicLetters = q<SVGPathElement>(".music-letter");
      const presents = q<SVGTextElement>(".presents")[0];
      const bars = q<HTMLDivElement>(".bar");
      const counter = q<HTMLDivElement>(".counter")[0];
      const grain = q<HTMLDivElement>(".grain")[0];
      const enter = q<HTMLDivElement>(".enter")[0];

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
        // never fully flat: a faint tremor stays while the counter hangs on 99
        const amp = MAX_AMPLITUDE * Math.max(0.06, Math.pow(Math.sin(Math.PI * p), 0.9)) * beat;
        strings.forEach((el, i) => el.setAttribute("d", ribbonPath(i, state.t, amp)));
      };
      gsap.ticker.add(tick);

      // Counter: builds, hangs on 99 for a beat, then lands on 100.
      const count = gsap
        .timeline({ defaults: { onUpdate: setCounter } })
        .to(state, { progress: 99, duration: 2.3, ease: "power2.inOut" })
        .to({}, { duration: 0.35 });

      // the timeline waits for the first quiet moment on the main thread: the page's scripts and the
      // studio's canvas set up in the first few hundred ms, and starting the bars and strings on top of
      // that made their opening stutter. Until then the screen is simply black.
      const tl = gsap.timeline({
        paused: true,
        defaults: { ease: "power3.out" },
        onComplete: () => {
          gsap.ticker.remove(tick);
          setMounted(false);
        },
      });

      // The gate. Works from the moment the button is visible: jumping just past the pause point
      // resumes the timeline whether it has reached the pause yet or not, and a second press is a no-op.
      let entered = false;
      const go = (withSound: boolean) => {
        if (entered) return;
        entered = true;
        window.removeEventListener("keydown", onKey);
        unlockAudio();
        setMuted(!withSound);
        tl.play("gate+=0.01");
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") go(true);
      };
      window.addEventListener("keydown", onKey);
      enterGo.current = go;

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
        .set(strings, { clearProps: "transform,transformOrigin" }, "morph")
        // while the shapes are in flux they soften and dip, so the in-between blobs never read as a frame
        .to(stage, { filter: "blur(1.6px)", opacity: 0.72, duration: 0.35, ease: "power2.out" }, "morph")
        .to(stage, { filter: "blur(0px)", opacity: 1, duration: 0.8, ease: "power2.inOut" }, "morph+=0.9")
        // 100 lands with the letters, not before them
        .to(state, { progress: 100, duration: 0.3, ease: "power3.out", onUpdate: setCounter }, "morph+=1.5");
      // Two beats per string: gather over its letter's width, then bloom into the letter.
      strings.forEach((el, i) => {
        const { x0, x1 } = LETTER_SPANS[i];
        const gathered = ribbonPath(i, 0, 0, x0, x1);
        tl.to(
          el,
          { morphSVG: { shape: gathered, shapeIndex: "auto" }, duration: 0.4, ease: "expo.inOut" },
          `morph+=${i * 0.05}`,
        ).to(
          el,
          {
            morphSVG: { shape: WORDMARK.letters[i].d, shapeIndex: "auto" },
            duration: 1.1,
            ease: "power3.inOut",
          },
          `morph+=${0.35 + i * 0.07}`,
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

        // The lockup settles into the sign's colour (cream on the dark wall); the counter and bars leave.
        .add("flip", "morph+=2.35")
        .to(stage, { color: PEARL, duration: 0.6, ease: "power2.inOut" }, "flip")
        .to(counter, { autoAlpha: 0, y: -12, duration: 0.45 }, "flip+=0.3")
        .to(bars, { autoAlpha: 0, duration: 0.6 }, "flip+=0.3")

        // The lockup rests: now the page does its heavy 3D work (every canvas compiles its shaders and
        // uploads its textures, see lib/r3f/Prewarm) while nothing on screen moves. The Enter button only
        // comes once that's done (or after 3s), so there is nothing heavy left to do once it's clicked.
        .add("warm", "flip+=0.9")
        .add(() => openGate(), "warm")
        .addPause("warm+=0.01", () => {
          void whenReady(3000).then(() => {
            if (!entered) tl.resume();
          });
        })

        // Gate: the visitor's click is the gesture browsers require before any sound can play.
        .fromTo(enter, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: "expo.out" }, "warm+=0.05")
        .addLabel("gate", "warm+=0.65")
        .addPause("gate")

        // Handoff: the enter gate leaves, the sketched studio shows through, the logo flies onto the wall in red ink.
        .to(enter, { autoAlpha: 0, y: -8, duration: 0.3, ease: "power2.in" }, "gate")
        .add("exit", "gate+=0.05")
        .to(presents, { autoAlpha: 0, duration: 0.3 }, "exit")
        .to(grain, { autoAlpha: 0, duration: 0.5 }, "exit")
        .to(overlay, { backgroundColor: "rgba(7,6,6,0)", duration: 0.9, ease: "power2.inOut" }, "exit+=0.1")
        .add(() => {
          if (!home) {
            gsap.to(stage, { y: -28, scale: 0.96, duration: 0.9, ease: "power2.inOut" });
            return;
          }
          // Fly the lockup onto the wall sign. The target is read live from the scene every frame,
          // so the pointer's pan during the flight can't knock it off its mark.
          const r = stage.getBoundingClientRect();
          const unit = r.width / W;
          const ox = r.left + (W * unit) / 2;
          const oy = r.top + (WORDMARK.height * unit) / 2;
          const fallback = plateToScreen(SIGN_WORDMARK.x, SIGN_WORDMARK.y, window.innerWidth, window.innerHeight);
          const target = () => {
            const box = session.signScreen;
            if (box.w > 0) return { cx: box.x + box.w / 2, cy: box.y + box.h / 2, scale: box.w / (W * unit) };
            return {
              cx: fallback.x + (SIGN_WORDMARK.w * fallback.s) / 2,
              cy: fallback.y + (SIGN_WORDMARK.h * fallback.s) / 2,
              scale: (SIGN_WORDMARK.w * fallback.s) / (W * unit),
            };
          };
          gsap.set(stage, { transformOrigin: `${(W * unit) / 2}px ${(WORDMARK.height * unit) / 2}px` });
          const flight = { t: 0 };
          // setters bound to the element now: the last frames of the flight run after the preloader's
          // scope has gone, and a gsap.set there would re-resolve its target through it ("Invalid scope")
          const setX = gsap.quickSetter(stage, "x", "px");
          const setY = gsap.quickSetter(stage, "y", "px");
          const setScale = gsap.quickSetter(stage, "scale");
          gsap.to(flight, {
            t: 1,
            duration: 1.25,
            ease: "expo.inOut",
            onUpdate: () => {
              const tgt = target();
              setX((tgt.cx - ox) * flight.t);
              setY((tgt.cy - oy) * flight.t);
              setScale(1 + (tgt.scale - 1) * flight.t);
            },
          });
        }, "exit")
        // Landing: the scene's sign fades in underneath while the flown logo fades out — a straight swap.
        .add(() => {
          finish();
          lenisRef.current?.start();
        }, "exit+=1.25")
        .to(stage, { autoAlpha: 0, duration: 0.4, ease: "power1.inOut" }, "exit+=1.3");

      // on the home page, wait until the studio behind has drawn its first frames (its plates upload and
      // its shaders compile in one heavy burst), then for the next quiet moment; never longer than 1.6s
      let startHandle = 0;
      let started = false;
      const t0 = performance.now();
      const start = () => {
        if (started) return;
        started = true;
        gsap.ticker.remove(waitStudio);
        if (!entered) tl.play();
      };
      const settle = () => {
        startHandle = window.requestIdleCallback ? window.requestIdleCallback(start, { timeout: 250 }) : window.setTimeout(start, 80);
      };
      const waitStudio = () => {
        if (session.studioReady || !home || performance.now() - t0 > 1600) {
          gsap.ticker.remove(waitStudio);
          settle();
        }
      };
      gsap.ticker.add(waitStudio);

      // React StrictMode mounts twice — without this the first ticker keeps overwriting `d` and blocks the morph.
      return () => {
        gsap.ticker.remove(waitStudio);
        if (window.cancelIdleCallback) window.cancelIdleCallback(startHandle);
        else window.clearTimeout(startHandle);
        state.wave = false;
        window.removeEventListener("keydown", onKey);
        gsap.ticker.remove(tick);
      };
    },
    { scope: root },
  );

  if (!mounted) return null;

  return (
    <div
      ref={root}
      className="fixed inset-0 z-[150] overflow-clip bg-black text-tan select-none"
      style={{ backgroundColor: BLACK }}
    >
      {/* film grain */}
      <div className="grain grain-live pointer-events-none absolute inset-[-50%] opacity-[0.07] mix-blend-overlay" />

      {/* letterbox bars */}
      <div className="bar absolute inset-x-0 top-0 h-[11vh] origin-top bg-black" />
      <div className="bar absolute inset-x-0 bottom-0 h-[11vh] origin-bottom bg-black" />

      {/* logo stage */}
      <div className="content absolute inset-0 flex items-center justify-center">
        <svg
          aria-hidden
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

      {/* enter gate */}
      <div className="enter absolute inset-x-0 bottom-[14vh] z-10 flex flex-col items-center gap-4 opacity-0">
        <button
          onClick={() => enterGo.current(true)}
          className="group relative flex h-16 w-16 items-center justify-center rounded-full border border-pearl/60 text-pearl transition-colors hover:border-tan hover:text-tan"
          aria-label="Enter with sound"
        >
          <span className="tap-ring absolute inset-0 rounded-full" />
          <span className="text-[0.62rem] font-semibold tracking-[0.3em] uppercase">Enter</span>
        </button>
        <div className="flex items-center gap-3 text-[0.6rem] tracking-[0.35em] text-pearl/50 uppercase">
          <span>Sound on · headphones recommended</span>
          <span className="opacity-40">/</span>
          <button onClick={() => enterGo.current(false)} className="underline-offset-4 transition-colors hover:text-pearl hover:underline">
            Enter muted
          </button>
        </div>
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
