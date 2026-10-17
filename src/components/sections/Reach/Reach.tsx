"use client";

// The Reach — after the Frequency Box. A pinned, scrubbed scene in the clouds:
//   · we rise out of a cloud bank into a warm golden sky
//   · the AUVOX hand — a lacquered brand-red sculpture of Michelangelo's reaching hand — comes out of
//     the cloud, guitar picks drifting round it: "Every musician / was once / a beginner."
//   · the clouds part, the light comes through, and a real hand — the student's — rises to meet it:
//     "No one learns / music / alone."
//   · a ring appears in the gap: tap & hold (or keep scrolling) and the fingertips close; a chord
//     swells; at the touch the guitar and the keys strike together, the picks burst outward and a
//     red wave runs out from the fingertips until the whole sky is AUVOX red: "You reach. We reach back."
// Then the red carries on into the promise (the client's "why AUVOX" points) and the way in.

import dynamic from "next/dynamic";
import Image from "next/image";
import { useRef, useState } from "react";
import clsx from "clsx";
import { gsap, ScrollTrigger, SplitText, useGSAP } from "@/lib/gsap";
import { ABOUT } from "@/content/packages";
import Button from "@/components/ui/Button";
import { unlockAudio } from "@/components/sections/Session/audio";
import { setSwell, touchSound } from "./sound";
import { HOLD_SECONDS, reach, resetReach, setHolding, setPointer, together } from "./state";

const ReachWorld = dynamic(() => import("./ReachWorld"), { ssr: false });

/** the student's photo (public/reach/hand.webp): its size and where its fingertip is, in its pixels */
const HAND = { w: 1024, h: 1536, tipX: 154, tipY: 405, rotate: -22 };
/** direction from the AUVOX fingertip to the student's, on screen (y down) */
const DIR = (() => {
  const l = Math.hypot(0.82, 0.42);
  return { x: 0.82 / l, y: 0.42 / l };
})();
const ease = (t: number) => t * t * (3 - 2 * t);

const PROMISE = ABOUT.what.body[1];

