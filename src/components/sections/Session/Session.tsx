"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { usePreloaderStore } from "@/store/preloader";
import ChatOverlay from "./ChatOverlay";
import { isMuted, setMuted, unlockAudio } from "./audio";
import { requestAutoPlay, session } from "./state";

const Studio = dynamic(() => import("./PhotoStudio"), { ssr: false });

/**
 * Section 2 — "The Session". One continuous shot: lights come up on the studio,
 * the guitar is playable, scrolling pushes the camera into the phone, the chat plays there.
 */
export default function Session() {
  const root = useRef<HTMLElement>(null);
  const scrollHint = useRef<HTMLDivElement>(null);
  const tapHint = useRef<HTMLDivElement>(null);
  const phoneHint = useRef<HTMLButtonElement>(null);
  const done = usePreloaderStore((s) => s.done);
  const [muted, setMutedState] = useState(false);

  useGSAP(
    () => {
      const st = ScrollTrigger.create({
        trigger: root.current,
        start: "top top",
        end: "+=170%",
        pin: true,
        scrub: true,
        onUpdate: (self) => {
          session.progress = self.progress;
        },
      });
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
          const { x, y } = session.phoneScreen;
          phoneHint.current.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
          const show = session.phoneHint * session.lights.lamp * (1 - gsap.utils.clamp(0, 1, session.progress / 0.12));
          phoneHint.current.style.opacity = String(show);
          phoneHint.current.style.pointerEvents = show > 0.5 ? "auto" : "none";
        }
        if (tapHint.current) {
          const h = session.hintScreen;
          tapHint.current.style.transform = `translate(${h.x}px, ${h.y}px) translate(-50%, -50%)`;
          tapHint.current.style.opacity = String(h.opacity);
        }
        if (scrollHint.current) {
          const gone = gsap.utils.clamp(0, 1, session.progress / 0.06);
          scrollHint.current.style.opacity = String(session.lights.lamp * (1 - gone));
        }
      };
      gsap.ticker.add(tick);
      return () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("resize", onResize);
        window.clearTimeout(resizeTimer);
        gsap.ticker.remove(tick);
        st.kill();
      };
    },
    { scope: root },
  );

  // Lights on, once the preloader has left: red wall light flickers awake, then the lamp warms up.
  useEffect(() => {
    if (!done) return;
    const tl = gsap.timeline({ delay: 0.05 });
    tl.to(session.lights, { keyframes: { red: [0, 0.85, 0.1, 1, 0.25, 0.05, 1], easeEach: "none" }, duration: 1.1 })
      .to(session.lights, { lamp: 1, duration: 1.6, ease: "power2.inOut" }, "-=0.15")
      .to(session.lights, { ambient: 1, duration: 1.8, ease: "power2.inOut" }, "<");
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
    const next = !isMuted();
    setMuted(next);
    setMutedState(next);
  };

  return (
    <section ref={root} className="relative h-screen w-full overflow-clip bg-black text-pearl">
      <Studio />

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
        className="tap-ring absolute top-0 left-0 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-tan bg-black/40 text-tan backdrop-blur-sm"
        style={{ opacity: 0, pointerEvents: "none" }}
      >
        <span className="text-[9px] font-semibold tracking-[0.3em]">TAP</span>
      </button>

      <div
        ref={scrollHint}
        className="pointer-events-none absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3"
        style={{ opacity: 0 }}
      >
        <span className="text-[0.65rem] tracking-[0.4em] uppercase text-tan/70">Scroll</span>
        <span className="scroll-line block h-10 w-px bg-tan/70" />
      </div>

      <button
        onClick={toggleSound}
        className="absolute right-8 bottom-8 z-30 flex items-center gap-2 text-[0.65rem] tracking-[0.35em] uppercase text-tan/70 transition hover:text-tan"
      >
        <span className={`block h-1.5 w-1.5 rounded-full ${muted ? "bg-tan/30" : "bg-tan"}`} />
        Sound {muted ? "off" : "on"}
      </button>

      <ChatOverlay />
    </section>
  );
}
