"use client";

// The disc's overlays. One sheet, two kinds of content: "about" (hover/tap the centre logo) shows
// what AUVOX is and why; "verse" (click a verse node) shows that verse's intro with the way in.
//
// "About" reads as the record's liner notes: Side A is what AUVOX is, Side B is why — its reasons set
// as a tracklist — and between them a small spinning label is the spine. On wide screens the sheet is
// a solid low-contrast gradient (nothing from the section bleeds through it) that grows out of the
// logo, with the record's grooves rippling out from that same point. On phones and tablets it is a
// bottom sheet that slides up.

import { useEffect, useRef, type RefObject } from "react";
import Image from "next/image";
import clsx from "clsx";
import { gsap, SplitText, useGSAP } from "@/lib/gsap";
import { ABOUT, VERSE_COPY, type Verse } from "@/content/packages";
import Button from "@/components/ui/Button";
import { useTransition } from "@/store/transition";

export type SheetContent = { kind: "about" } | { kind: "verse"; verse: Verse };

type Props = {
  open: boolean;
  content: SheetContent | null;
  /** where the sheet grows from, in section pixels (written by whatever opened it) */
  origin: RefObject<{ x: number; y: number }>;
  /** opened by a hover, so a mouse leaving the sheet closes it again */
  viaHover: RefObject<boolean>;
  onClose: () => void;
};

const VERSE_HREF: Record<Verse, string> = { guitar: "/guitar-verse", piano: "/piano-verse" };

/** a heading whose last words take the accent colour */
function Title({ title, accent, className }: { title: string; accent: string; className?: string }) {
  const head = title.endsWith(accent) ? title.slice(0, -accent.length) : title;
  return (
    <h3 className={clsx("vu-sheet-title font-display text-ink", className)}>
      {head}
      <em className="not-italic text-red">{accent}</em>
    </h3>
  );
}

/** the small label above each side: a rule, the side letter in a ring, the kicker */
function Kicker({ side, text, className }: { side?: string; text: string; className?: string }) {
  return (
    <div className={clsx("vu-sheet-item flex items-center gap-4", className)}>
      <span className="vu-rule block h-px w-10 origin-left bg-ink/45" />
      {side && <span className="flex h-6 w-6 items-center justify-center rounded-full border border-red/50 font-display text-[0.8rem] leading-none text-red">{side}</span>}
      <span className="text-[0.62rem] font-semibold tracking-[0.36em] text-ink/65 uppercase">{text}</span>
    </div>
  );
}

/** the spine between the two sides: a hairline with a turning AUVOX label on it */
function Spine() {
  return (
    <div className="vu-spine relative flex items-center justify-center max-md:my-2 max-md:h-16 md:h-full md:w-24" aria-hidden>
      <span className="vu-spine-line absolute bg-ink/15 max-md:inset-x-0 max-md:top-1/2 max-md:h-px md:inset-y-6 md:left-1/2 md:w-px" />
      <span className="vu-spine-disc relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-ink shadow-[0_18px_40px_-14px_rgba(30,30,30,0.6)]">
        <span className="vu-grooves absolute inset-0 rounded-full opacity-80" />
        <span className="vu-spin absolute inset-[30%] flex items-center justify-center rounded-full bg-[radial-gradient(circle_at_40%_36%,#fae3c5,#e7b47e_65%,#deb886)]">
          <Image src="/svg/auvox-logomark.svg" alt="" width={87} height={78} unoptimized draggable={false} className="h-[46%] w-auto" />
        </span>
      </span>
    </div>
  );
}