/** a line of display type whose words rise out of a mask */
function Phrase({ children, className, accent }: { children: string; className?: string; accent?: boolean }) {
  return (
    <span className={clsx("rch-phrase pointer-events-none absolute block font-display leading-[0.95] tracking-[-0.02em]", accent ? "text-red italic" : "text-ink", className)}>
      {children.split(" ").map((w, i) => (
        <span key={i} className="rch-mask -mb-[0.22em] inline-block overflow-hidden pb-[0.22em] align-bottom">
          <span className="rch-word inline-block">{w}</span>
          {i < children.split(" ").length - 1 && <span>&nbsp;</span>}
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
        { rootMargin: "200px 0px" },
      );
      io.observe(st);
      const idle = window.requestIdleCallback ? window.requestIdleCallback(() => setReady(true), { timeout: 5000 }) : window.setTimeout(() => setReady(true), 3000);

      const sky = q(".rch-sky")[0];
      const far = q(".rch-far")[0];
      const near = q(".rch-near")[0];
      const veil = q(".rch-veil")[0];
      const student = q<HTMLElement>(".rch-student")[0];
      const ring = q<HTMLElement>(".rch-ring")[0];
      const arc = q<SVGCircleElement>(".rch-arc")[0];
      const flood = q<HTMLElement>(".rch-flood")[0];
      const crest = q<HTMLElement>(".rch-crest")[0];
      const head = q<HTMLElement>(".rch-head")[0];
      const phraseA = q(".rch-a .rch-word");
      const phraseB = q(".rch-b .rch-word");
      const ARC = 2 * Math.PI * 46;

      // --- the promise headline (it reveals at the touch)
      const split = new SplitText(q(".rch-head-title"), { type: "lines,words", linesClass: "rch-head-line" });
      gsap.set(split.lines, { overflow: "hidden", paddingBottom: "0.1em", marginBottom: "-0.1em" });
      gsap.set(split.words, { yPercent: 110 });
      gsap.set([head, ring], { autoAlpha: 0 });
      gsap.set(phraseA, { yPercent: 110 });
      gsap.set(phraseB, { yPercent: 110 });

      // --- the touch, and (if they scroll back up) undoing it
      let headTl: gsap.core.Timeline | null = null;
      const connect = () => {
        if (reach.connected) return;
        reach.connected = true;
        reach.holding = false;
        el.dataset.connected = "1";
        touchSound();
        setSwell(0);
        gsap.killTweensOf(reach, "touch,flood,burst");
        gsap.timeline().to(reach, { touch: 1, duration: 0.18, ease: "power2.out" }).to(reach, { touch: 0.35, duration: 1.6, ease: "power2.out" });
        gsap.fromTo(reach, { flood: 0 }, { flood: 2.6, duration: reduce ? 0.6 : 2.4, ease: "power2.inOut" });
        gsap.fromTo(reach, { burst: 0.001 }, { burst: 1, duration: 2.4, ease: "power2.out" });
        gsap.to(ring, { autoAlpha: 0, scale: 1.6, duration: 0.6, ease: "expo.out" });
        gsap.to(near, { autoAlpha: 0, duration: 1.2, ease: "power2.out", overwrite: "auto" });
        gsap.to(q(".rch-a, .rch-b"), { autoAlpha: 0, y: -20, duration: 0.5, ease: "power2.in" });
        headTl?.kill();
        headTl = gsap
          .timeline({ delay: reduce ? 0.2 : 0.9 })
          .set(head, { autoAlpha: 1 })
          .to(split.words, { yPercent: 0, duration: 1.3, stagger: 0.05, ease: "expo.out" })
          .fromTo(q(".rch-head-sub"), { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, ease: "expo.out" }, "-=0.8");
      };
      const disconnect = () => {
        if (!reach.connected) return;
        reach.connected = false;
        reach.hold = 0;
        el.dataset.connected = "";
        gsap.killTweensOf(reach, "touch,flood,burst");
        gsap.to(reach, { flood: 0, touch: 0, duration: 0.7, ease: "power2.inOut" });
        reach.burst = 0;
        headTl?.kill();
        gsap.to(head, { autoAlpha: 0, duration: 0.4 });
        gsap.set(split.words, { yPercent: 110 });
        gsap.to(near, { autoAlpha: 1, duration: 0.6, overwrite: "auto" });
        gsap.to(q(".rch-a, .rch-b"), { autoAlpha: 1, y: 0, duration: 0.5 });
      };

      // --- the scene, scrubbed by the scroll while the stage is pinned
      const tl = gsap.timeline({ defaults: { ease: "none" }, paused: reduce });
      tl.fromTo(sky, { scale: 1.28, yPercent: -3 }, { scale: 1.04, yPercent: 0, duration: 1 }, 0)
        // rising out of the bank
        .fromTo(veil, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.12 }, 0)
        .fromTo(near, { yPercent: -18, scale: 2.4 }, { yPercent: 46, scale: 1.25, duration: 0.24, ease: "power1.inOut" }, 0)
        // the AUVOX hand and its picks
        .fromTo(reach, { guideIn: 0 }, { guideIn: 1, duration: 0.3, ease: "power2.out" }, 0.06)
        .fromTo(reach, { tokens: 0 }, { tokens: 1, duration: 0.28, ease: "power2.out" }, 0.1)
        .to(phraseA, { yPercent: 0, duration: 0.09, stagger: 0.03, ease: "power3.out" }, 0.17)
        .to(phraseA, { yPercent: -110, duration: 0.06, stagger: 0.012, ease: "power2.in" }, 0.4)
        // the clouds part; the student rises to meet it
        .fromTo(reach, { open: 0 }, { open: 1, duration: 0.3, ease: "power1.inOut" }, 0.42)
        .fromTo(far, { scale: 1, autoAlpha: 0.95 }, { scale: 1.45, autoAlpha: 0.55, duration: 0.3, ease: "power1.inOut" }, 0.42)
        .to(near, { yPercent: 70, scale: 1.1, duration: 0.3, ease: "power1.inOut" }, 0.42)
        .fromTo(reach, { studentIn: 0 }, { studentIn: 1, duration: 0.28, ease: "power2.out" }, 0.46)
        .to(phraseB, { yPercent: 0, duration: 0.09, stagger: 0.03, ease: "power3.out" }, 0.56)
        .to(phraseB, { yPercent: -110, duration: 0.06, stagger: 0.012, ease: "power2.in" }, 0.8)
        // the ring; scrolling on closes the gap too
        .fromTo(ring, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.05, ease: "power2.out" }, 0.77)
        .fromTo(reach, { assist: 0 }, { assist: 1, duration: 0.12, ease: "power1.in" }, 0.84)
        .to({}, { duration: 0.06 }, 0.94);

      let trigger: ScrollTrigger | null = null;
      if (reduce) {
        tl.progress(0.78);
        reach.assist = 0;
        reach.armed = true;
      } else {
        trigger = ScrollTrigger.create({
          trigger: st,
          start: "top top",
          end: () => `+=${window.innerHeight * (window.innerWidth < 768 ? 3.4 : 4.2)}`,
          pin: true,
          scrub: 0.9,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          animation: tl,
          onUpdate: (self) => {
            reach.armed = self.progress > 0.76;
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

      // --- the ticker: layout (where the fingertips go), the hold, the ring, the flood, the student
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
        const handLen = wide ? 0.3 : Math.min(0.3, (0.44 * W) / H);
        reach.handLen = handLen;
        const gx = 0.5 * W;
        const gy = (wide ? 0.47 : 0.44) * H;
        const tg = together();
        const open = handLen * H * 0.62;
        const d = reach.connected ? handLen * H * 0.06 : open - (open - handLen * H * 0.07) * ease(tg);
        const px = reach.still ? 0 : reach.pointer.x * W * 0.008;
        const py = reach.still ? 0 : reach.pointer.y * H * 0.008;
        const ax = gx - (DIR.x * d) / 2;
        const ay = gy - (DIR.y * d) / 2;
        reach.tip.x = ax / W;
        reach.tip.y = ay / H;
        reach.gap.x = gx / W;
        reach.gap.y = gy / H;

        // the student's hand: its fingertip on the other side of the gap, rising in from below-right
        const hh = handLen * H * 2.55;
        const scale = hh / HAND.h;
        const sIn = ease(Math.min(1, Math.max(0, reach.studentIn)));
        const sx = gx + (DIR.x * d) / 2 + (1 - sIn) * H * 0.35 - px;
        const sy = gy + (DIR.y * d) / 2 + (1 - sIn) * H * 0.55 - py;
        student.style.height = `${hh}px`;
        student.style.width = `${hh * (HAND.w / HAND.h)}px`;
        student.style.transformOrigin = `${HAND.tipX * scale}px ${HAND.tipY * scale}px`;
        student.style.transform = `translate(${sx - HAND.tipX * scale}px, ${sy - HAND.tipY * scale}px) rotate(${HAND.rotate + (1 - sIn) * 10}deg)`;
        student.style.opacity = String(Math.min(1, sIn * 1.6));

        // the ring between the fingertips
        ring.style.left = `${gx}px`;
        ring.style.top = `${gy}px`;
        arc.style.strokeDashoffset = String(ARC * (1 - tg));
        ring.dataset.holding = reach.holding ? "1" : "";

        // the red wave from the fingertips
        const r = reach.flood * H;
        const clip = `circle(${r.toFixed(1)}px at ${gx.toFixed(1)}px ${gy.toFixed(1)}px)`;
        flood.style.clipPath = clip;
        crest.style.clipPath = `circle(${(r > 0.5 ? r + H * 0.05 * Math.min(1, reach.flood * 4) : 0).toFixed(1)}px at ${gx.toFixed(1)}px ${gy.toFixed(1)}px)`;
        flood.style.setProperty("--gx", `${gx}px`);
        flood.style.setProperty("--gy", `${gy}px`);
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
      <div ref={stage} className="rch-stage relative h-[100svh] w-full overflow-hidden bg-peach select-none" onContextMenu={(e) => e.preventDefault()}>
        <div className="rch-sky absolute inset-0 will-change-transform">
          <Image src="/reach/sky.webp" alt="" fill sizes="100vw" unoptimized priority={false} className="object-cover" draggable={false} />
        </div>
        <Image src="/reach/clouds.webp" alt="" width={1536} height={1024} unoptimized draggable={false} className="rch-far pointer-events-none absolute inset-0 h-full w-full object-cover opacity-95 will-change-transform" />
        <div className="rch-glow pointer-events-none absolute inset-0" />

        {/* the red, under the hands: it runs out from the fingertips */}
        <div className="rch-crest pointer-events-none absolute inset-0 z-[2]" style={{ clipPath: "circle(0px at 50% 50%)" }} />
        <div className="rch-flood pointer-events-none absolute inset-0 z-[2]" style={{ clipPath: "circle(0px at 50% 50%)" }}>
          <div className="grain absolute inset-0 opacity-[0.07] mix-blend-screen" />
        </div>

        {ready && <ReachWorld />}

        {/* the student's hand — a real one */}
        <Image
          src="/reach/hand.webp"
          width={HAND.w}
          height={HAND.h}
          unoptimized
          alt="A student's hand reaching up toward the AUVOX hand"
          draggable={false}
          className="rch-student pointer-events-none absolute top-0 left-0 z-[4] max-w-none opacity-0 will-change-transform"
          style={{ width: 0, height: 0 }}
        />

        {/* the bank we rise out of, in front of everything */}
        <Image src="/reach/clouds-near.webp" alt="" width={1536} height={1024} unoptimized draggable={false} className="rch-near pointer-events-none absolute inset-0 z-[5] h-full w-full origin-top object-cover will-change-transform" />
        <div className="rch-veil pointer-events-none absolute inset-0 z-[6] bg-peach" />

        {/* the words */}
        <div className="rch-a pointer-events-none absolute inset-0 z-[7]" aria-hidden>
          <Phrase className="top-[14%] left-[6%] text-[clamp(2.6rem,6.4vw,7rem)]">Every musician</Phrase>
          <Phrase className="right-[6%] bottom-[24%] text-right text-[clamp(1.4rem,2.6vw,2.8rem)] italic">was once</Phrase>
          <Phrase accent className="right-[6%] bottom-[12%] text-right text-[clamp(2.6rem,6.4vw,7rem)]">
            a beginner.
          </Phrase>
        </div>
        <div className="rch-b pointer-events-none absolute inset-0 z-[7]" aria-hidden>
          <Phrase className="top-[14%] left-[6%] text-[clamp(2.6rem,6.4vw,7rem)]">No one learns</Phrase>
          <Phrase className="right-[6%] bottom-[24%] text-right text-[clamp(1.4rem,2.6vw,2.8rem)] italic">music</Phrase>
          <Phrase accent className="right-[6%] bottom-[12%] text-right text-[clamp(2.6rem,6.4vw,7rem)]">
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
          className="rch-ring absolute z-[8] -mt-[60px] -ml-[60px] flex h-[120px] w-[120px] items-center justify-center rounded-full"
          style={{ left: "50%", top: "50%", touchAction: "none", WebkitTouchCallout: "none" }}
        >
          <svg viewBox="0 0 100 100" className="rch-ring-svg absolute inset-0 h-full w-full -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.2" />
            <circle className="rch-arc" cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeDasharray={2 * Math.PI * 46} strokeDashoffset={2 * Math.PI * 46} />
          </svg>
          <span className="rch-ring-pulse absolute inset-[18%] rounded-full border border-current" aria-hidden />
          <span className="rch-ring-dot block h-2 w-2 rounded-full bg-current" aria-hidden />
          <span className="rch-ring-label pointer-events-none absolute top-1/2 left-[calc(100%+0.6rem)] -translate-y-1/2 text-left text-[0.58rem] leading-[1.5] font-semibold tracking-[0.34em] whitespace-nowrap uppercase">
            <span className="pointer-coarse:hidden">Click &amp; hold</span>
            <span className="hidden pointer-coarse:inline">Tap &amp; hold</span>
            <br />
            <span className="opacity-60">Reach back</span>
          </span>
        </button>

        {/* at the touch */}
        <div className="rch-head pointer-events-none absolute inset-x-0 bottom-[9%] z-[8] px-6 text-center text-peach md:bottom-[8%]">
          <h2 className="rch-head-title font-display text-[clamp(2.6rem,7vw,7.6rem)] leading-[0.98] tracking-[-0.02em]">
            You reach. We reach <em className="not-italic text-tan">back.</em>
          </h2>
          <p className="rch-head-sub mt-5 text-[0.62rem] font-semibold tracking-[0.38em] text-peach/70 uppercase">The AUVOX promise</p>
        </div>

        <div className="grain pointer-events-none absolute inset-0 z-[9] opacity-[0.05] mix-blend-multiply" />
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
