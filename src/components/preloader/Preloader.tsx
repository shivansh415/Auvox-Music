"use client";

import { useEffect, useRef, useState } from "react";
import { useLenis } from "lenis/react";
import { gsap, useGSAP } from "@/lib/gsap";
import { usePreloaderStore, whenReady } from "@/store/preloader";
import { session } from "@/components/sections/Session/state";
import { setMuted, unlockAudio } from "@/components/sections/Session/audio";
import { MUSIC, WORDMARK } from "./logo-paths";

/** Flip to true before launch so returning visitors only see the preloader once per tab. */
const ONCE_PER_SESSION = false;
const SESSION_KEY = "auvox:preloader-seen";

const TAN = "#e7b47e";
const PEARL = "#f1ede9";
const BLACK = "#000000";

// Stage geometry (SVG user units). Wordmark sits at the top, MUSIC below.
const W = WORDMARK.width; // 1309
const STAGE_H = 470;
const MUSIC_SCALE = (W * 0.4) / MUSIC.width;
const MUSIC_X = (W - MUSIC.width * MUSIC_SCALE) / 2;
const MUSIC_Y = WORDMARK.height + 44;

// The sound wave: a row of rounded bars, symmetric about the middle like the brand's waveform, centred
// on the wordmark. While the counter runs it plays like a level meter; then it settles and the lockup
// rises in its place.
const WAVE_CY = WORDMARK.height / 2;
const WAVE_BARS = 41;
const WAVE_X0 = W * 0.29;
const WAVE_X1 = W * 0.71;
const WAVE_BAR_W = 9;
const WAVE_MAX_H = 230;
const WAVE_STEP = (WAVE_X1 - WAVE_X0) / (WAVE_BARS - 1);

