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

type Stage = "locked" | "playing" | "done";

/**
 * Takes over once the 3D camera has pushed into the phone: a white-out hides the handoff,
 * then the lock screen → play → chat plays as a real DOM UI. Fades to pearl at the very end
 * so the next section can continue seamlessly.
 */
export default function PhoneUI() {
  const root = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const ui = useRef<HTMLDivElement>(null);
  const exit = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const [stage, setStage] = useState<Stage>("locked");
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => {
      const p = session.progress;
      const u = smooth(p, 0.74, 0.82);
      if (glow.current) glow.current.style.opacity = String(smooth(p, 0.64, 0.74) * (1 - smooth(p, 0.78, 0.9)));
      if (ui.current) ui.current.style.opacity = String(u);
      if (root.current) root.current.style.pointerEvents = u > 0.5 ? "auto" : "none";
      if (exit.current) exit.current.style.opacity = String(smooth(p, 0.9, 1));
    };
    gsap.ticker.add(tick);
    const pending = timers.current;
    return () => {
      gsap.ticker.remove(tick);
      pending.forEach(clearTimeout);
    };
  }, []);

  const play = () => {
    unlockAudio();
    setStage("playing");
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
            i++;
            timers.current.push(window.setTimeout(next, 700));
          },
          800 + Math.min(1400, line.text.length * 9),
        ),
      );
    };
    timers.current.push(window.setTimeout(next, 500));
  };

  return (
    <div ref={root} className="absolute inset-0 z-20" style={{ pointerEvents: "none" }}>
      {/* white-out between the 3D screen and the DOM screen */}
      <div ref={glow} className="absolute inset-0 bg-pearl" style={{ opacity: 0 }} />

      <div ref={ui} className="absolute inset-0 text-pearl" style={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#3a0a0a_0%,#160909_55%,#0b0707_100%)]" />
        <div className="grain pointer-events-none absolute inset-[-50%] opacity-[0.05] mix-blend-overlay" />

        {/* status bar */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-6 py-4 text-xs font-medium tracking-wider opacity-80">
          <span>11:50</span>
          <span className="flex items-center gap-2">
            <span>AUVOX</span>
            <span className="inline-block h-2.5 w-5 rounded-[3px] border border-pearl/70 p-px">
              <span className="block h-full w-[70%] rounded-[1px] bg-pearl" />
            </span>
          </span>
        </div>

        {stage === "locked" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-10 px-6">
            <div className="text-center">
              <div className="font-display text-[clamp(5rem,16vw,9rem)] leading-none font-semibold">11:50</div>
              <div className="mt-2 text-base tracking-[0.2em] uppercase opacity-60">Tuesday, 7 October</div>
            </div>
            <button
              onClick={play}
              className="group flex w-full max-w-sm items-center gap-4 rounded-3xl border border-pearl/15 bg-pearl/10 p-4 text-left backdrop-blur-md transition hover:bg-pearl/15"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tan">
                <Image src="/svg/auvox-logomark.svg" alt="" width={24} height={22} unoptimized />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">AUVOX Music</span>
                <span className="block truncate text-sm opacity-70">1 new conversation</span>
              </span>
              <span className="tap-ring relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red text-pearl">
                <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4 fill-current">
                  <path d="M6 4l14 8-14 8z" />
                </svg>
              </span>
            </button>
            <div className="text-[0.65rem] tracking-[0.4em] uppercase opacity-50">Tap to play</div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col pt-14">
            <div className="flex items-center gap-3 border-b border-pearl/10 px-6 pb-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-tan">
                <Image src="/svg/auvox-logomark.svg" alt="" width={18} height={16} unoptimized />
              </span>
              <div>
                <div className="text-sm font-semibold">AUVOX Music</div>
                <div className="text-xs text-tan">online</div>
              </div>
            </div>
            <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-end gap-2.5 px-5 pb-10">
              {LINES.slice(0, shown).map((line, i) => (
                <div
                  key={i}
                  className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-[15px] leading-snug ${
                    line.who === "A"
                      ? "self-start rounded-bl-md bg-pearl/10"
                      : "self-end rounded-br-md bg-red text-pearl"
                  }`}
                  style={{ animation: "bubble-in 0.35s cubic-bezier(0.2,0.9,0.3,1.2)" }}
                >
                  {line.text}
                </div>
              ))}
              {typing && (
                <div
                  className={`flex items-center gap-1 rounded-2xl px-4 py-3 ${
                    typing === "A" ? "self-start bg-pearl/10" : "self-end bg-red"
                  }`}
                >
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="typing-dot block h-1.5 w-1.5 rounded-full bg-pearl" />
                  ))}
                </div>
              )}
              {stage === "done" && (
                <div className="mt-6 self-center text-[0.65rem] tracking-[0.4em] uppercase text-tan opacity-80">
                  Scroll to continue ↓
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* fade to pearl → next section */}
      <div ref={exit} className="absolute inset-0 bg-pearl" style={{ opacity: 0 }} />
    </div>
  );
}
