"use client";

// Section 4 — The Verse Universe. The client's T/L/S copy beside THE MUSIC DISC: a vinyl record that
// keeps slowly turning (scroll adds a little more), the AUVOX logomark on its centre label, and the
// verses riding its orbit — Guitar and Piano (live, with their 3D instruments) plus Drum and
// Production (still to come, dashed). Hover/tap the logo for what AUVOX is; click a verse to read its
// intro and enter it.

import dynamic from "next/dynamic";
import Image from "next/image";
import { useRef, useState } from "react";
import clsx from "clsx";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import SectionHead from "@/components/ui/SectionHead";
import { playChord, playRiff, unlockAudio } from "@/components/sections/Session/audio";
import type { Verse } from "@/content/packages";
import Sheet, { type SheetContent } from "./Sheet";
import { DEG, NODES, ORBIT, SCRUB_DEGREES, SPIN_SPEED, TAG_OFFSET, disc, discAngle, setHover, type NodeKey } from "./state";

const DiscWorld = dynamic(() => import("./DiscWorld"), { ssr: false });

// Client copy, verbatim.
const COPY = {
  kicker: "The Verse Universe",
  title: "Every instrument has a voice waiting to be found.",
  accent: "found.",
  body: ["The Verse Universe is a growing world of music where every voice is trained, shaped, and set free.", "One world. Many instruments. One standard of mastery."],
} as const;

/** beads and notes that drift along the orbit: angle on the ring, and size in px */
const BEADS: { at: number; glyph?: string; size: number }[] = [
  { at: 4, size: 5 },
  { at: 47, glyph: "♪", size: 10 },
  { at: 82, size: 4 },
  { at: 131, size: 6 },
  { at: 161, glyph: "♫", size: 9 },
  { at: 213, size: 4 },
  { at: 246, size: 5 },
  { at: 290, glyph: "♪", size: 10 },
  { at: 327, size: 4 },
];

/** the plate is inset 2% in the box, so box fractions become plate percentages like this */
const PLATE = 0.96;
const ORBIT_PCT = (ORBIT / PLATE) * 100;
const LABEL_PCT = (0.125 / PLATE) * 100;
const RING_PCT = (0.157 / PLATE) * 100;
const RING_LEN = 2 * Math.PI * RING_PCT;

