"use client";

// The disc's overlays. One sheet, two kinds of content: "about" (hover/tap the centre logo) shows
// what AUVOX is and why; "verse" (click a verse node) shows that verse's intro with the way in.
// On wide screens it is a low-opacity gradient sheet that grows out of the disc over the section;
// on phones and tablets it is a bottom sheet that slides up.

import { useEffect, useRef, type RefObject } from "react";
import clsx from "clsx";
import { gsap, useGSAP } from "@/lib/gsap";
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

/** The client's T / L / S block, sized for the sheet. Each line is a `.vu-sheet-item` so it staggers in. */
function Block({
  kicker,
  title,
  accent,
  body,
  points,
  children,
}: {
  kicker: string;
  title: string;
  accent: string;
  body?: readonly string[];
  points?: readonly string[];
  children?: React.ReactNode;
}) {
  const head = title.endsWith(accent) ? title.slice(0, -accent.length) : title;
  return (
    <div className="max-w-[36rem]">
      <div className="vu-sheet-item flex items-center gap-4">
        <span className="block h-px w-10 bg-ink/50" />
        <span className="text-[0.65rem] font-medium tracking-[0.38em] text-ink/70 uppercase">{kicker}</span>
      </div>
      <h3 className="vu-sheet-item font-display mt-5 text-[clamp(1.9rem,3.4vw,3.4rem)] leading-[1.0] tracking-[-0.015em] text-ink">
        {head}
        <em className="not-italic text-red">{accent}</em>
      </h3>
      {body?.map((b, i) => (
        <p key={i} className={clsx("vu-sheet-item text-[1.05rem] leading-relaxed text-ink/75", i === 0 ? "mt-6" : "mt-3")}>
          {b}
        </p>
      ))}
      {points && (
        <ul className="mt-7 space-y-3">
          {points.map((p) => (
            <li key={p} className="vu-sheet-item flex items-center gap-4 text-[1.02rem] text-ink/85">
              <span className="block h-1.5 w-1.5 shrink-0 rounded-full bg-red" />
              {p}
            </li>
          ))}
        </ul>
      )}
      {children}
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
        "vu-sheet-close z-10 h-11 w-11 items-center justify-center rounded-full border border-ink/20 bg-cream text-ink transition-colors duration-300 hover:bg-ink hover:text-peach",
        className,
      )}
    >
      <span className="text-sm leading-none">✕</span>
    </button>
  );
}

export default function Sheet({ open, content, origin, viaHover, onClose }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef(0);
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
    return () => {
      window.clearTimeout(t.current);
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

      if (open) {
        // shown first, so the measurements below are real
        gsap.set(el, { display: "block" });
        const tl = gsap.timeline({ defaults: { ease: "expo.out", overwrite: "auto" } });
        if (wide) {
          // grows out of the disc (or the node that was clicked) until it covers the section
          const r = Math.hypot(Math.max(x, el.clientWidth - x), Math.max(y, el.clientHeight - y)) + 40;
          tl.set(panel, { yPercent: 0, autoAlpha: 1 }, 0)
            .set(bg, { autoAlpha: 1 }, 0)
            .fromTo(
              el,
              { clipPath: `circle(0px at ${x}px ${y}px)` },
              { clipPath: `circle(${r}px at ${x}px ${y}px)`, duration: reduce ? 0.01 : 1.1, ease: "expo.inOut" },
              0,
            );
        } else {
          tl.set(el, { clipPath: "none" }, 0)
            .fromTo(bg, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 0)
            .fromTo(panel, { yPercent: 100, autoAlpha: 1 }, { yPercent: 0, duration: reduce ? 0.01 : 0.95 }, 0);
        }
        tl.fromTo(items, { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, stagger: 0.07 }, wide ? 0.45 : 0.3).fromTo(
          closes,
          { autoAlpha: 0, scale: 0.6 },
          { autoAlpha: 1, scale: 1, duration: 0.6 },
          wide ? 0.7 : 0.4,
        );
        return;
      }

      // nothing to hide before the first open
      if (getComputedStyle(el).display === "none") return;
      const tl = gsap.timeline({
        defaults: { ease: "expo.inOut", overwrite: "auto" },
        onComplete: () => gsap.set(el, { display: "none" }),
      });
      tl.to(items, { autoAlpha: 0, y: -10, duration: 0.35, ease: "power2.in" }, 0).to(closes, { autoAlpha: 0, duration: 0.3 }, 0);
      if (wide) tl.to(el, { clipPath: `circle(0px at ${x}px ${y}px)`, duration: 0.75 }, 0.05);
      else tl.to(panel, { yPercent: 100, duration: 0.6 }, 0.05).to(bg, { autoAlpha: 0, duration: 0.45 }, 0.15);
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
      {/* wide: the low-opacity gradient sheet itself; phones: the backdrop (tap it to close) */}
      <div className="vu-sheet-bg absolute inset-0 max-md:bg-ink/45 md:bg-cream/82 md:backdrop-blur-[6px]" onClick={onClose} aria-hidden />
      <div className="vu-sheet-tint pointer-events-none absolute inset-0 hidden md:block" aria-hidden />
      <div className="grain pointer-events-none absolute inset-[-50%] hidden opacity-[0.04] mix-blend-multiply md:block" aria-hidden />
      <Close onClose={onClose} className="absolute top-6 right-6 hidden md:top-8 md:right-8 md:flex" />

      {/* phones scroll the sheet itself; on wide screens the wheel still scrolls the page (which closes it) */}
      <div
        className="vu-sheet-panel absolute max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[88svh] max-md:overflow-y-auto max-md:rounded-t-[1.75rem] max-md:bg-cream max-md:shadow-[0_-30px_80px_rgba(30,30,30,0.25)] md:inset-0 md:flex md:items-center md:overflow-y-auto"
        data-lenis-prevent-touch
      >
        <div className="vu-sheet-tint pointer-events-none absolute inset-0 md:hidden" aria-hidden />
        <div className="grain pointer-events-none absolute inset-[-50%] opacity-[0.04] mix-blend-multiply md:hidden" aria-hidden />
        <div className="relative mx-auto w-full max-w-[1440px] px-6 pt-7 pb-12 md:px-12 md:py-24">
          <span className="mx-auto mb-7 block h-1 w-10 rounded-full bg-ink/15 md:hidden" aria-hidden />
          <Close onClose={onClose} className="absolute top-4 right-5 flex md:hidden" />

          {content?.kind === "about" && (
            <div className="grid gap-12 md:grid-cols-2 md:gap-16 lg:gap-24">
              <Block kicker={ABOUT.what.kicker} title={ABOUT.what.title} accent={ABOUT.what.accent} body={ABOUT.what.body} />
              <Block kicker={ABOUT.why.kicker} title={ABOUT.why.title} accent={ABOUT.why.accent} points={ABOUT.why.points} />
            </div>
          )}

          {verse && (
            <div className="md:mx-auto md:max-w-[52rem]">
              <Block kicker={VERSE_COPY[verse].kicker} title={VERSE_COPY[verse].title} accent={VERSE_COPY[verse].accent} body={[VERSE_COPY[verse].body]} points={VERSE_COPY[verse].points}>
                <div className="vu-sheet-item mt-10">
                  <Button variant="red" onClick={() => go(VERSE_HREF[verse])}>
                    Enter the verse
                  </Button>
                </div>
              </Block>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
