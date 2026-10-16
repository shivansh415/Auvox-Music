"use client";

import { useRef } from "react";
import clsx from "clsx";
import { gsap, ScrollTrigger, SplitText, useGSAP } from "@/lib/gsap";
import { JOURNEY } from "@/content/packages";
import SectionHead from "@/components/ui/SectionHead";
import Button from "@/components/ui/Button";
import InkReveal, { type InkState } from "./InkReveal";
import { wavePath, waveX, type WaveState } from "./wave";

const NUMERALS = ["i", "ii", "iii", "iv", "v"] as const;
/** each step's illustration, and where its red sun rises (uv centre + radius as a share of the height) */
const ART: { sun: [number, number, number]; alt: string }[] = [
  { sun: [0.8, 0.22, 0.17], alt: "A guitar leaning on a keyboard stand beside a small amplifier" },
  { sun: [0.2, 0.2, 0.16], alt: "A desk with a laptop on a video call with a music instructor" },
  { sun: [0.42, 0.2, 0.14], alt: "Two pedestals: the Frequency Box alone, and the box with a guitar case" },
  { sun: [0.78, 0.22, 0.17], alt: "A front door with the Frequency Box and a guitar case on the step" },
  { sun: [0.24, 0.24, 0.2], alt: "A student playing guitar in a home studio, an instructor on the laptop" },
];
/** scroll progress per illustration — written by the ScrollTriggers, read by each canvas (render-free) */
const INKS: InkState[] = JOURNEY.steps.map(() => ({ p: 0, dirty: true }));
const pad = (n: number) => String(n).padStart(2, "0");
const TOTAL = pad(JOURNEY.steps.length);

/**
 * Section 6 — Journey. A sound-wave line draws itself down the page as you scroll and keeps undulating;
 * the five steps reveal one by one beside it while the heading stays pinned. Each step carries a
 * picture that starts as a pen drawing and is inked into a black-and-white render as it scrolls up,
 * with a brand-red sun blooming through it (InkReveal); the pointer paints ink over it too.
 */