export default function VerseUniverse() {
  const root = useRef<HTMLElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const origin = useRef({ x: 0, y: 0 });
  const viaHover = useRef(false);
  /** true for a moment after a sheet closes, so the mouse still sitting on the logo doesn't reopen it */
  const cooling = useRef(false);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<SheetContent | null>(null);

  /** remember where a sheet should grow from: the centre of `el`, in section pixels */
  const place = (el: HTMLElement) => {
    const s = root.current?.getBoundingClientRect();
    if (!s) return;
    const r = el.getBoundingClientRect();
    origin.current = { x: r.left + r.width / 2 - s.left, y: r.top + r.height / 2 - s.top };
  };
  const close = () => {
    cooling.current = true;
    window.setTimeout(() => {
      cooling.current = false;
    }, 700);
    setOpen(false);
  };
  const openAbout = (el: HTMLElement, hover: boolean) => {
    // a sheet that just closed shouldn't pop straight back open because the mouse is still on the logo
    if (hover && cooling.current) return;
    place(el);
    viaHover.current = hover;
    setContent({ kind: "about" });
    setOpen(true);
  };
  const openVerse = (verse: Verse, el: HTMLElement) => {
    unlockAudio();
    place(el);
    viaHover.current = false;
    setHover(null);
    setContent({ kind: "verse", verse });
    setOpen(true);
  };

  const over = (key: NodeKey) => {
    if (disc.hover === key) return;
    setHover(key);
    unlockAudio();
    if (key === "guitar") playRiff();
    else playChord();
  };
  const out = () => setHover(null);

  useGSAP(
    () => {
      const el = root.current;
      const b = box.current;
      if (!el || !b) return;
      const q = gsap.utils.selector(el);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      disc.still = reduce;

      // --- near the viewport: mount the canvas, and run the loops only while we are around
      const io = new IntersectionObserver(
        ([entry]) => {
          disc.inView = entry.isIntersecting;
          if (entry.isIntersecting) setReady(true);
        },
        { rootMargin: "35% 0px" },
      );
      io.observe(el);

      // --- entrance: the disc rises and scales in, then the pucks, the instruments and the labels follow
      gsap
        .timeline({ scrollTrigger: { trigger: el, start: "top 75%", once: true }, defaults: { ease: "expo.out" } })
        .fromTo(q(".vu-rise"), { y: reduce ? 0 : 90, scale: reduce ? 1 : 0.82, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 1.6 }, 0)
        .to(disc, { enter: 1, duration: 1.8 }, 0.5)
        .fromTo(q(".vu-puck-in"), { scale: 0.4, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 1.1, stagger: 0.09 }, 0.55)
        .fromTo(q(".vu-core"), { scale: 0.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 1.1 }, 0.7)
        .fromTo(q(".vu-tag"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.9, stagger: 0.09 }, 0.85)
        .fromTo(q(".vu-bead"), { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.8, stagger: 0.04 }, 0.9)
        .fromTo(q(".vu-foot"), { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.1 }, 1.0);

      // --- scroll scrubs extra rotation on top of the idle spin
      if (!reduce) {
        gsap.to(disc, { scrub: SCRUB_DEGREES, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 1 } });
      }
      // scrolling clean past the section closes whatever is open
      const leave = ScrollTrigger.create({ trigger: el, start: "top bottom", end: "bottom top", onLeave: close, onLeaveBack: close });

      // --- the ticker: turns the plate, drifts the beads, and glues pucks + labels to the orbit points
      // that the 3D layer projects (falling back to the same maths until the canvas is up)
      let size = b.clientWidth;
      const ro = new ResizeObserver(() => {
        size = b.clientWidth;
      });
      ro.observe(b);
      const plate = q<HTMLElement>(".vu-plate")[0];
      const ring = q<HTMLElement>(".vu-ring")[0];
      const glyphs = q<HTMLElement>(".vu-bead-glyph");
      const nodes = NODES.map((n) => ({
        n,
        el: q<HTMLElement>(`.vu-node[data-node="${n.key}"]`)[0],
        tag: q<HTMLElement>(`.vu-tag[data-node="${n.key}"]`)[0],
        puck: q<HTMLElement>(`.vu-puck[data-node="${n.key}"]`)[0],
        hovered: "",
      }));
      const tick = (_t: number, dtMs: number) => {
        if (!disc.inView || !size) return;
        if (!disc.still) disc.spin += (Math.min(dtMs, 50) / 1000) * SPIN_SPEED;
        const a = discAngle();
        plate.style.transform = `rotate(${a}deg)`;
        // the beads turn slower than the disc, so they appear to slide back along the groove
        const drift = a * 0.72;
        ring.style.transform = `rotate(${drift}deg)`;
        for (const g of glyphs) g.style.transform = `rotate(${-drift}deg)`;
        const half = size / 2;
        for (const node of nodes) {
          const { n, el: nodeEl, tag, puck } = node;
          const p = disc.anchors[n.key];
          let x: number;
          let y: number;
          if (p.on) {
            x = p.x;
            y = p.y;
          } else {
            const t = (a + n.angle) * DEG;
            x = half + Math.cos(t) * ORBIT * size;
            y = half + Math.sin(t) * ORBIT * size;
          }
          const tf = `translate(${x}px, ${y}px)`;
          nodeEl.style.transform = tf;
          puck.style.transform = tf;
          // the label sits just outside its node, on the side away from the centre
          const dx = x - half;
          const dy = y - half;
          const len = Math.hypot(dx, dy) || 1;
          const off = size * TAG_OFFSET;
          tag.style.transform = `translate(${(dx / len) * off}px, ${(dy / len) * off}px) translate(-50%, -50%)`;
          const h = disc.hover === n.key ? "1" : "0";
          if (node.hovered !== h) {
            node.hovered = h;
            nodeEl.dataset.hover = h;
            puck.dataset.hover = h;
          }
        }
      };
      gsap.ticker.add(tick);

      return () => {
        io.disconnect();
        ro.disconnect();
        gsap.ticker.remove(tick);
        leave.kill();
        disc.inView = false;
      };
    },
    { scope: root },
  );

  return (
    <section ref={root} id="verse-universe" className="relative overflow-clip bg-cream text-ink">
      <div className="grain pointer-events-none absolute inset-[-50%] opacity-[0.04] mix-blend-multiply" />
      {/* a soft pool of peach behind the disc, a whisper of tan at the foot */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_55%_at_72%_50%,rgba(250,227,197,0.95),transparent_72%),linear-gradient(180deg,transparent_60%,rgba(231,180,126,0.18))]" />

      <div className="relative mx-auto max-w-[1440px] px-6 py-24 md:px-12 md:py-36">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
          {/* copy */}
          <SectionHead kicker={COPY.kicker} title={COPY.title} accent={COPY.accent} body={COPY.body} className="lg:max-w-[34rem]" />

          {/* THE MUSIC DISC */}
          <div>
            <div ref={box} className="@container relative mx-auto aspect-square w-full min-w-[320px] max-w-[700px]">
              <div className="vu-rise absolute inset-0 opacity-0">
                {/* the record: grooves, the orbit the verses ride, the label with its ring of type — this turns */}
                <div className="vu-plate absolute inset-[2%] overflow-hidden rounded-full bg-ink shadow-[0_50px_100px_-30px_rgba(30,30,30,0.55)]">
                  <div className="vu-grooves absolute inset-0 rounded-full" />
                  <div className="vu-tracks absolute inset-0 rounded-full" />
                  <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
                    <defs>
                      <radialGradient id="vu-label-fill" cx="40%" cy="36%" r="72%">
                        <stop offset="0" stopColor="#fae3c5" />
                        <stop offset="0.65" stopColor="#e7b47e" />
                        <stop offset="1" stopColor="#deb886" />
                      </radialGradient>
                      <path id="vu-ring-path" d={`M50 50 m-${RING_PCT} 0 a${RING_PCT} ${RING_PCT} 0 1 1 ${RING_PCT * 2} 0 a${RING_PCT} ${RING_PCT} 0 1 1 -${RING_PCT * 2} 0`} />
                    </defs>
                    <circle cx="50" cy="50" r={ORBIT_PCT} fill="none" stroke="#e7b47e" strokeOpacity="0.4" strokeWidth="0.22" strokeDasharray="0.5 1.5" />
                    <circle cx="50" cy="50" r={ORBIT_PCT + 4.2} fill="none" stroke="#fdf2e3" strokeOpacity="0.08" strokeWidth="0.2" />
                    <circle cx="50" cy="50" r={ORBIT_PCT - 4.2} fill="none" stroke="#fdf2e3" strokeOpacity="0.08" strokeWidth="0.2" />
                    <circle cx="50" cy="50" r={LABEL_PCT} fill="url(#vu-label-fill)" />
                    <circle cx="50" cy="50" r={LABEL_PCT} fill="none" stroke="#1e1e1e" strokeOpacity="0.3" strokeWidth="0.3" />
                    <circle cx="50" cy="50" r={LABEL_PCT - 0.9} fill="none" stroke="#850909" strokeOpacity="0.35" strokeWidth="0.18" />
                    <text fontSize="2.05" letterSpacing="0.5" fill="#fdf2e3" fillOpacity="0.55" fontWeight="600" textLength={RING_LEN} lengthAdjust="spacingAndGlyphs">
                      <textPath href="#vu-ring-path">AUVOX MUSIC · THE VERSE UNIVERSE · ONE STANDARD OF MASTERY ·</textPath>
                    </text>
                  </svg>
                </div>
                {/* light on the vinyl: this does not turn, so the sheen slides over the grooves */}
                <div className="vu-sheen pointer-events-none absolute inset-[2%] rounded-full" />
                <div className="pointer-events-none absolute inset-[2%] rounded-full bg-[radial-gradient(40%_40%_at_32%_28%,rgba(253,242,227,0.14),transparent_70%)]" />

                {/* beads and notes drifting along the groove */}
                <div className="vu-ring pointer-events-none absolute inset-0 z-[4]" aria-hidden>
                  {BEADS.map((bead, i) => (
                    <span key={i} className="absolute top-1/2 left-1/2" style={{ transform: `rotate(${bead.at}deg) translate(${ORBIT * 100}cqw) rotate(${-bead.at}deg)` }}>
                      <span className="vu-bead block -translate-x-1/2 -translate-y-1/2">
                        {bead.glyph ? (
                          <span className="vu-bead-glyph font-display block leading-none text-tan" style={{ fontSize: bead.size * 1.7 }}>
                            {bead.glyph}
                          </span>
                        ) : (
                          <span className="block rounded-full bg-tan shadow-[0_0_8px_rgba(231,180,126,0.6)]" style={{ width: bead.size, height: bead.size }} />
                        )}
                      </span>
                    </span>
                  ))}
                </div>

                {/* the pucks each verse sits on (under the instruments) */}
                <div className="pointer-events-none absolute inset-0 z-[5]" aria-hidden>
                  {NODES.map((n) => (
                    <div key={n.key} data-node={n.key} className="vu-puck absolute top-0 left-0 -mt-[8.5%] -ml-[8.5%] h-[17%] w-[17%]">
                      <div className={clsx("vu-puck-in relative h-full w-full rounded-full", n.active ? "vu-puck-solid" : "vu-puck-ghost")}>
                        {!n.active && <span className="absolute inset-0 flex items-center justify-center text-[0.5rem] font-semibold tracking-[0.32em] text-peach/55 uppercase">Soon</span>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* the live guitar and keyboard */}
                {ready && <DiscWorld />}

                {/* the nodes: hit areas and labels (over the instruments) */}
                <div className="absolute inset-0 z-20">
                  {NODES.map((n) =>
                    n.active ? (
                      <button
                        key={n.key}
                        type="button"
                        data-node={n.key}
                        data-cursor="Open"
                        aria-label={`Open ${n.label}`}
                        aria-haspopup="dialog"
                        onPointerEnter={() => over(n.key)}
                        onPointerLeave={out}
                        onClick={(e) => openVerse(n.key, e.currentTarget)}
                        className="vu-node absolute top-0 left-0 -mt-[10.5%] -ml-[10.5%] h-[21%] w-[21%] rounded-full"
                      >
                        <span data-node={n.key} className="vu-tag vu-tag-solid absolute top-1/2 left-1/2 rounded-full bg-peach px-3.5 py-1.5 text-[0.58rem] font-semibold tracking-[0.28em] whitespace-nowrap text-ink uppercase shadow-[0_6px_20px_rgba(30,30,30,0.35)]">
                          {n.label}
                        </span>
                      </button>
                    ) : (
                      <span key={n.key} data-node={n.key} data-cursor="Soon" className="vu-node absolute top-0 left-0 -mt-[10.5%] -ml-[10.5%] h-[21%] w-[21%] rounded-full">
                        <span data-node={n.key} className="vu-tag vu-tag-ghost absolute top-1/2 left-1/2 rounded-full border border-dashed border-peach/45 px-3.5 py-1.5 text-[0.58rem] font-semibold tracking-[0.28em] whitespace-nowrap text-peach/60 uppercase">
                          {n.label}
                        </span>
                      </span>
                    ),
                  )}
                </div>

                {/* the logomark on the label: hover (mouse) or tap for what AUVOX is */}
                <button
                  type="button"
                  data-cursor="About"
                  aria-label="What is AUVOX"
                  aria-haspopup="dialog"
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse") openAbout(e.currentTarget, true);
                  }}
                  onClick={(e) => openAbout(e.currentTarget, false)}
                  className="vu-core group absolute top-1/2 left-1/2 z-30 flex h-[24%] w-[24%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
                >
                  <Image src="/svg/auvox-logomark.svg" alt="" width={87} height={78} unoptimized draggable={false} className="h-[40%] w-auto drop-shadow-[0_6px_14px_rgba(133,9,9,0.25)] transition-transform duration-500 ease-out group-hover:scale-110" />
                  <span className="pointer-events-none absolute -top-1 -right-2 hidden text-ink pointer-coarse:flex" aria-hidden>
                    <span className="tap-ring relative flex h-11 w-11 items-center justify-center rounded-full border border-current bg-cream/90">
                      <span className="text-[9px] font-semibold tracking-[0.3em]">TAP</span>
                    </span>
                  </span>
                </button>
              </div>
            </div>

            {/* legend */}
            <div className="vu-foot mt-7 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-[0.6rem] font-semibold tracking-[0.3em] text-ink/65 uppercase">
              <span className="flex items-center gap-3">
                <span className="block h-px w-8 bg-ink/40" aria-hidden />
                Choose your verse
              </span>
              <span className="flex items-center gap-5">
                <span className="flex items-center gap-2">
                  <span className="block h-2 w-2 rounded-full bg-ink" aria-hidden />
                  Active Verse
                </span>
                <span className="flex items-center gap-2">
                  <span className="block h-2 w-2 rounded-full border border-dashed border-ink/60" aria-hidden />
                  Future Verse
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* section index, continuing the hero's */}
      <div className="vu-foot pointer-events-none absolute bottom-8 left-6 flex items-center gap-4 md:left-12">
        <span className="font-display text-2xl text-ink/40">02</span>
        <span className="flex gap-2">
          <span className="block h-[2px] w-9 bg-ink/15" />
          <span className="block h-[2px] w-9 bg-red" />
          <span className="block h-[2px] w-9 bg-ink/15" />
          <span className="block h-[2px] w-9 bg-ink/15" />
        </span>
      </div>

      <Sheet open={open} content={content} origin={origin} viaHover={viaHover} onClose={close} />
    </section>
  );
}
