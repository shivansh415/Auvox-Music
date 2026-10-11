"use client";

import { useRef } from "react";
import clsx from "clsx";
import { gsap, ScrollTrigger, SplitText, useGSAP } from "@/lib/gsap";
import { JOURNEY } from "@/content/packages";
import SectionHead from "@/components/ui/SectionHead";
import Button from "@/components/ui/Button";
import { MOTIFS } from "./motifs";
import { wavePath, waveX, type WaveState } from "./wave";

const NUMERALS = ["i", "ii", "iii", "iv", "v"] as const;
const pad = (n: number) => String(n).padStart(2, "0");
const TOTAL = pad(JOURNEY.steps.length);

/**
 * Section 6 — Journey. A sound-wave line draws itself down the page as you scroll and keeps undulating;
 * the five steps reveal one by one beside it (Apple product-page style) while the heading stays pinned.
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
      mm.add({ reduce: "(prefers-reduced-motion: reduce)", desktop: "(min-width: 1024px)", fine: "(pointer: fine)" }, (ctx) => {
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
          const strokes = sq<SVGElement>(".jr-stroke");
          const tl = gsap.timeline({ paused: true, defaults: { ease: "expo.out" } });

          if (reduce) {
            gsap.set(step, { autoAlpha: 0 });
            tl.to(step, { autoAlpha: 1, duration: 0.8 });
          } else {
            const title = new SplitText(sq(".jr-title"), { type: "lines", linesClass: "jr-line" });
            const body = new SplitText(sq(".jr-body"), { type: "lines", linesClass: "jr-line" });
            splits.push(title, body);
            gsap.set(strokes, { drawSVG: "0%" });
            tl.fromTo(sq(".jr-ghost"), { scale: 0.9, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 1.5 }, 0)
              .fromTo(sq(".jr-num"), { yPercent: 36, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.2 }, 0.05)
              .fromTo(sq(".jr-motif"), { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9 }, 0.15)
              .from(title.lines, { yPercent: 110, duration: 1.1, stagger: 0.06 }, 0.2)
              .from(body.lines, { yPercent: 110, duration: 1, stagger: 0.045 }, 0.35)
              .fromTo(sq(".jr-index"), { y: 8, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8 }, 0.6)
              .add(() => {
                title.revert();
                body.revert();
              });

            // depth: the numerals travel slower than the copy
            if (desktop) {
              const st = { trigger: step, start: "top bottom", end: "bottom top", scrub: true } as const;
              gsap.fromTo(sq(".jr-ghost"), { y: -70 }, { y: 70, ease: "none", scrollTrigger: st });
              gsap.fromTo(sq(".jr-num"), { y: -28 }, { y: 28, ease: "none", scrollTrigger: st });
            }
          }

          ScrollTrigger.create({ trigger: step, start: "top 78%", once: true, onEnter: () => tl.play() });

          // active window: contiguous, exactly one step lit at a time
          let drawn = false;
          ScrollTrigger.create({
            trigger: step,
            start: "top 62%",
            end: "bottom 62%",
            onToggle: (self) => {
              step.dataset.active = self.isActive ? "1" : "0";
              if (!self.isActive) return;
              count.textContent = pad(i + 1);
              if (!pinned) gsap.to(fill, { scaleY: (i + 1) / steps.length, duration: 0.8, ease: "expo.out" });
              if (!drawn) {
                drawn = true;
                if (reduce) gsap.set(strokes, { drawSVG: "100%" });
                else gsap.fromTo(strokes, { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.6, ease: "expo.out", stagger: 0.05 });
              }
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
      <div className="grain pointer-events-none absolute inset-[-50%] opacity-[0.04] mix-blend-multiply" />

      <div className="relative mx-auto max-w-[1440px] px-6 md:px-12">
        <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-x-16 xl:gap-x-24">
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
              const Motif = MOTIFS[i];
              const right = i % 2 === 1;
              return (
                <article
                  key={s.title}
                  data-active="0"
                  className={clsx("jr-step relative py-10 pl-12 lg:flex lg:min-h-[62vh] lg:items-center lg:py-14 lg:pl-0", right ? "lg:pl-[calc(50%+4rem)]" : "lg:pr-[calc(50%+4rem)]")}
                >
                  <span className="jr-node-wrap absolute top-[5.15rem] left-5 block h-0 w-0 lg:top-1/2 lg:left-1/2">
                    <span className="jr-node absolute top-0 left-0 block h-[14px] w-[14px]">
                      <span className="jr-ring" />
                      <span className="jr-dot" />
                    </span>
                  </span>

                  <div className={clsx("jr-content relative w-full lg:max-w-[30rem]", !right && "lg:ml-auto lg:text-right")}>
                    <span
                      aria-hidden
                      className={clsx("jr-ghost pointer-events-none absolute -top-14 hidden select-none font-display text-[clamp(10rem,16vw,16rem)] leading-none text-tan/60 lg:block", right ? "-left-8" : "-right-8")}
                    >
                      {NUMERALS[i]}
                    </span>
                    <div className={clsx("relative flex items-end gap-6 lg:gap-10", !right && "lg:flex-row-reverse")}>
                      <span className="jr-num block font-display text-[1.7rem] leading-none text-red lg:text-[clamp(4.5rem,7vw,6.5rem)] lg:text-ink">{NUMERALS[i]}</span>
                      <span className="jr-motif block h-14 w-14 text-ink lg:h-24 lg:w-24">
                        <Motif className="h-full w-full" />
                      </span>
                    </div>
                    <h3 className="jr-title font-display mt-6 text-[clamp(1.7rem,2.6vw,2.5rem)] leading-[1.05] tracking-[-0.01em] text-ink lg:mt-8">{s.title}</h3>
                    <p className={clsx("jr-body mt-4 max-w-[28rem] text-[1.02rem] leading-relaxed text-ink/75", !right && "lg:ml-auto")}>{s.body}</p>
                    <span className="jr-index mt-6 block text-[0.62rem] font-semibold tracking-[0.3em] text-ink/50 uppercase">
                      Step {pad(i + 1)} / {TOTAL}
                    </span>
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
