"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { usePreloaderStore } from "@/store/preloader";
import ChatOverlay from "./ChatOverlay";
import { isMuted, useMuted, setMuted, unlockAudio } from "./audio";
import { requestAutoPlay, session } from "./state";

const Studio = dynamic(() => import("./PhotoStudio"), { ssr: false });

/**
 * Section 2 — "The Session". Lights come up on the studio, the guitar is playable,
 * tapping the phone opens the conversation beside him. On scroll the studio holds still (pinned) and
 * the hero slides up over it like a sheet, while the studio recedes and darkens underneath.
 */
export default function Session() {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const shade = useRef<HTMLDivElement>(null);
  const tapHint = useRef<HTMLDivElement>(null);
  const phoneHint = useRef<HTMLButtonElement>(null);
  const sign = useRef<HTMLDivElement>(null);
  const held = useRef<{ x: number; y: number } | null>(null);
  const done = usePreloaderStore((s) => s.done);
  const muted = useMuted();

  useGSAP(
    () => {
      // The studio stays put while the hero slides over it (pinSpacing off, so the hero overlaps it);
      // progress still tracks the hand-over and drives the hints and the reverse portal.
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // `session` outlives this component: coming back to the home page must not inherit the last
      // visit's scroll progress (it would read as "covered" and pause the scene) or its open
      // conversation (camera still leaning into the phone, the phone's TAP hint gone)
      gsap.killTweensOf(session, "focus");
      session.progress = 0;
      session.focus = 0;
      session.autoPlay = false;
      session.phoneHint = 1;
      const st = ScrollTrigger.create({
        trigger: root.current,
        start: "top top",
        end: "bottom top",
        pin: true,
        pinSpacing: false,
        onUpdate: (self) => {
          session.progress = self.progress;
          // fully under the hero: stop compositing it (it is still in the viewport behind the sheet)
          const el = root.current;
          if (el) el.style.visibility = self.progress >= 0.999 ? "hidden" : "";
        },
      });
      // underneath the incoming sheet the studio recedes a little and dims
      const recede = gsap
        .timeline({ scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true } })
        .fromTo(stage.current, { scale: 1, yPercent: 0 }, { scale: reduce ? 1 : 0.92, yPercent: reduce ? 0 : -3, ease: "none" }, 0)
        .fromTo(shade.current, { opacity: 0 }, { opacity: 0.7, ease: "none" }, 0);
      const onMove = (e: PointerEvent) => {
        session.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        session.mouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
      };
      window.addEventListener("pointermove", onMove);
      // pin geometry goes stale when the window changes shape — refresh once the resize settles
      let resizeTimer = 0;
      const onResize = () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => ScrollTrigger.refresh(), 150);
      };
      window.addEventListener("resize", onResize);
      const tick = () => {
        if (phoneHint.current) {
          // Hold still once the pointer is close: the room's pan must not move the target away from the hand.
          const { x, y } = session.phoneScreen;
          const px = (session.mouse.x + 1) * 0.5 * window.innerWidth;
          const py = (1 - session.mouse.y) * 0.5 * window.innerHeight;
          const near = Math.hypot(px - x, py - y) < 140;
          const h = held.current ?? (held.current = { x, y });
          // far from the target, or the pointer away: track exactly. Pointer near: ease, so it never dodges.
          if (!near || Math.hypot(h.x - x, h.y - y) > 60) {
            h.x = x;
            h.y = y;
          } else {
            h.x += (x - h.x) * 0.04;
            h.y += (y - h.y) * 0.04;
          }
          phoneHint.current.style.transform = `translate(${h.x}px, ${h.y}px) translate(-50%, -50%)`;
          const painted = gsap.utils.clamp(0, 1, (session.reveal - 0.75) / 0.25);
          const show = session.phoneHint * painted * (1 - gsap.utils.clamp(0, 1, session.progress / 0.12));
          phoneHint.current.style.opacity = String(show);
          phoneHint.current.style.pointerEvents = show > 0.5 ? "auto" : "none";
        }
        if (tapHint.current) {
          const h = session.hintScreen;
          tapHint.current.style.transform = `translate(${h.x}px, ${h.y}px) translate(-50%, -50%)`;
          // step aside while the conversation is open — it sits behind the bubbles
          tapHint.current.style.opacity = String(h.opacity * (1 - session.focus));
        }
      };
      const gated = () => {
        if (session.progress < 1) tick();
      };
      gsap.ticker.add(gated);
      return () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("resize", onResize);
        window.clearTimeout(resizeTimer);
        gsap.ticker.remove(gated);
        recede.scrollTrigger?.kill();
        recede.kill();
        st.kill();
      };
    },
    { scope: root },
  );

  // The sign: AUVOX MUSIC in cream, in screen space (globals.css .session-sign) so it is never cropped by
  // the photo's cover fit — wide laptop screens cut it at the top, phones lost it entirely. It fades
  // in as the preloader's logo lands on it and leans a little against the pointer, like the room.
  useEffect(() => {
    const el = sign.current;
    if (!el) return;
    const tick = () => {
      if (session.progress >= 1) return;
      el.style.opacity = String(session.sign);
      el.style.transform = `translate3d(${(-session.mouse.x * 6).toFixed(2)}px, ${(session.mouse.y * 4).toFixed(2)}px, 0)`;
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);

  // The preloader's logo has just landed on the wall: the sign takes over under it, then the ink wipe
  // paints the sketched studio in from the right, the LEDs bloom as it lands, and the hints follow.
  useEffect(() => {
    if (!done) return;
    gsap.set(session.lights, { red: 1, lamp: 1, ambient: 1 });
    const tl = gsap.timeline({ delay: 0.05 });
    tl.fromTo(session, { sign: 0 }, { sign: 1, duration: 0.4, ease: "power1.inOut" }, 0)
      // the portal opens out of the phone the moment the logo lands — no hold, one continuous move
      .to(session, { reveal: 1, duration: 3.4, ease: "power2.inOut" }, 0)
      .to(session, { bloom: 1, duration: 0.4, ease: "power2.out" }, 3.0)
      .to(session, { bloom: 0, duration: 1.1, ease: "power2.inOut" })
      .fromTo(session, { guitarHintIn: 0 }, { guitarHintIn: 1, duration: 0.8, ease: "power2.out" }, 4.4);
    return () => {
      tl.kill();
    };
  }, [done]);

  // Tapping the phone opens the conversation right here, with a gentle lean towards the phone.
  const tapPhone = () => {
    unlockAudio();
    requestAutoPlay();
    gsap.to(session, { focus: 1, duration: 1.4, ease: "power3.out" });
  };

  const toggleSound = () => {
    unlockAudio();
    setMuted(!isMuted());
  };

  return (
    <section ref={root} data-theme="dark" className="session relative z-0 h-[100svh] w-full overflow-clip bg-black text-pearl">
      <div ref={stage} className="absolute inset-0 origin-[50%_35%] will-change-transform">
      <Studio />

      {/* the sign: the preloader's logo lands here and becomes it */}
      <div ref={sign} className="session-sign pointer-events-none absolute z-[5]" style={{ opacity: 0 }} aria-hidden>
        <span className="session-sign-mark block h-full w-full" />
      </div>

      <div
        ref={tapHint}
        className="tap-ring pointer-events-none absolute top-0 left-0 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-tan bg-black/40 text-tan backdrop-blur-sm"
        style={{ opacity: 0 }}
      >
        <span className="text-[9px] font-semibold tracking-[0.3em]">TAP</span>
      </div>

      <button
        ref={phoneHint}
        onClick={tapPhone}
        aria-label="Open the conversation on the phone"
        className="group absolute top-0 left-0 z-10 flex h-20 w-20 items-center justify-center rounded-full"
        style={{ opacity: 0, pointerEvents: "none" }}
      >
        <span className="tap-ring relative flex h-12 w-12 items-center justify-center rounded-full border border-tan bg-red text-pearl shadow-[0_0_30px_rgba(133,9,9,0.55)] transition-transform duration-200 group-hover:scale-110">
          <span className="text-[9px] font-semibold tracking-[0.3em]">TAP</span>
        </span>
      </button>

      <button
        onClick={toggleSound}
        className="absolute right-8 bottom-8 z-30 flex items-center gap-2 text-[0.65rem] tracking-[0.35em] uppercase text-tan/70 transition hover:text-tan"
      >
        <span className={`block h-1.5 w-1.5 rounded-full ${muted ? "bg-tan/30" : "bg-tan"}`} />
        Sound {muted ? "off" : "on"}
      </button>

      <ChatOverlay />
      </div>
      {/* dims the studio as the hero sheet covers it */}
      <div ref={shade} className="pointer-events-none absolute inset-0 z-40 bg-black opacity-0" />
    </section>
  );
}
