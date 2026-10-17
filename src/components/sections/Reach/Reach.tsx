"use client";

// The Reach — after the Frequency Box. A pinned, scrubbed scene:
//   · we start in light: a bright, slowly moving fog, a glow somewhere below
//   · the AUVOX hand — a lacquered brand-red sculpture of Michelangelo's reaching hand — comes down
//     out of the light toward the glow, guitar picks gathering round it: "Every musician / was once /
//     a beginner."
//   · the fog clears into a golden sky — the sun, its rays, clouds at every depth, red petals in the
//     air — as the hand turns to reach across, and a real hand, the student's, rises to meet it:
//     "No one learns / music / alone."
//   · a ring appears in the gap: tap & hold (or keep scrolling) and the fingertips close; a chord
//     swells; at the touch the guitar and the keys strike together, the picks burst, and a crimson
//     wave runs out from the fingertips until the whole sky is AUVOX red: "You reach. We reach back."
// Then the red carries on into the promise (the client's "why AUVOX" points) and the way in.

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import clsx from "clsx";
import { gsap, ScrollTrigger, SplitText, useGSAP } from "@/lib/gsap";
import { ABOUT } from "@/content/packages";
import Button from "@/components/ui/Button";
import { unlockAudio } from "@/components/sections/Session/audio";
import { setSwell, touchSound } from "./sound";
import { HOLD_SECONDS, reach, resetReach, setHolding, setPointer, together } from "./state";

const ReachWorld = dynamic(() => import("./ReachWorld"), { ssr: false });

/** direction from the AUVOX fingertip to the student's, on screen (y down) */
const DIR = (() => {
  const l = Math.hypot(0.82, 0.42);
  return { x: 0.82 / l, y: 0.42 / l };
})();
const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const PROMISE = ABOUT.what.body[1];

/** a line of display type whose words rise out of a mask */
function Phrase({ children, className, accent }: { children: string; className?: string; accent?: boolean }) {
  const words = children.split(" ");
  return (
    <span className={clsx("rch-phrase pointer-events-none absolute block font-display leading-[0.92] tracking-[-0.025em]", accent ? "text-red italic" : "text-ink", className)}>
      {words.map((w, i) => (
        <span key={i} className="rch-mask -mb-[0.24em] inline-block overflow-hidden pb-[0.24em] align-bottom">
          <span className="rch-word inline-block will-change-transform">{w}</span>
          {i < words.length - 1 && <span>&nbsp;</span>}
        </span>
      ))}
    </span>
  );
}

