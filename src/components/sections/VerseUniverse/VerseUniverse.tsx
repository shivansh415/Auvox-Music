"use client";

// Section 4 — The Verse Universe. The client's T/L/S copy beside THE MUSIC DISC, built as a turntable
// you can play:
//   · scrolling in, the record rises from low and far to face-on with the guitar and keyboard already
//     on it; the grooves are cut outward from the label; the tonearm swings over and drops the needle
//     (thump, crackle) and the platter spins up
//   · grab it (mouse or a sideways swipe) and spin it — it has inertia, it scratches, it eases back
//   · whichever verse passes under the needle is "now spinning": you hear it (a guitar arpeggio, a
//     piano chord) and its wave runs out through the grooves
//   · hover / tap the logo for what AUVOX is; click a verse and the arm lifts, the record winds down,
//     the camera dives toward it and the intro opens over a low-opacity gradient (client brief)

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { afterGate, expectReady } from "@/store/preloader";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import SectionHead from "@/components/ui/SectionHead";
import type { Verse } from "@/content/packages";
import { isMuted, useMuted, playChord, pluck, setMuted, unlockAudio } from "@/components/sections/Session/audio";
import { useTransition } from "@/store/transition";
import Sheet, { type SheetContent } from "./Sheet";
import { armLift, needleDrop, setCrackle, setScratch } from "./sound";
import {
  DEG,
  NEEDLE_DEG,
  NODES,
  NODE_BY_KEY,
  ORBIT,
  PLATE_R,
  SCRUB_DEGREES,
  SPIN_SPEED,
  TAG_OFFSET,
  TONE,
  disc,
  discAngle,
  emitNowSpinning,
  nodePoint,
  onNowSpinning,
  ripple,
  resetDisc,
  setDragging,
  setFocus,
  setHover,
  stylusPoint,
  turnBy,
  type NodeKey,
} from "./state";

const DiscWorld = dynamic(() => import("./DiscWorld"), { ssr: false });

// Client copy, verbatim.
const COPY = {
  kicker: "The Verse Universe",
  title: "Every instrument has a voice waiting to be found.",
  accent: "found.",
  body: ["The Verse Universe is a growing world of music where every voice is trained, shaped, and set free.", "One world. Many instruments. One standard of mastery."],
} as const;

/** -180..180 */
const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

// ---- each verse's voice when it passes under the needle (or the pointer finds it)
const PIANO_ROOTS = [261.63, 233.08, 293.66];
const lastVoice: Partial<Record<NodeKey, number>> = {};
function voice(key: NodeKey, velocity = 1) {
  const now = performance.now();
  if (now - (lastVoice[key] ?? 0) < 900) return;
  lastVoice[key] = now;
  if (key === "guitar") [0, 2, 3, 4, 5].forEach((s, i) => window.setTimeout(() => pluck(s, velocity * (0.9 - i * 0.08)), i * 65));
  else if (key === "piano") playChord(PIANO_ROOTS[(Math.random() * PIANO_ROOTS.length) | 0], velocity * 0.9);
}

/** a verse reaches the needle: say so, sound it, send its wave through the grooves */
function passed(key: NodeKey) {
  emitNowSpinning(key);
  const p = nodePoint(key);
  const n = NODE_BY_KEY[key];
  ripple(p.x, p.y, TONE[key], n.active ? 1 : 0.45);
  if (n.active) voice(key, disc.dragging ? 0.7 : 1);
}

// ---- the tonearm
function landed() {
  disc.needleDown = true;
  needleDrop();
  const s = stylusPoint();
  ripple(s.x, s.y, TONE.needle, 1.6);
  gsap.to(disc, { motor: 1, duration: 2.2, ease: "power2.inOut", overwrite: "auto" });
  // whatever sits nearest the needle is what's playing
  let best: NodeKey = NODES[0].key;
  let bestD = 999;
  for (const n of NODES) {
    const d = Math.abs(wrap(discAngle() + n.angle - NEEDLE_DEG));
    if (d < bestD) {
      bestD = d;
      best = n.key;
    }
  }
  emitNowSpinning(best);
  document.getElementById("verse-universe")?.setAttribute("data-hint", "1");
}
function lowerNeedle(delay = 0) {
  if (disc.still) {
    disc.arm.swing = 1;
    disc.arm.lift = 0;
    landed();
    return;
  }
  gsap
    .timeline({ delay })
    .to(disc.arm, { swing: 1, duration: disc.arm.swing > 0.99 ? 0.01 : 1.4, ease: "power3.inOut", overwrite: "auto" })
    .to(disc.arm, { lift: 0, duration: 0.55, ease: "power2.in", overwrite: "auto", onComplete: landed });
}
function raiseNeedle() {
  if (disc.needleDown) armLift();
  disc.needleDown = false;
  gsap.to(disc.arm, { lift: 1, duration: 0.45, ease: "power2.out", overwrite: "auto" });
  gsap.to(disc, { motor: 0, duration: 1.8, ease: "power2.out", overwrite: "auto" });
}

