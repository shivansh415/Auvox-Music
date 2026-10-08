"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import { blip, unlockAudio } from "./audio";
import { session } from "./state";

// Client's copy, verbatim.
const LINES = [
  { who: "A", text: "Hey… Have you heard about AUVOX Music?" },
  { who: "B", text: "Yeah! My friend joined recently and won't stop talking about it." },
  { who: "A", text: "Really? What's so special?" },
  {
    who: "B",
    text: "They don't just teach you music. You get live classes, personal guidance, and with the Complete package, they even send your instrument and The Frequency Box.",
  },
  { who: "A", text: "Wait… so everything's included?" },
  { who: "B", text: "Pretty much. It's like they thought of everything so you can just focus on learning." },
];

const smooth = (p: number, a: number, b: number) => gsap.utils.clamp(0, 1, (p - a) / (b - a));

type Stage = "idle" | "playing" | "done";

/**
 * Once the scroll push has settled on the phone, a play button sits on its screen.
 * Tapping it opens the conversation beside the scene (the client's reference layout).
 */
export default function ChatOverlay() {
  const play = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const [stage, setStage] = useState<Stage>("idle");
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState<string | null>(null);
  const stageRef = useRef<Stage>("idle");
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    const tick = () => {
      const p = session.progress;
      const arrived = smooth(p, 0.42, 0.6);
      if (play.current) {
        const { x, y } = session.phoneScreen;
        play.current.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        const show = stageRef.current === "idle" ? arrived : 0;
        play.current.style.opacity = String(show);
        play.current.style.pointerEvents = show > 0.6 ? "auto" : "none";
      }
    };
    gsap.ticker.add(tick);
    const pending = timers.current;
    return () => {
      gsap.ticker.remove(tick);
      pending.forEach(clearTimeout);
    };
  }, []);

  const start = () => {
    unlockAudio();
    setStage("playing");
    session.phonePulse = 1;
    let i = 0;
    const next = () => {
      if (i >= LINES.length) {
        setStage("done");
        return;
      }
      const line = LINES[i];
      setTyping(line.who);
      timers.current.push(
        window.setTimeout(
          () => {
            setTyping(null);
            setShown(i + 1);
            blip(line.who === "B");
            session.phonePulse = 1;
            i++;
            timers.current.push(window.setTimeout(next, 700));
          },
          800 + Math.min(1400, line.text.length * 9),
        ),
      );
    };
    timers.current.push(window.setTimeout(next, 400));
  };

  return (
    <>
      {/* play button on the phone */}
      <button
        ref={play}
        onClick={start}
        aria-label="Play the conversation"
        className="absolute top-0 left-0 z-20 flex flex-col items-center gap-2 opacity-0"
        style={{ pointerEvents: "none" }}
      >
        <span className="tap-ring relative flex h-14 w-14 items-center justify-center rounded-full bg-red text-pearl shadow-[0_0_40px_rgba(133,9,9,0.6)]">
          <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 fill-current">
            <path d="M6 4l14 8-14 8z" />
          </svg>
        </span>
        <span className="text-[0.6rem] font-semibold tracking-[0.35em] text-tan uppercase">Play</span>
      </button>

      {/* conversation beside the scene */}
      {stage !== "idle" && (
        <div
          ref={panel}
          className="absolute z-20 flex flex-col gap-3 text-pearl max-md:inset-x-4 max-md:bottom-24 md:top-1/2 md:left-[6vw] md:w-[min(440px,42vw)] md:-translate-y-1/2"
          style={{ animation: "bubble-in 0.6s cubic-bezier(0.2,0.9,0.3,1.1)" }}
        >
          <div className="flex items-center gap-3 px-1 pb-1">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-tan">
              <Image src="/svg/auvox-logomark.svg" alt="" width={18} height={16} unoptimized />
            </span>
            <div>
              <div className="text-sm font-semibold">AUVOX Music</div>
              <div className="text-xs text-tan">online</div>
            </div>
          </div>
          {LINES.slice(0, shown).map((line, i) => (
            <div
              key={i}
              className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-[15px] leading-snug shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-md ${
                line.who === "A"
                  ? "self-start rounded-bl-md bg-pearl/90 text-ink"
                  : "self-end rounded-br-md bg-red text-pearl"
              }`}
              style={{ animation: "bubble-in 0.35s cubic-bezier(0.2,0.9,0.3,1.2)" }}
            >
              {line.text}
            </div>
          ))}
          {typing && (
            <div
              className={`flex items-center gap-1 rounded-2xl px-4 py-3 backdrop-blur-md ${
                typing === "A" ? "self-start bg-pearl/90" : "self-end bg-red"
              }`}
            >
              {[0, 1, 2].map((d) => (
                <span key={d} className={`typing-dot block h-1.5 w-1.5 rounded-full ${typing === "A" ? "bg-ink" : "bg-pearl"}`} />
              ))}
            </div>
          )}
          {stage === "done" && (
            <div className="mt-4 self-center text-[0.65rem] tracking-[0.4em] text-tan uppercase opacity-90">
              Scroll to continue ↓
            </div>
          )}
        </div>
      )}
    </>
  );
}