/** height of bar `k` at time `t` (amp 0–1): an envelope that peaks in the middle, rippling like audio */
function barHeight(k: number, t: number, amp: number) {
  const u = k / (WAVE_BARS - 1);
  const env = Math.pow(Math.sin(Math.PI * u), 1.6);
  const ripple =
    0.55 +
    0.25 * Math.sin(t * 7.1 + k * 0.9) +
    0.15 * Math.sin(t * 11.3 - k * 1.7) +
    0.05 * Math.sin(t * 17.9 + k * 2.9);
  return Math.max(WAVE_BAR_W, WAVE_MAX_H * amp * env * ripple);
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
      // A reload further down a page: the browser has put the scroll back (it does so within the first
      // ~150ms). The intro belongs to the top of the site, so here the curtain just lifts off the page
      // — no lockup, no gate. Checked now and again right before the intro would start.
      const midPage = () => window.scrollY > window.innerHeight * 0.5;
      const leaveQuietly = () => {
        gsap.to(overlay, { autoAlpha: 0, duration: 0.45, ease: "power1.out", onComplete: done });
      };
      if (midPage()) {
        leaveQuietly();
        return;
      }
      if (ONCE_PER_SESSION) sessionStorage.setItem(SESSION_KEY, "1");
      lenisRef.current?.stop();

      // while the wave plays, only the network works: fetch the 3D models into the HTTP cache so
      // parsing them can start the moment the gate opens (fetching doesn't block the main thread)
      if (home) {
        for (const url of ["/models/guitar-red.glb", "/models/casio.glb", "/models/guitar-red-sm.glb", "/models/casio-sm.glb", "/world/studio_1k.hdr"]) {
          void fetch(url, { priority: "low" } as RequestInit).catch(() => {});
        }
      }

      const q = gsap.utils.selector(overlay);
      const stage = q<SVGSVGElement>(".stage")[0];
      const letters = q<SVGPathElement>(".letter");
      const waveBars = q<SVGRectElement>(".wave-bar");
      const musicLetters = q<SVGPathElement>(".music-letter");
      const bars = q<HTMLDivElement>(".bar");
      const counter = q<HTMLDivElement>(".counter")[0];
      const grain = q<HTMLDivElement>(".grain")[0];
      const enter = q<HTMLDivElement>(".enter")[0];

      const state = { progress: 0, t: 0, wave: true, settle: 0 };
      const setCounter = () => {
        const p = Math.round(state.progress);
        if (counterRef.current) counterRef.current.textContent = String(p).padStart(3, "0");
        setProgress(p);
      };

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reduceMotion) {
        // Static lockup, quick count, fade out.
        gsap.set(waveBars, { autoAlpha: 0 });
        gsap.set([letters, musicLetters], { autoAlpha: 1 });
        gsap
          .timeline({ onComplete: done })
          .to(state, { progress: 100, duration: 0.8, ease: "power2.out", onUpdate: setCounter })
          .to(overlay, { autoAlpha: 0, duration: 0.6 }, "+=0.3");
        return;
      }

      // The wave plays while the counter runs: it swells with progress, and settles to a hairline when
      // the lockup takes over (state.settle 0 → 1).
      const tick = (_time: number, delta: number) => {
        if (!state.wave) return;
        state.t += delta / 1000;
        const p = state.progress / 100;
        const amp = Math.max(0.12, Math.pow(Math.sin(Math.PI * Math.min(p, 0.62) / 1.24), 0.8)) * (1 - state.settle);
        waveBars.forEach((el, k) => {
          const h = barHeight(k, state.t, amp);
          el.setAttribute("y", (WAVE_CY - h / 2).toFixed(1));
          el.setAttribute("height", h.toFixed(1));
        });
      };
      gsap.ticker.add(tick);

      // Counter: builds, hangs on 99 for a beat, then lands on 100.
      const count = gsap
        .timeline({ defaults: { onUpdate: setCounter } })
        .to(state, { progress: 99, duration: 2.3, ease: "power2.inOut" })
        .to({}, { duration: 0.35 });

      // the timeline waits for the first quiet moment on the main thread: the page's scripts and the
      // studio's canvas set up in the first few hundred ms, and starting the bars and the wave on top of
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
        .fromTo(waveBars, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, stagger: { each: 0.012, from: "center" }, ease: "power2.out" }, 0.25)
        .fromTo(counter, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9 }, 0.4)
        .add(count, 0.7)

        // The wave settles to a hairline and goes; the lockup rises in its place.
        .add("morph", ">-0.05")
        .to(state, { settle: 1, duration: 0.7, ease: "power2.inOut" }, "morph")
        .to(waveBars, { autoAlpha: 0, duration: 0.35, stagger: { each: 0.006, from: "edges" } }, "morph+=0.45")
        .add(() => {
          state.wave = false;
        }, "morph+=0.9")
        .fromTo(letters, { autoAlpha: 0, y: 26, filter: "blur(8px)" }, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 1.0, stagger: 0.06, ease: "expo.out" }, "morph+=0.55")
        .fromTo(musicLetters, { y: 34, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.05, ease: "expo.out" }, "morph+=0.95")
        // 100 lands with the letters, not before them
        .to(state, { progress: 100, duration: 0.3, ease: "power3.out", onUpdate: setCounter }, "morph+=1.0")

        // The lockup settles into the sign's colour (cream on the dark wall); the counter and bars leave.
        .add("flip", "morph+=1.9")
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
        .to(grain, { autoAlpha: 0, duration: 0.5 }, "exit")
        .to(overlay, { backgroundColor: "rgba(7,6,6,0)", duration: 0.9, ease: "power2.inOut" }, "exit+=0.1")
        .add(() => {
          // the splash (home, at the top): the camera passes through the lockup — it grows and fades
          // as the studio behind zooms out from the phone to its rest (Session.tsx, in step with this:
          // both start here). Anywhere else (another page, or a reload further down) it just lets go.
          const onSplash = home && window.scrollY < window.innerHeight * 0.5;
          if (onSplash) {
            gsap.set(stage, { transformOrigin: "50% 40%" });
            gsap.to(stage, { scale: 2.4, autoAlpha: 0, filter: "blur(6px)", duration: 1.1, ease: "power2.in" });
          } else {
            gsap.to(stage, { autoAlpha: 0, y: -18, scale: 0.97, duration: 0.5, ease: "power2.in" });
          }
          finish();
        }, "exit")
        .add(() => {
          lenisRef.current?.start();
        }, "exit+=1.0")
        .to({}, { duration: 0.1 }, "exit+=1.15");

      // on the home page, wait until the studio behind has drawn its first frames (its plates upload and
      // its shaders compile in one heavy burst), then for the next quiet moment; never longer than 1.6s
      let startHandle = 0;
      let started = false;
      const t0 = performance.now();
      const start = () => {
        if (started) return;
        started = true;
        gsap.ticker.remove(waitStudio);
        if (midPage()) {
          tl.kill();
          leaveQuietly();
          return;
        }
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
          className="stage w-[min(62vw,420px)] overflow-visible md:w-[min(40vw,560px)]"
          viewBox={`0 0 ${W} ${STAGE_H}`}
          fill="currentColor"
          style={{ color: TAN }}
        >
          <g className="wave">
            {Array.from({ length: WAVE_BARS }, (_, k) => (
              <rect key={k} className="wave-bar opacity-0" x={WAVE_X0 + k * WAVE_STEP - WAVE_BAR_W / 2} y={WAVE_CY - WAVE_BAR_W / 2} width={WAVE_BAR_W} height={WAVE_BAR_W} rx={WAVE_BAR_W / 2} />
            ))}
          </g>
          <g>
            {WORDMARK.letters.map((letter) => (
              <path key={letter.char} className="letter opacity-0" d={letter.d} />
            ))}
          </g>
          <g transform={`translate(${MUSIC_X} ${MUSIC_Y}) scale(${MUSIC_SCALE})`}>
            {MUSIC.letters.map((letter) => (
              <path key={letter.char} className="music-letter opacity-0" d={letter.d} />
            ))}
          </g>
        </svg>
      </div>

      {/* enter gate */}
      <div className="enter absolute inset-x-0 bottom-[9vh] z-10 flex flex-col items-center gap-10 opacity-0 md:bottom-[10vh] md:gap-12">
        <button
          onClick={() => enterGo.current(true)}
          className="group relative flex h-16 w-16 items-center justify-center rounded-full border border-pearl/60 text-pearl transition-colors hover:border-tan hover:text-tan"
          aria-label="Enter with sound"
        >
          <span className="text-[0.62rem] font-semibold tracking-[0.3em] uppercase">Enter</span>
        </button>
        {/* phones: the two lines stack, centred; wide screens: one line */}
        <div className="flex flex-col items-center gap-2.5 text-center text-[0.6rem] tracking-[0.35em] text-pearl/50 uppercase md:flex-row md:gap-3">
          <span>Sound on · headphones recommended</span>
          <span className="hidden opacity-40 md:inline">/</span>
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
          className="font-sans text-[clamp(1.8rem,3.6vw,3.2rem)] leading-none font-semibold tabular-nums"
        >
          000
        </span>
      </div>
    </div>
  );
}