function About() {
  const { what, why } = ABOUT;
  return (
    <div className="grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-x-10 lg:gap-x-16">
      {/* Side A — what AUVOX is */}
      <div className="md:py-6">
        <Kicker side="A" text={what.kicker} />
        <Title title={what.title} accent={what.accent} className="mt-7 text-[clamp(2rem,3.5vw,3.6rem)] leading-[1.02] tracking-[-0.018em]" />
        {what.body.map((b, i) => (
          <p key={i} className={clsx("vu-sheet-item max-w-[30rem] text-[1.04rem] leading-relaxed text-ink/72", i === 0 ? "mt-7" : "mt-3")}>
            {b}
          </p>
        ))}
      </div>

      <Spine />

      {/* Side B — why AUVOX, its reasons as a tracklist */}
      <div className="md:py-6">
        <Kicker side="B" text={why.kicker} />
        <Title title={why.title} accent={why.accent} className="mt-7 text-[clamp(2rem,3.5vw,3.6rem)] leading-[1.02] tracking-[-0.018em]" />
        <p className="vu-sheet-item mt-7 text-[0.62rem] font-semibold tracking-[0.36em] text-ink/50 uppercase">AUVOX, because</p>
        <ol className="mt-3 border-t border-ink/12">
          {why.points.map((p, i) => (
            <li key={p} className="vu-track group flex items-center gap-4 border-b border-ink/12 py-3.5">
              <span className="w-7 shrink-0 font-display text-[0.95rem] text-red/80 tabular-nums">B{i + 1}</span>
              <span className="text-[1.04rem] text-ink/85 transition-colors duration-300 group-hover:text-ink">{p}</span>
              <span className="vu-leader mx-1 h-px flex-1 origin-left translate-y-[0.35em] border-b border-dotted border-ink/30" aria-hidden />
              <span className="vu-track-dot block h-1.5 w-1.5 shrink-0 rounded-full bg-ink/25" aria-hidden />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function VerseIntro({ verse, onEnter }: { verse: Verse; onEnter: () => void }) {
  const c = VERSE_COPY[verse];
  return (
    <div className="md:mx-auto md:max-w-[52rem]">
      <Kicker text={c.kicker} />
      <Title title={c.title} accent={c.accent} className="mt-7 text-[clamp(2.1rem,4vw,4rem)] leading-[1.0] tracking-[-0.018em]" />
      <p className="vu-sheet-item mt-7 max-w-[36rem] text-[1.06rem] leading-relaxed text-ink/72">{c.body}</p>
      <ol className="mt-8 max-w-[30rem] border-t border-ink/12">
        {c.points.map((p, i) => (
          <li key={p} className="vu-track group flex items-center gap-4 border-b border-ink/12 py-3.5">
            <span className="w-7 shrink-0 font-display text-[0.95rem] text-red/80 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
            <span className="text-[1.04rem] text-ink/85">{p}</span>
            <span className="vu-leader mx-1 h-px flex-1 origin-left translate-y-[0.35em] border-b border-dotted border-ink/30" aria-hidden />
            <span className="vu-track-dot block h-1.5 w-1.5 shrink-0 rounded-full bg-ink/25" aria-hidden />
          </li>
        ))}
      </ol>
      <div className="vu-sheet-item mt-10">
        <Button variant="red" onClick={onEnter}>
          Enter the verse
        </Button>
      </div>
    </div>
  );
}

function Close({ onClose, className }: { onClose: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className={clsx(
        "vu-sheet-close group z-10 items-center gap-3 rounded-full border border-ink/20 bg-cream/70 py-2 pr-2 pl-4 text-[0.6rem] font-semibold tracking-[0.3em] text-ink uppercase backdrop-blur-sm transition-colors duration-300 hover:border-ink hover:bg-ink hover:text-peach",
        className,
      )}
    >
      <span className="max-md:hidden">Close</span>
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-peach transition-transform duration-500 group-hover:rotate-90 group-hover:bg-peach group-hover:text-ink">
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
          <path d="M2 2l8 8M10 2l-8 8" strokeLinecap="round" />
        </svg>
      </span>
    </button>
  );
}

export default function Sheet({ open, content, origin, viaHover, onClose }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef(0);
  const splits = useRef<SplitText[]>([]);
  const go = useTransition();

  // --- escape closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // --- the global scroll cue hides while a sheet is up; make sure it comes back if we unmount mid-open
  useEffect(() => {
    const t = leaveTimer;
    const s = splits;
    return () => {
      window.clearTimeout(t.current);
      s.current.forEach((x) => x.revert());
      document.documentElement.dataset.overlay = "";
    };
  }, []);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      document.documentElement.dataset.overlay = open ? "1" : "";
      const q = gsap.utils.selector(el);
      const wide = window.matchMedia("(min-width: 768px)").matches;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const panel = q(".vu-sheet-panel");
      const bg = q(".vu-sheet-bg");
      const items = q(".vu-sheet-item");
      const closes = q(".vu-sheet-close");
      const { x, y } = origin.current;
      splits.current.forEach((s) => s.revert());
      splits.current = [];

      if (open) {
        // shown first, so the measurements below are real
        gsap.set(el, { display: "block", "--ox": `${x}px`, "--oy": `${y}px` });
        const tl = gsap.timeline({ defaults: { ease: "expo.out", overwrite: "auto" } });
        if (wide) {
          // grows out of the logo (or the verse that was clicked) until it covers the section
          const r = Math.hypot(Math.max(x, el.clientWidth - x), Math.max(y, el.clientHeight - y)) + 40;
          tl.set(panel, { yPercent: 0, autoAlpha: 1 }, 0)
            .set(bg, { autoAlpha: 1 }, 0)
            .fromTo(el, { clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${r}px at ${x}px ${y}px)`, duration: reduce ? 0.01 : 1.15, ease: "expo.inOut" }, 0)
            .fromTo(q(".vu-sheet-grooves"), { scale: 0.55, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 2.2 }, 0.1);
        } else {
          tl.set(el, { clipPath: "none" }, 0)
            .fromTo(bg, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 0)
            .fromTo(panel, { yPercent: 100, autoAlpha: 1 }, { yPercent: 0, duration: reduce ? 0.01 : 0.95 }, 0);
        }
        const at = wide ? 0.45 : 0.3;
        if (reduce) {
          tl.fromTo([...items, ...q(".vu-sheet-title"), ...q(".vu-track")], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, at);
        } else {
          // headings: word by word out of their lines
          const words: Element[] = [];
          for (const t of q(".vu-sheet-title")) {
            const s = new SplitText(t, { type: "lines,words", linesClass: "vu-sheet-line" });
            gsap.set(s.lines, { overflow: "hidden", paddingBottom: "0.1em", marginBottom: "-0.1em" });
            splits.current.push(s);
            words.push(...s.words);
          }
          tl.fromTo(q(".vu-rule"), { scaleX: 0 }, { scaleX: 1, duration: 1 }, at)
            .fromTo(items, { y: 22, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, stagger: 0.06 }, at + 0.05)
            .fromTo(words, { yPercent: 110 }, { yPercent: 0, duration: 1.1, stagger: 0.028 }, at + 0.1)
            .fromTo(q(".vu-spine-line"), { scale: 0 }, { scale: 1, duration: 1.4, ease: "expo.inOut" }, at)
            .fromTo(q(".vu-spine-disc"), { scale: 0.3, rotate: -120, autoAlpha: 0 }, { scale: 1, rotate: 0, autoAlpha: 1, duration: 1.4 }, at + 0.15)
            // the tracklist lays itself down row by row, each leader drawing to its dot
            .fromTo(q(".vu-track"), { x: 26, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.9, stagger: 0.08 }, at + 0.45)
            .fromTo(q(".vu-leader"), { scaleX: 0 }, { scaleX: 1, duration: 1.1, stagger: 0.08, ease: "expo.inOut" }, at + 0.55)
            .add(() => {
              splits.current.forEach((s) => s.revert());
              splits.current = [];
            });
        }
        tl.fromTo(closes, { autoAlpha: 0, y: -8 }, { autoAlpha: 1, y: 0, duration: 0.7 }, wide ? 0.75 : 0.4);
        return;
      }

      // nothing to hide before the first open
      if (getComputedStyle(el).display === "none") return;
      const tl = gsap.timeline({
        defaults: { ease: "expo.inOut", overwrite: "auto" },
        onComplete: () => gsap.set(el, { display: "none" }),
      });
      tl.to([...items, ...q(".vu-sheet-title"), ...q(".vu-track"), ...q(".vu-spine")], { autoAlpha: 0, y: -10, duration: 0.35, ease: "power2.in" }, 0).to(closes, { autoAlpha: 0, duration: 0.3 }, 0);
      if (wide) tl.to(el, { clipPath: `circle(0px at ${x}px ${y}px)`, duration: 0.8 }, 0.08);
      else tl.to(panel, { yPercent: 100, duration: 0.6 }, 0.05).to(bg, { autoAlpha: 0, duration: 0.45 }, 0.15);
      // put the faded rows back for the next open
      tl.set([...q(".vu-sheet-title"), ...q(".vu-spine")], { clearProps: "opacity,visibility,transform" });
    },
    { dependencies: [open], scope: root },
  );

  // a sheet opened by hovering the logo closes when the mouse leaves it (with a little grace)
  const pointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !viaHover.current) return;
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(onClose, 380);
  };
  const pointerEnter = () => window.clearTimeout(leaveTimer.current);

  const verse = content?.kind === "verse" ? content.verse : null;
  const tone = verse ?? "about";
  const label = verse ? `${VERSE_COPY[verse].kicker} — introduction` : "About AUVOX";

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      data-tone={tone}
      onPointerEnter={pointerEnter}
      onPointerLeave={pointerLeave}
      className="vu-sheet hidden text-ink max-md:fixed max-md:inset-0 max-md:z-[130] md:absolute md:inset-0 md:z-40"
    >
      {/* wide: a solid soft gradient, so nothing from the section shows through; phones: the backdrop (tap to close) */}
      <div className="vu-sheet-bg absolute inset-0 max-md:bg-ink/45" onClick={onClose} aria-hidden />
      <div className="vu-sheet-grooves pointer-events-none absolute inset-0 hidden md:block" aria-hidden />
      <div className="vu-sheet-tint pointer-events-none absolute inset-0 hidden md:block" aria-hidden />
      <div className="grain pointer-events-none absolute inset-0 hidden opacity-[0.05] mix-blend-multiply md:block" aria-hidden />

      {/* phones scroll the sheet itself; on wide screens the wheel still scrolls the page (which closes it) */}
      <div
        className="vu-sheet-panel pointer-events-none absolute max-md:pointer-events-auto max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[88svh] max-md:overflow-y-auto max-md:rounded-t-[1.75rem] max-md:bg-cream max-md:shadow-[0_-30px_80px_rgba(30,30,30,0.25)] md:inset-0 md:flex md:items-center md:overflow-y-auto"
        data-lenis-prevent-touch
      >
        <div className="vu-sheet-tint pointer-events-none absolute inset-0 md:hidden" aria-hidden />
        <div className="grain pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-multiply md:hidden" aria-hidden />
        <div className="pointer-events-auto relative mx-auto w-full max-w-[1440px] px-6 pt-7 pb-12 md:px-12 md:py-28">
          <span className="mx-auto mb-7 block h-1 w-10 rounded-full bg-ink/15 md:hidden" aria-hidden />
          <div className="mb-6 flex justify-end md:mb-14">
            <Close onClose={onClose} className="flex max-md:absolute max-md:top-4 max-md:right-5" />
          </div>

          {content?.kind === "about" && <About />}
          {verse && <VerseIntro verse={verse} onEnter={() => go(VERSE_HREF[verse])} />}

          {content?.kind === "about" && (
            <p className="vu-sheet-item mt-14 hidden items-center gap-3 text-[0.58rem] font-semibold tracking-[0.34em] text-ink/40 uppercase md:flex">
              <span className="block h-px w-8 bg-ink/25" aria-hidden />
              AUVOX Music · The Verse Universe · Liner notes
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