export default function Reach() {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  const down = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    unlockAudio();
    setHolding(true);
  };
  const up = () => setHolding(false);
  const key = (e: React.KeyboardEvent, on: boolean) => {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    if (on && e.repeat) return;
    if (on) unlockAudio();
    setHolding(on);
  };

  useGSAP(
    () => {
      const el = root.current;
      const st = stage.current;
      if (!el || !st) return;
      const q = gsap.utils.selector(el);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      resetReach(reduce);

      // --- near the viewport: mount the canvas early (idle), run the loops only while we are around
      const io = new IntersectionObserver(
        ([entry]) => {
          reach.inView = entry.isIntersecting;
          if (entry.isIntersecting) setReady(true);
        },
        { rootMargin: "300px 0px" },
      );
      io.observe(st);
      const idle = window.requestIdleCallback ? window.requestIdleCallback(() => setReady(true), { timeout: 6000 }) : window.setTimeout(() => setReady(true), 4000);

      const ring = q<HTMLElement>(".rch-ring")[0];
      const arc = q<SVGCircleElement>(".rch-arc")[0];
      const head = q<HTMLElement>(".rch-head")[0];
      const phraseA = q(".rch-a .rch-word");
      const phraseB = q(".rch-b .rch-word");
      const kickers = q(".rch-kicker");
      const ARC = 2 * Math.PI * 46;

      // --- the promise headline (it reveals at the touch)
      const split = new SplitText(q(".rch-head-title"), { type: "lines,words", linesClass: "rch-head-line" });
      gsap.set(split.lines, { overflow: "hidden", paddingBottom: "0.12em", marginBottom: "-0.12em" });
      gsap.set(split.words, { yPercent: 110 });
      gsap.set([head, ring], { autoAlpha: 0 });
      gsap.set([phraseA, phraseB], { yPercent: 112 });
      gsap.set(kickers, { autoAlpha: 0 });

      // --- the touch, and (if they scroll back up) undoing it
      let headTl: gsap.core.Timeline | null = null;
      const connect = () => {
        if (reach.connected) return;
        reach.connected = true;
        reach.holding = false;
        el.dataset.connected = "1";
        touchSound();
        setSwell(0);
        gsap.killTweensOf(reach, "touch,flood,burst,red");
        gsap.timeline().to(reach, { touch: 1, duration: 0.16, ease: "power2.out" }).to(reach, { touch: 0.3, duration: 1.8, ease: "power2.out" });
        gsap.fromTo(reach, { flood: 0 }, { flood: 2.8, duration: reduce ? 0.6 : 2.6, ease: "power2.inOut" });
        gsap.fromTo(reach, { red: 0 }, { red: 1, duration: 0.4, ease: "power1.out" });
        gsap.fromTo(reach, { burst: 0.001 }, { burst: 1, duration: 2.6, ease: "power2.out" });
        gsap.to(ring, { autoAlpha: 0, scale: 1.7, duration: 0.6, ease: "expo.out" });
        gsap.to(q(".rch-a, .rch-b"), { autoAlpha: 0, y: -24, duration: 0.5, ease: "power2.in" });
        headTl?.kill();
        headTl = gsap
          .timeline({ delay: reduce ? 0.2 : 1.1 })
          .set(head, { autoAlpha: 1 })
          .to(split.words, { yPercent: 0, duration: 1.4, stagger: 0.06, ease: "expo.out" })
          .fromTo(q(".rch-head-sub"), { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, ease: "expo.out" }, "-=0.9");
      };
      const disconnect = () => {
        if (!reach.connected) return;
        reach.connected = false;
        reach.hold = 0;
        el.dataset.connected = "";
        gsap.killTweensOf(reach, "touch,flood,burst,red");
        gsap.to(reach, { flood: 0, touch: 0, red: 0, duration: 0.7, ease: "power2.inOut" });
        reach.burst = 0;
        headTl?.kill();
        gsap.to(head, { autoAlpha: 0, duration: 0.4 });
        gsap.set(split.words, { yPercent: 110 });
        gsap.to(q(".rch-a, .rch-b"), { autoAlpha: 1, y: 0, duration: 0.5 });
      };

      // --- the scene, scrubbed by the scroll while the stage is pinned
      const tl = gsap.timeline({ defaults: { ease: "none" }, paused: reduce });
      tl
        // out of the light: the hand comes down, the picks gather
        .fromTo(reach, { descend: 0 }, { descend: 1, duration: 0.3, ease: "power2.out" }, 0.02)
        .fromTo(reach, { tokens: 0 }, { tokens: 1, duration: 0.26, ease: "power2.out" }, 0.1)
        .to(phraseA, { yPercent: 0, duration: 0.1, stagger: 0.035, ease: "power3.out" }, 0.15)
        .to(kickers[0], { autoAlpha: 1, duration: 0.05 }, 0.17)
        .to(phraseA, { yPercent: -112, duration: 0.07, stagger: 0.014, ease: "power2.in" }, 0.37)
        .to(kickers[0], { autoAlpha: 0, duration: 0.04 }, 0.37)
        // the fog clears; the hand turns to reach across; the sky, the rays, the petals
        .fromTo(reach, { light: 1 }, { light: 0, duration: 0.2, ease: "power1.inOut" }, 0.32)
        .fromTo(reach, { fog: 1 }, { fog: 0, duration: 0.3, ease: "power1.inOut" }, 0.3)
        .fromTo(reach, { turn: 0 }, { turn: 1, duration: 0.28, ease: "power2.inOut" }, 0.33)
        .fromTo(reach, { open: 0 }, { open: 1, duration: 0.3, ease: "power1.inOut" }, 0.35)
        // the student rises to meet it
        .fromTo(reach, { studentIn: 0 }, { studentIn: 1, duration: 0.26, ease: "power2.out" }, 0.5)
        .to(phraseB, { yPercent: 0, duration: 0.1, stagger: 0.035, ease: "power3.out" }, 0.58)
        .to(kickers[1], { autoAlpha: 1, duration: 0.05 }, 0.6)
        .to(phraseB, { yPercent: -112, duration: 0.07, stagger: 0.014, ease: "power2.in" }, 0.83)
        .to(kickers[1], { autoAlpha: 0, duration: 0.04 }, 0.83)
        // the ring; scrolling on closes the gap too
        .fromTo(ring, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.05, ease: "power2.out" }, 0.78)
        .fromTo(reach, { assist: 0 }, { assist: 1, duration: 0.12, ease: "power1.in" }, 0.86)
        .to({}, { duration: 0.02 }, 0.98);

      let trigger: ScrollTrigger | null = null;
      if (reduce) {
        reach.assist = 0;
        reach.armed = true;
        gsap.set(ring, { autoAlpha: 1 });
        gsap.set(phraseB, { yPercent: 0 });
        gsap.set(kickers[1], { autoAlpha: 1 });
      } else {
        trigger = ScrollTrigger.create({
          trigger: st,
          start: "top top",
          end: () => `+=${window.innerHeight * (window.innerWidth < 768 ? 3.8 : 5)}`,
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          animation: tl,
          onUpdate: (self) => {
            reach.armed = self.progress > 0.77;
            if (reach.connected && self.progress < 0.72) disconnect();
          },
        });
      }

      // --- the pointer leans the scene a little
      const onMove = (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      // --- the ticker: layout (where the fingertips go), the hold, the ring
      let W = st.clientWidth;
      let H = st.clientHeight;
      const ro = new ResizeObserver(() => {
        W = st.clientWidth;
        H = st.clientHeight;
      });
      ro.observe(st);
      let swelling = false;
      const tick = (_t: number, dtMs: number) => {
        if (!reach.inView) {
          if (swelling) setSwell(0);
          swelling = false;
          return;
        }
        const dt = Math.min(dtMs, 50) / 1000;
        if (!reach.connected) {
          if (reach.holding && reach.armed) reach.hold = Math.min(1, reach.hold + dt / HOLD_SECONDS);
          else reach.hold = Math.max(0, reach.hold - dt * 0.9);
          const tg = together();
          const on = reach.armed && tg > 0.01;
          if (on || swelling) setSwell(on ? tg : 0);
          swelling = on;
          if (reach.armed && tg >= 0.999) connect();
        }

        // layout: the gap sits a little above centre; the fingertips close along DIR
        const wide = W / H > 1;
        const handLen = wide ? Math.min(0.37, (0.26 * W) / H) : Math.min(0.34, (0.5 * W) / H);
        reach.handLen = handLen;
        reach.aspect = W / H;
        const gx = 0.5 * W;
        const gy = (wide ? 0.47 : 0.44) * H;
        const tg = together();
        const open = handLen * H * 0.6;
        const d = reach.connected ? handLen * H * 0.015 : open - (open - handLen * H * 0.06) * ease(tg);
        const px = reach.still ? 0 : reach.pointer.x * W * 0.006;
        const py = reach.still ? 0 : reach.pointer.y * H * 0.006;

        // the AUVOX fingertip: in the fog it comes down the middle toward the light; then it reaches across
        const tipAx = (wide ? 0.56 : 0.52) * W + px;
        const tipAy = lerp(-0.42 * H, (wide ? 0.5 : 0.46) * H, ease(clamp01(reach.descend))) + py;
        const tipBx = gx - (DIR.x * d) / 2;
        const tipBy = gy - (DIR.y * d) / 2;
        const turn = ease(clamp01(reach.turn));
        reach.tip.x = lerp(tipAx, tipBx, turn) / W;
        reach.tip.y = lerp(tipAy, tipBy, turn) / H;
        reach.gap.x = gx / W;
        reach.gap.y = gy / H;

        // the student's fingertip: the other side of the gap, rising in from below-right
        const sIn = ease(clamp01(reach.studentIn));
        reach.studentTip.x = (gx + (DIR.x * d) / 2 + (1 - sIn) * H * 0.32 - px) / W;
        reach.studentTip.y = (gy + (DIR.y * d) / 2 + (1 - sIn) * H * 0.6 - py) / H;

        // the ring between the fingertips
        ring.style.left = `${gx}px`;
        ring.style.top = `${gy}px`;
        arc.style.strokeDashoffset = String(ARC * (1 - tg));
        ring.dataset.holding = reach.holding ? "1" : "";
      };
      gsap.ticker.add(tick);

      return () => {
        io.disconnect();
        if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
        else window.clearTimeout(idle);
        ro.disconnect();
        gsap.ticker.remove(tick);
        window.removeEventListener("pointermove", onMove);
        trigger?.kill();
        tl.kill();
        headTl?.kill();
        split.revert();
        setSwell(0);
        reach.inView = false;
      };
    },
    { scope: root },
  );

  return (
    <section ref={root} id="reach" aria-label="The AUVOX promise" className="rch relative bg-red">
      {/* ---------- the scene (pinned) ---------- */}
      <div ref={stage} className="rch-stage relative h-[100svh] w-full overflow-hidden bg-cream select-none" onContextMenu={(e) => e.preventDefault()}>
        {ready && <ReachWorld />}

        {/* the words */}
        <div className="rch-a pointer-events-none absolute inset-0 z-[7]" aria-hidden>
          <span className="rch-kicker absolute top-[13%] left-[6%] text-[0.6rem] font-semibold tracking-[0.4em] text-ink/60 uppercase md:top-[15%]">The AUVOX promise</span>
          <Phrase className="top-[16%] left-[6%] text-[clamp(2.8rem,7.2vw,8.2rem)] md:top-[19%]">Every musician</Phrase>
          <Phrase className="right-[6%] bottom-[25%] text-right text-[clamp(1.5rem,2.8vw,3rem)] italic">was once</Phrase>
          <Phrase accent className="right-[6%] bottom-[11%] text-right text-[clamp(2.8rem,7.2vw,8.2rem)]">
            a beginner.
          </Phrase>
        </div>
        <div className="rch-b pointer-events-none absolute inset-0 z-[7]" aria-hidden>
          <span className="rch-kicker absolute top-[13%] left-[6%] text-[0.6rem] font-semibold tracking-[0.4em] text-ink/60 uppercase md:top-[15%]">The AUVOX promise</span>
          <Phrase className="top-[16%] left-[6%] text-[clamp(2.8rem,7.2vw,8.2rem)] md:top-[19%]">No one learns</Phrase>
          <Phrase className="right-[6%] bottom-[25%] text-right text-[clamp(1.5rem,2.8vw,3rem)] italic">music</Phrase>
          <Phrase accent className="right-[6%] bottom-[11%] text-right text-[clamp(2.8rem,7.2vw,8.2rem)]">
            alone.
          </Phrase>
        </div>
        <p className="sr-only">Every musician was once a beginner. No one learns music alone.</p>

        {/* tap & hold */}
        <button
          type="button"
          aria-label="Press and hold to reach the AUVOX hand"
          onPointerDown={down}
          onPointerUp={up}
          onPointerLeave={up}
          onPointerCancel={up}
          onKeyDown={(e) => key(e, true)}
          onKeyUp={(e) => key(e, false)}
          onBlur={up}
          className="rch-ring absolute z-[8] -mt-[56px] -ml-[56px] flex h-[112px] w-[112px] items-center justify-center rounded-full"
          style={{ left: "50%", top: "50%", touchAction: "none", WebkitTouchCallout: "none" }}
        >
          <svg viewBox="0 0 100 100" className="rch-ring-svg absolute inset-0 h-full w-full -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.1" />
            <circle className="rch-arc" cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeDasharray={2 * Math.PI * 46} strokeDashoffset={2 * Math.PI * 46} />
          </svg>
          <span className="rch-ring-pulse absolute inset-[18%] rounded-full border border-current" aria-hidden />
          <span className="rch-ring-dot block h-2 w-2 rounded-full bg-current" aria-hidden />
          <span className="rch-ring-label pointer-events-none absolute top-1/2 left-[calc(100%+0.7rem)] -translate-y-1/2 text-left text-[0.6rem] leading-[1.5] font-semibold tracking-[0.36em] whitespace-nowrap uppercase">
            <span className="pointer-coarse:hidden">Click</span>
            <span className="hidden pointer-coarse:inline">Tap</span>
            <br />
            <span>Hold</span>
          </span>
        </button>

        {/* at the touch */}
        <div className="rch-head pointer-events-none absolute inset-x-0 bottom-[9%] z-[8] px-6 text-center text-peach md:bottom-[8%]">
          <h2 className="rch-head-title font-display text-[clamp(2.6rem,7vw,7.6rem)] leading-[0.98] tracking-[-0.02em]">
            You reach. We reach <em className="not-italic text-tan">back.</em>
          </h2>
          <p className="rch-head-sub mt-5 text-[0.62rem] font-semibold tracking-[0.38em] text-peach/70 uppercase">The AUVOX promise</p>
        </div>

        <div className="grain pointer-events-none absolute inset-0 z-[9] opacity-[0.045] mix-blend-multiply" />
      </div>

      {/* ---------- the promise, in the red ---------- */}
      <div data-theme="dark" className="relative overflow-hidden bg-red text-peach">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_0%,rgba(179,23,15,0.6),transparent_70%),radial-gradient(60%_50%_at_90%_100%,rgba(30,30,30,0.45),transparent_70%)]" />
        <div className="grain pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-screen" />
        <div className="relative mx-auto max-w-[1440px] px-6 py-24 md:px-12 md:py-32">
          <div className="grid gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
            <div className="rch-in">
              <div className="flex items-center gap-4">
                <span className="block h-px w-10 bg-peach/50" />
                <span className="text-[0.65rem] font-medium tracking-[0.38em] text-peach/70 uppercase">{ABOUT.why.kicker}</span>
              </div>
              <p className="font-display mt-6 text-[clamp(2rem,3.6vw,3.6rem)] leading-[1.02] tracking-[-0.015em]">
                Designed around the complete learner not only the <em className="not-italic text-tan">lesson.</em>
              </p>
              <p className="mt-7 max-w-[30rem] text-[1.05rem] leading-relaxed text-peach/75">{PROMISE}</p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Button href="/reserve" variant="peach">
                  Reserve your free demo
                </Button>
                <Button href="/packages" variant="outline" className="border-peach/40! text-peach! hover:border-peach! hover:bg-peach! hover:text-red!">
                  Explore packages
                </Button>
              </div>
            </div>
            <ol className="rch-in grid self-end border-t border-peach/20 sm:grid-cols-2">
              {ABOUT.why.points.map((p, i) => (
                <li key={p} className={clsx("flex items-start gap-5 border-b border-peach/20 py-7 sm:py-9", i % 2 === 0 && "sm:border-r sm:pr-8", i % 2 === 1 && "sm:pl-8")}>
                  <span className="font-display text-[2.4rem] leading-none text-tan/90 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <span className="pt-2 text-[1.1rem] leading-snug text-peach/90">{p}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