const VERSE_HREF: Record<Verse, string> = { guitar: "/guitar-verse", piano: "/piano-verse" };

export default function VerseUniverse() {
  const root = useRef<HTMLElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const origin = useRef({ x: 0, y: 0 });
  const viaHover = useRef(false);
  const isOpen = useRef<SheetContent["kind"] | null>(null);
  /** true for a moment after a sheet closes, so the mouse still sitting on the logo doesn't reopen it */
  const cooling = useRef(false);
  /** true for a moment after a drag, so letting go over a verse doesn't open it */
  const dragged = useRef(false);
  const drag = useRef({ id: -1, active: false, x: 0, y: 0, last: 0, t: 0 });
  /** a verse was clicked and the page is on its way, so a second click does nothing */
  const leaving = useRef(false);
  const go = useTransition();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<SheetContent | null>(null);
  const [now, setNow] = useState<NodeKey | null>(null);
  const muted = useMuted();

  useEffect(() => onNowSpinning(setNow), []);

  // ---- the dive: the stage zooms toward what was opened while the sheet grows over it
  const dive = (el: HTMLElement, depth: number) => {
    const st = stage.current;
    if (!st || disc.still) return;
    const sr = st.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const ox = ((r.left + r.width / 2 - sr.left) / sr.width) * 100;
    const oy = ((r.top + r.height / 2 - sr.top) / sr.height) * 100;
    gsap.to(st, { scale: depth, transformOrigin: `${ox}% ${oy}%`, duration: 1.4, ease: "expo.inOut", overwrite: "auto" });
  };
  const undive = () => {
    if (stage.current) gsap.to(stage.current, { scale: 1, duration: 1.1, ease: "expo.inOut", overwrite: "auto" });
  };

  /** remember where a sheet should grow from: the centre of `el`, in section pixels */
  const place = (el: HTMLElement) => {
    const s = root.current?.getBoundingClientRect();
    if (!s) return;
    const r = el.getBoundingClientRect();
    origin.current = { x: r.left + r.width / 2 - s.left, y: r.top + r.height / 2 - s.top };
  };
  const close = () => {
    if (!isOpen.current) return;
    isOpen.current = null;
    cooling.current = true;
    window.setTimeout(() => {
      cooling.current = false;
    }, 700);
    setOpen(false);
    setFocus(null);
    undive();
    if (disc.needleDown) {
      gsap.to(disc, { motor: 1, duration: 1.6, ease: "power2.inOut", overwrite: "auto" });
    }
  };
  const openAbout = (el: HTMLElement, hover: boolean) => {
    // a sheet that just closed shouldn't pop straight back open because the mouse is still on the logo
    if (hover && cooling.current) return;
    if (dragged.current || isOpen.current) return;
    place(el);
    viaHover.current = hover;
    isOpen.current = "about";
    setContent({ kind: "about" });
    setOpen(true);
    ripple(0, 0, TONE.piano, 1.2);
    dive(el, 1.12);
    // the record slows to a crawl while you read
    gsap.to(disc, { motor: 0.25, duration: 1.4, ease: "power2.out", overwrite: "auto" });
  };
  // a verse goes straight to its page (the verse, its packages and the comparison): a moment of
  // feedback on the record (its voice, a ripple, the arm lifting, a lean in), then the page curtain
  const openVerse = (verse: Verse, el: HTMLElement) => {
    if (dragged.current || leaving.current) return;
    leaving.current = true;
    window.setTimeout(() => {
      leaving.current = false;
    }, 2000);
    setHover(null);
    setFocus(verse);
    voice(verse, 1);
    const p = nodePoint(verse);
    ripple(p.x, p.y, TONE[verse], 1.4);
    if (disc.needleDown) raiseNeedle();
    dive(el, 1.45);
    window.setTimeout(() => go(VERSE_HREF[verse]), 260);
  };

  const over = (key: NodeKey) => {
    if (disc.hover === key || disc.dragging) return;
    setHover(key);
    if (NODE_BY_KEY[key].active) {
      voice(key, 0.75);
      const p = nodePoint(key);
      ripple(p.x, p.y, TONE[key], 0.8);
    }
  };
  const out = () => setHover(null);

  const toggleSound = () => {
    unlockAudio();
    setMuted(!isMuted());
  };

  // ---- grab and spin. A press only becomes a drag once it moves, so taps still reach the verses.
  const centre = () => {
    const b = box.current;
    if (!b) return null;
    const r = b.getBoundingClientRect();
    const k = r.width / (b.clientWidth || 1);
    const c = disc.anchors.core;
    return { x: r.left + (c.on ? c.x : b.clientWidth / 2) * k, y: r.top + (c.on ? c.y : b.clientHeight / 2) * k, w: r.width };
  };
  const toRecord = (x: number, y: number) => {
    const c = centre();
    if (!c) return { x: 0, y: 0 };
    const rad = PLATE_R * c.w;
    return { x: (x - c.x) / rad, y: -(y - c.y) / rad };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || isOpen.current) return;
    if ((e.target as HTMLElement).closest(".vu-core")) return;
    const c = centre();
    if (!c) return;
    const dx = e.clientX - c.x;
    const dy = e.clientY - c.y;
    if (Math.hypot(dx, dy) > PLATE_R * c.w * 1.04) return;
    drag.current = { id: e.pointerId, active: false, x: e.clientX, y: e.clientY, last: Math.atan2(dy, dx) / DEG, t: e.timeStamp };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d.id !== e.pointerId) return;
    if (!d.active) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
      d.active = true;
      setDragging(true);
      setHover(null);
      box.current?.setPointerCapture(e.pointerId);
      if (root.current) {
        root.current.dataset.dragging = "1";
        root.current.dataset.hint = "0";
      }
    }
    const c = centre();
    if (!c) return;
    const ang = Math.atan2(e.clientY - c.y, e.clientX - c.x) / DEG;
    const delta = wrap(ang - d.last);
    const dt = Math.max(4, e.timeStamp - d.t) / 1000;
    turnBy(delta, dt);
    d.last = ang;
    d.t = e.timeStamp;
  };
  const endDrag = (e: React.PointerEvent, tap: boolean) => {
    const d = drag.current;
    if (d.id !== e.pointerId) return;
    d.id = -1;
    const p = toRecord(e.clientX, e.clientY);
    if (d.active) {
      d.active = false;
      setDragging(false);
      if (box.current?.hasPointerCapture(e.pointerId)) box.current.releasePointerCapture(e.pointerId);
      if (root.current) root.current.dataset.dragging = "";
      dragged.current = true;
      window.setTimeout(() => {
        dragged.current = false;
      }, 60);
      ripple(p.x, p.y, TONE.needle, Math.min(1.4, 0.5 + Math.abs(disc.vel) / 600));
    } else if (tap && (e.target as HTMLElement).classList.contains("vu-drag")) {
      // a touch on bare vinyl: the grooves answer
      ripple(p.x, p.y, TONE.needle, 0.9);
    }
  };

  useGSAP(
    () => {
      const el = root.current;
      const b = box.current;
      if (!el || !b) return;
      const q = gsap.utils.selector(el);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // a fresh turntable every time the section mounts (the state outlives route changes)
      resetDisc(reduce);
      // and an unzoomed stage: a verse click leans in (scale 1.45) and leaves for its page, and when
      // the visitor comes back with Back, Next restores this same DOM with the zoom still on it
      if (stage.current) {
        gsap.killTweensOf(stage.current);
        gsap.set(stage.current, { scale: 1 });
      }
      leaving.current = false;

      // --- near the viewport: mount the canvas, and run the loops only while we are around
      const io = new IntersectionObserver(
        ([entry]) => {
          disc.inView = entry.isIntersecting;
          if (entry.isIntersecting) setReady(true);
        },
        { rootMargin: "-2px 0px" },
      );
      io.observe(el);
      // mount the canvas early, while the browser is idle, so its models and shaders are ready
      // before the visitor scrolls here (mounting on arrival froze the scroll for ~0.5s)
      // (once the preloader's lockup is still: it warms there, see Prewarm, before the Enter button shows)
      expectReady("disc");
      const cancelIdle = afterGate(() => setReady(true));

      // --- the scroll-in: the record rises from low and far to face-on (scrubbed, no pin)
      const tilt = reduce
        ? null
        : gsap.fromTo(disc, { tilt: 0 }, { tilt: 1, ease: "none", scrollTrigger: { trigger: b, start: "top bottom", end: "center 58%", scrub: 0.8 } });

      // --- then, once: the grooves are cut, the verses land, the needle drops
      gsap.set(q(".vu-rise"), { autoAlpha: 0 });
      gsap.to(q(".vu-rise"), { autoAlpha: 1, duration: 1.2, ease: "power2.out", scrollTrigger: { trigger: b, start: "top 95%", once: true } });
      const intro = gsap
        .timeline({ scrollTrigger: { trigger: b, start: "top 62%", once: true }, defaults: { ease: "expo.out" } })
        .to(disc, { enter: 1, duration: 1.6 }, 0)
        .to(disc, { reveal: 1, duration: reduce ? 0.01 : 2.4, ease: "expo.inOut" }, 0.1)
        .fromTo(q(".vu-tag"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.9, stagger: 0.09 }, 0.8)
        .fromTo(q(".vu-foot"), { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.1 }, 1.0)
        .add(() => lowerNeedle(), reduce ? 0 : 1.1);

      // --- scroll turns the record a little further on top of the motor
      const scrub = reduce
        ? null
        : gsap.to(disc, { scrub: SCRUB_DEGREES, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 1 } });
      // scrolling clean past the section closes whatever is open
      const leave = ScrollTrigger.create({ trigger: el, start: "top bottom", end: "bottom top", onLeave: close, onLeaveBack: close });

      // --- the pointer leans the record and steers the light (mouse only)
      const onMove = (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        const r = b.getBoundingClientRect();
        const s = el.getBoundingClientRect();
        disc.pointer.x = (e.clientX - (r.left + r.width / 2)) / r.width;
        disc.pointer.y = (e.clientY - (r.top + r.height / 2)) / r.height;
        disc.pointer.on = e.clientY >= s.top && e.clientY <= s.bottom && !isOpen.current;
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      // --- the ticker: the platter's physics, the needle, the sounds, and the DOM glued to the 3D
      let size = b.clientWidth;
      const ro = new ResizeObserver(() => {
        size = b.clientWidth;
      });
      ro.observe(b);
      const eq = q<HTMLElement>(".vu-eq-bar");
      const core = q<HTMLElement>(".vu-core")[0];
      const nodes = NODES.map((n) => ({
        n,
        el: q<HTMLElement>(`.vu-node[data-node="${n.key}"]`)[0],
        tag: q<HTMLElement>(`.vu-tag[data-node="${n.key}"]`)[0],
        hovered: "",
        prev: NaN,
      }));
      let gl = false;
      const tick = (time: number, dtMs: number) => {
        if (!disc.inView || !size) {
          setCrackle(false);
          setScratch(0);
          return;
        }
        const dt = Math.min(dtMs, 50) / 1000;
        if (!gl && disc.gl) {
          gl = true;
          el.dataset.gl = "1";
        }

        // platter: a motor with inertia; while held, the hand sets the speed (and a still hand stops it)
        const target = disc.still ? 0 : disc.motor * SPIN_SPEED;
        if (disc.dragging) disc.vel *= Math.exp(-dt * 7);
        else {
          disc.vel += (target - disc.vel) * (1 - Math.exp(-dt * 1.5));
          disc.spin += disc.vel * dt;
        }
        setScratch(disc.needleDown ? Math.abs(disc.vel - (disc.dragging ? 0 : target)) : 0);
        setCrackle(disc.needleDown);

        // forget waves that have run out
        const nowS = performance.now() / 1000;
        while (disc.ripples.length && nowS - disc.ripples[0].t0 > 3.2) disc.ripples.shift();

        const a = discAngle();
        const half = size / 2;
        for (const node of nodes) {
          const { n, el: nodeEl, tag } = node;
          // the needle: a verse crossing its angle, either way round
          const d = wrap(a + n.angle - NEEDLE_DEG);
          if (disc.needleDown && !Number.isNaN(node.prev) && Math.abs(d - node.prev) < 90 && ((node.prev < 0 && d >= 0) || (node.prev > 0 && d <= 0))) passed(n.key);
          node.prev = d;

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
          nodeEl.style.transform = `translate(${x}px, ${y}px)`;
          // the label sits just outside its node, on the side away from the centre
          const c = disc.anchors.core;
          const dx = x - (c.on ? c.x : half);
          const dy = y - (c.on ? c.y : half);
          const len = Math.hypot(dx, dy) || 1;
          const off = size * TAG_OFFSET;
          tag.style.transform = `translate(${(dx / len) * off}px, ${(dy / len) * off}px) translate(-50%, -50%)`;
          const h = disc.hover === n.key ? "1" : "0";
          if (node.hovered !== h) {
            node.hovered = h;
            nodeEl.dataset.hover = h;
          }
        }
        const c = disc.anchors.core;
        core.style.transform = `translate(${c.on ? c.x : half}px, ${c.on ? c.y : half}px) translate(-50%, -50%)`;

        // the little equaliser beside "now spinning": the real audio level, or the motor when silent
        for (let i = 0; i < eq.length; i++) {
          const wob = Math.abs(Math.sin(time * (3.1 + i * 1.7) + i * 1.3));
          const v = 0.18 + Math.min(1, disc.level * 2.2) * 0.8 * wob + disc.motor * (disc.needleDown ? 0.22 : 0) * wob;
          eq[i].style.transform = `scaleY(${Math.min(1, v).toFixed(3)})`;
        }
      };
      gsap.ticker.add(tick);

      return () => {
        io.disconnect();
        cancelIdle();
        ro.disconnect();
        gsap.ticker.remove(tick);
        window.removeEventListener("pointermove", onMove);
        tilt?.scrollTrigger?.kill();
        scrub?.scrollTrigger?.kill();
        intro.scrollTrigger?.kill();
        leave.kill();
        // the arm moves on timelines started from callbacks (outside this context): stop them, so a
        // needle that was on its way down doesn't land (and crackle) on the next page
        gsap.killTweensOf(disc.arm);
        setCrackle(false);
        setScratch(0);
        disc.inView = false;
      };
    },
    { scope: root },
  );

  const nowNode = now ? NODE_BY_KEY[now] : null;

  return (
    <section ref={root} id="verse-universe" data-gl="0" data-hint="0" className="vu relative overflow-clip bg-cream text-ink">
      {/* its foot is already the Journey's peach, so the two run on without a join (under the grain, like the Journey's) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-b from-transparent to-peach" />
      <div className="grain pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-multiply" />
      {/* a soft pool of peach behind the disc, a whisper of tan at the foot */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_55%_at_72%_50%,rgba(250,227,197,0.95),transparent_72%),linear-gradient(180deg,transparent_60%,rgba(231,180,126,0.18))]" />

      <div className="relative mx-auto max-w-[1440px] px-6 pt-24 pb-16 md:px-12 md:pt-36 md:pb-20">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
          {/* copy */}
          <SectionHead kicker={COPY.kicker} title={COPY.title} accent={COPY.accent} body={COPY.body} className="lg:max-w-[34rem]" />

          {/* THE MUSIC DISC */}
          <div>
            <div
              ref={box}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={(e) => endDrag(e, true)}
              onPointerCancel={(e) => endDrag(e, false)}
              className="vu-box @container relative mx-auto aspect-square w-full min-w-[min(300px,100%)] max-w-[720px]"
            >
              <div ref={stage} className="vu-stage absolute inset-0">
                <div className="vu-rise absolute inset-0">
                  {/* stand-in record: shows until the 3D record has drawn (and stays if it never can) */}
                  <div className="vu-standin pointer-events-none absolute inset-[2%] overflow-hidden rounded-full bg-ink shadow-[0_50px_100px_-30px_rgba(30,30,30,0.55)]" aria-hidden>
                    <div className="vu-grooves absolute inset-0 rounded-full" />
                    <div className="vu-tracks absolute inset-0 rounded-full" />
                    <div className="absolute inset-[37%] rounded-full bg-[radial-gradient(circle_at_40%_36%,#fae3c5,#e7b47e_65%,#deb886)]" />
                  </div>

                  {ready && <DiscWorld />}

                  {/* the vinyl you can grab */}
                  <div className="vu-drag absolute inset-[2%] z-[15] rounded-full" aria-hidden />

                  {/* the nodes: hit areas and labels (over the instruments) */}
                  <div className="pointer-events-none absolute inset-0 z-20">
                    {NODES.map((n) =>
                      n.active ? (
                        <button
                          key={n.key}
                          type="button"
                          data-node={n.key}
                          aria-label={`Open ${n.label}`}
                          aria-haspopup="dialog"
                          onPointerEnter={() => over(n.key)}
                          onPointerLeave={out}
                          onFocus={() => setHover(n.key)}
                          onBlur={out}
                          onClick={(e) => openVerse(n.key, e.currentTarget)}
                          className="vu-node pointer-events-auto absolute top-0 left-0 -mt-[10.5%] -ml-[10.5%] h-[21%] w-[21%] rounded-full"
                        >
                          <span data-node={n.key} className="vu-tag vu-tag-solid absolute top-1/2 left-1/2 rounded-full bg-peach px-3.5 py-1.5 text-[0.58rem] font-semibold tracking-[0.28em] whitespace-nowrap text-ink uppercase shadow-[0_6px_20px_rgba(30,30,30,0.35)]">
                            {n.label}
                          </span>
                        </button>
                      ) : null,
                    )}
                  </div>

                  {/* the logomark on the label (drawn in 3D): hover (mouse) or tap for what AUVOX is */}
                  <button
                    type="button"
                    aria-label="What is AUVOX"
                    aria-haspopup="dialog"
                    onPointerEnter={(e) => {
                      if (e.pointerType !== "mouse") return;
                      setHover("core");
                      openAbout(e.currentTarget, true);
                    }}
                    onPointerLeave={() => {
                      if (disc.hover === "core") setHover(null);
                    }}
                    onFocus={() => setHover("core")}
                    onBlur={() => {
                      if (disc.hover === "core") setHover(null);
                    }}
                    onClick={(e) => openAbout(e.currentTarget, false)}
                    className="vu-core absolute top-0 left-0 z-30 flex h-[24%] w-[24%] items-center justify-center rounded-full"
                  >
                    <span className="pointer-events-none absolute -top-1 -right-2 hidden text-ink pointer-coarse:flex" aria-hidden>
                      <span className="tap-ring relative flex h-11 w-11 items-center justify-center rounded-full border border-current bg-cream/90">
                        <span className="text-[9px] font-semibold tracking-[0.3em]">TAP</span>
                      </span>
                    </span>
                  </button>

                  {/* once the needle is down: you can play it */}
                  <div className="vu-hint pointer-events-none absolute bottom-[-1%] left-1/2 z-20 flex -translate-x-1/2 items-center gap-2.5 text-[0.56rem] font-semibold tracking-[0.32em] whitespace-nowrap text-ink/60 uppercase" aria-hidden>
                    <svg viewBox="0 0 24 24" className="vu-hint-arrow h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <path d="M4 12a8 8 0 0 1 14.5-4.7" strokeLinecap="round" />
                      <path d="M19 3v4.5h-4.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M20 12a8 8 0 0 1-14.5 4.7" strokeLinecap="round" />
                      <path d="M5 21v-4.5h4.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="pointer-coarse:hidden">Grab the record</span>
                    <span className="hidden pointer-coarse:inline">Swipe the record</span>
                  </div>
                </div>
              </div>
            </div>

            {/* now spinning · legend · sound */}
            <div className="vu-foot mt-9 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 text-[0.6rem] font-semibold tracking-[0.3em] text-ink/65 uppercase">
              <span className="flex min-h-5 items-center gap-3.5">
                <span className="flex h-4 items-end gap-[3px]" aria-hidden>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className="vu-eq-bar block h-full w-[2px] origin-bottom rounded-full bg-red" style={{ transform: "scaleY(0.18)" }} />
                  ))}
                </span>
                {nowNode ? (
                  <span key={nowNode.key} className="vu-now flex items-center gap-2.5">
                    <span className="text-ink/45">Now spinning</span>
                    <span className="text-ink">{nowNode.label}</span>
                  </span>
                ) : (
                  <span>Choose your verse</span>
                )}
              </span>
              <span className="flex flex-wrap items-center gap-5">
                <button
                  type="button"
                  onClick={toggleSound}
                  aria-pressed={!muted}
                  className="flex items-center gap-2 rounded-full border border-ink/20 px-3 py-1.5 transition-colors duration-300 hover:border-ink hover:text-ink"
                >
                  <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
                    <path d="M2 6h2.5L8 3v10L4.5 10H2z" strokeLinejoin="round" />
                    {muted ? <path d="M11 6l3.5 4M14.5 6L11 10" strokeLinecap="round" /> : <path d="M10.8 5.5a3.5 3.5 0 0 1 0 5M12.6 3.8a6 6 0 0 1 0 8.4" strokeLinecap="round" />}
                  </svg>
                  Sound {muted ? "off" : "on"}
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={open} content={content} origin={origin} viaHover={viaHover} onClose={close} />
    </section>
  );
}