export default function Journey() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      const list = q<HTMLDivElement>(".jr-steps")[0];
      const svg = q<SVGSVGElement>(".jr-wave")[0];
      const linePaths = q<SVGPathElement>(".jr-wave-path");
      const sticky = q<HTMLDivElement>(".jr-sticky")[0];
      const steps = q<HTMLElement>(".jr-step");
      const nodeWraps = q<HTMLElement>(".jr-node-wrap");
      const nodes = q<HTMLElement>(".jr-node");
      const count = q<HTMLElement>(".jr-count")[0];
      const fill = q<HTMLElement>(".jr-rail-fill")[0];
      const cta = q<HTMLElement>(".jr-cta")[0];
      if (!list || !svg || !sticky || !count || !fill || !cta) return;

      // --- shared, mutable scene state (never React state: written on the ticker)
      const wave: WaveState = { w: 120, h: 0, t: 0, px: 60, py: 0, strength: 0 };
      const pointer = { x: 60, y: 0, on: 0 };
      const nodeY: number[] = [];
      let visible = false;
      let draw: gsap.core.Tween | null = null;

      gsap.set(nodes, { xPercent: -50, yPercent: -50 });
      const setX = nodes.map((n) => gsap.quickSetter(n, "x", "px"));

      /** beads ride the line: their x follows the wave at their own height */
      const render = () => {
        linePaths.forEach((p) => p.setAttribute("d", wavePath(wave)));
        const cx = wave.w / 2;
        for (let i = 0; i < nodes.length; i++) setX[i](waveX(nodeY[i] ?? 0, wave) - cx);
      };

      /** the svg viewBox mirrors its rendered size so 1 unit = 1px */
      const measure = () => {
        const r = svg.getBoundingClientRect();
        wave.w = r.width || 120;
        wave.h = list.offsetHeight;
        svg.setAttribute("viewBox", `0 0 ${wave.w} ${wave.h}`);
        const top = list.getBoundingClientRect().top;
        nodeWraps.forEach((n, i) => {
          nodeY[i] = n.getBoundingClientRect().top - top;
        });
        render();
      };

      const mm = gsap.matchMedia();
      // `all` always matches: with condition syntax the callback only runs when at least one query is
      // true, and on a phone (no reduced motion, not desktop, coarse pointer) none of the others are
      mm.add({ all: "all", reduce: "(prefers-reduced-motion: reduce)", desktop: "(min-width: 1024px)", fine: "(pointer: fine)" }, (ctx) => {
        const c = ctx.conditions ?? {};
        const reduce = !!c.reduce;
        const desktop = !!c.desktop;
        const fine = !!c.fine;
        const splits: SplitText[] = [];

        measure();
        ScrollTrigger.addEventListener("refresh", measure);

        // --- the line draws itself as the steps scroll past (DrawSVG, scrubbed; `live` via non-scaling-stroke)
        if (!reduce) {
          draw = gsap.fromTo(linePaths, { drawSVG: "0%" }, { drawSVG: "100%", ease: "none", scrollTrigger: { trigger: list, start: "top 72%", end: "bottom 58%", scrub: 1 } });
        }

        // --- only animate while the section is on screen
        const gate = ScrollTrigger.create({
          trigger: el,
          start: "top bottom",
          end: "bottom top",
          onToggle: (self) => {
            visible = self.isActive;
          },
        });

        // --- ticker: the wave undulates, eases toward the pointer, and the scrubbed draw is re-rendered
        //     against the new path length
        const tick = (time: number) => {
          if (!visible) return;
          wave.t = time;
          wave.px += (pointer.x - wave.px) * 0.1;
          wave.py += (pointer.y - wave.py) * 0.1;
          wave.strength += (pointer.on - wave.strength) * 0.06;
          render();
          draw?.render(draw.totalTime(), true, true);
        };
        if (!reduce) gsap.ticker.add(tick);

        // --- pointer: a local bulge toward the cursor when it is near the line
        const onMove = (e: PointerEvent) => {
          const r = svg.getBoundingClientRect();
          pointer.x = e.clientX - r.left;
          pointer.y = e.clientY - r.top;
          pointer.on = Math.abs(pointer.x - wave.w / 2) < 320 ? 1 : 0;
        };
        const onLeave = () => {
          pointer.on = 0;
        };
        if (!reduce && fine) {
          el.addEventListener("pointermove", onMove);
          el.addEventListener("pointerleave", onLeave);
        }

        // --- desktop: pin the heading while the steps scroll past; the rail fills with scroll
        const pinned = desktop && !reduce;
        if (pinned) {
          const offset = () => Math.max(104, (window.innerHeight - sticky.offsetHeight) / 2);
          ScrollTrigger.create({
            trigger: sticky,
            start: () => `top ${offset()}`,
            endTrigger: list,
            end: () => `bottom ${offset() + sticky.offsetHeight}`,
            pin: sticky,
            pinSpacing: false,
            invalidateOnRefresh: true,
          });
          gsap.fromTo(fill, { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: list, start: "top 62%", end: "bottom 62%", scrub: 0.6 } });
        } else {
          gsap.set(fill, { scaleY: 0 });
        }

        // --- steps
        steps.forEach((step, i) => {
          const sq = gsap.utils.selector(step);
          const tl = gsap.timeline({ paused: true, defaults: { ease: "expo.out" } });

          // the illustration: drawn, inked and lit by the scroll (scrubbed, so it reverses on the way up)
          const ink = INKS[i];
          if (reduce) {
            ink.p = 1;
            ink.dirty = true;
          } else {
            gsap.fromTo(
              ink,
              { p: 0 },
              {
                p: 1,
                ease: "none",
                onUpdate: () => {
                  ink.dirty = true;
                },
                scrollTrigger: { trigger: sq(".jr-art")[0], start: "top 88%", end: "center 42%", scrub: 0.6 },
              },
            );
          }

          if (reduce) {
            gsap.set(step, { autoAlpha: 0 });
            tl.to(step, { autoAlpha: 1, duration: 0.8 });
          } else {
            const title = new SplitText(sq(".jr-title"), { type: "lines", linesClass: "jr-line" });
            const body = new SplitText(sq(".jr-body"), { type: "lines", linesClass: "jr-line" });
            splits.push(title, body);
            tl.fromTo(sq(".jr-art"), { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.2 }, 0)
              .fromTo(sq(".jr-num"), { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9 }, 0.1)
              .from(title.lines, { yPercent: 110, duration: 1.1, stagger: 0.06 }, 0.2)
              .from(body.lines, { yPercent: 110, duration: 1, stagger: 0.045 }, 0.35)
              .fromTo(sq(".jr-ghost"), { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.6 }, 0.05)
              .add(() => {
                title.revert();
                body.revert();
              });

            // depth: the picture drifts a little slower than the copy
            if (desktop) {
              gsap.fromTo(sq(".jr-art"), { y: 36 }, { y: -36, ease: "none", scrollTrigger: { trigger: step, start: "top bottom", end: "bottom top", scrub: true } });
            }
          }

          ScrollTrigger.create({ trigger: step, start: "top 82%", once: true, onEnter: () => tl.play() });

          // active window: contiguous, exactly one step lit at a time
          ScrollTrigger.create({
            trigger: step,
            start: "top 62%",
            end: "bottom 62%",
            onToggle: (self) => {
              step.dataset.active = self.isActive ? "1" : "0";
              if (!self.isActive) return;
              count.textContent = pad(i + 1);
              if (!pinned) gsap.to(fill, { scaleY: (i + 1) / steps.length, duration: 0.8, ease: "expo.out" });
            },
          });
        });

        // --- CTA
        gsap.fromTo(cta, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: cta, start: "top 88%", once: true } });

        return () => {
          gsap.ticker.remove(tick);
          ScrollTrigger.removeEventListener("refresh", measure);
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerleave", onLeave);
          gate.kill();
          splits.forEach((s) => s.revert());
          draw = null;
        };
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} id="journey" className="relative overflow-hidden bg-peach py-24 md:py-36">
      <div className="jr-glow pointer-events-none absolute inset-0" />
      <div className="grain pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-multiply" />

      <div className="relative mx-auto max-w-[1440px] px-6 md:px-12">
        <div className="lg:grid lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-x-12 xl:gap-x-16">
          {/* heading — pinned on desktop */}
          <div className="lg:self-start">
            <div className="jr-sticky">
              <SectionHead kicker={JOURNEY.kicker} title={JOURNEY.title} accent={JOURNEY.accent} body={JOURNEY.body} />
              <div className="mt-12 hidden items-center gap-6 lg:flex">
                <span className="relative block h-24 w-px overflow-hidden bg-ink/15">
                  <span className="jr-rail-fill absolute inset-0 origin-top bg-red" />
                </span>
                <span className="font-display text-[1.7rem] leading-none text-ink">
                  <span className="jr-count">01</span>
                  <span className="mx-3 text-ink/30">—</span>
                  <span className="text-ink/40">{TOTAL}</span>
                </span>
              </div>
            </div>
          </div>

          {/* steps + the line */}
          <div className="jr-steps relative mt-16 lg:mt-0">
            <svg className="jr-wave pointer-events-none absolute top-0 left-0 h-full w-10 overflow-visible text-ink lg:left-1/2 lg:w-[120px] lg:-translate-x-1/2" viewBox="0 0 120 1000" aria-hidden>
              <path className="jr-wave-path text-tan" d="" fill="none" stroke="currentColor" strokeWidth="5" strokeOpacity="0.35" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <path className="jr-wave-path" d="" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>

            {JOURNEY.steps.map((s, i) => {
              const right = i % 2 === 1;
              return (
                <article
                  key={s.title}
                  data-active="0"
                  className="jr-step relative py-10 pl-12 lg:grid lg:min-h-[78vh] lg:grid-cols-2 lg:items-center lg:gap-x-36 lg:py-14 lg:pl-0"
                >
                  <span className="jr-node-wrap absolute top-[5.15rem] left-5 block h-0 w-0 lg:top-1/2 lg:left-1/2">
                    <span className="jr-node absolute top-0 left-0 block h-[14px] w-[14px]">
                      <span className="jr-ring" />
                      <span className="jr-dot" />
                    </span>
                  </span>

                  {/* the picture on one side of the line: pen drawing → inked render → red sun; the pointer paints too */}
                  <div className={clsx("jr-content relative w-full lg:row-start-1 lg:max-w-[30rem]", right ? "lg:col-start-2 lg:justify-self-start" : "lg:col-start-1 lg:justify-self-end")}>
                    <div className="jr-art relative">
                      <InkReveal
                        lines={`/journey/0${i + 1}-lines.webp`}
                        render={`/journey/0${i + 1}-render.webp`}
                        sun={ART[i].sun}
                        alt={ART[i].alt}
                        state={INKS[i]}
                        seed={i + 1}
                      />
                    </div>
                  </div>

                  {/* the words on the other, facing the line */}
                  <div
                    className={clsx(
                      "jr-content relative mt-8 w-full lg:row-start-1 lg:mt-0 lg:max-w-[24rem]",
                      right ? "lg:col-start-1 lg:justify-self-end lg:text-right" : "lg:col-start-2 lg:justify-self-start",
                    )}
                  >
                    {/* a big outlined numeral heads the copy */}
                    <span className="jr-ghost font-display pointer-events-none mb-5 hidden text-[7.5rem] leading-[0.78] tracking-[-0.02em] select-none lg:block" aria-hidden>
                      {pad(i + 1)}
                    </span>
                    <span className={clsx("jr-num flex items-center gap-3 text-[0.62rem] font-semibold tracking-[0.32em] text-ink/55 uppercase", right && "lg:flex-row-reverse")}>
                      <span className="jr-mark block h-2 w-2 bg-red" aria-hidden />
                      <span className="font-display text-[1.35rem] leading-none tracking-normal text-red normal-case">{NUMERALS[i]}</span>
                      <span className="block h-px w-8 bg-ink/25" aria-hidden />
                      <span>
                        Step {pad(i + 1)} <span className="text-ink/35">/ {TOTAL}</span>
                      </span>
                    </span>
                    <h3 className="jr-title font-display mt-5 text-[clamp(1.9rem,2.9vw,2.9rem)] leading-[1.02] tracking-[-0.015em] text-balance text-ink">{s.title}</h3>
                    <p className={clsx("jr-body mt-5 max-w-[24rem] text-[1.04rem] leading-relaxed text-pretty text-ink/72", right && "lg:ml-auto")}>{s.body}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="jr-cta mt-20 flex flex-col items-center gap-5 sm:flex-row sm:justify-center lg:mt-28">
          <Button href="/reserve" variant="ink">
            Reserve your free demo
          </Button>
          <Button href="/packages" variant="ghost">
            Explore packages
          </Button>
        </div>
      </div>
    </section>
  );
}
