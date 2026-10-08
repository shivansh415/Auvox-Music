"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import { blip, unlockAudio } from "./audio";
import { dismissPhoneHint, pulsePhone, session } from "./state";

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

type Stage = "idle" | "playing" | "done";

const AVATAR: Record<string, string> = { A: "/chat/avatar-a.webp", B: "/chat/avatar-b.webp" };

/** One message line: avatar on the outside edge (A left, B right), bubble beside it. */
function Row({ who, children }: { who: string; children: React.ReactNode }) {
  const left = who === "A";
  return (
    <div
      className={`flex max-w-[92%] items-end gap-2.5 ${left ? "self-start" : "flex-row-reverse self-end"}`}
      style={{ animation: "bubble-in 0.35s cubic-bezier(0.2,0.9,0.3,1.2)" }}
    >
      <Image
        src={AVATAR[who]}
        alt=""
        width={36}
        height={36}
        unoptimized
        className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-black/40"
      />
      {children}
    </div>
  );
}

/**
 * Tapping the phone opens the conversation beside the scene (the client's reference layout).
 */
export default function ChatOverlay() {
  const panel = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const [stage, setStage] = useState<Stage>("idle");
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState<string | null>(null);
  const stageRef = useRef<Stage>("idle");
  const startRef = useRef<() => void>(() => {});
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    const tick = () => {
      if (session.autoPlay && stageRef.current === "idle") {
        session.autoPlay = false;
        startRef.current();
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
    dismissPhoneHint();
    setStage("playing");
    pulsePhone();
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
            pulsePhone();
            i++;
            timers.current.push(window.setTimeout(next, 700));
          },
          800 + Math.min(1400, line.text.length * 9),
        ),
      );
    };
    timers.current.push(window.setTimeout(next, 400));
  };

  useEffect(() => {
    startRef.current = start;
  });

  return (
    <>

      {/* conversation beside the scene */}
      {stage !== "idle" && (
        <div
          ref={panel}
          className="absolute z-20 flex flex-col gap-3 text-pearl max-md:inset-x-4 max-md:bottom-24 md:top-1/2 md:left-[6vw] md:w-[min(440px,42vw)] md:-translate-y-1/2"
          style={{ animation: "bubble-in 0.6s cubic-bezier(0.2,0.9,0.3,1.1)" }}
        >
          {LINES.slice(0, shown).map((line, i) => (
            <Row key={i} who={line.who}>
              <div
                className={`rounded-2xl px-4 py-2.5 text-[15px] leading-snug shadow-[0_8px_30px_rgba(0,0,0,0.35)] ${
                  line.who === "A" ? "rounded-bl-md bg-pearl text-ink" : "rounded-br-md bg-red text-pearl"
                }`}
              >
                {line.text}
              </div>
            </Row>
          ))}
          {typing && (
            <Row who={typing}>
              <div
                className={`flex items-center gap-1 rounded-2xl px-4 py-3 ${
                  typing === "A" ? "rounded-bl-md bg-pearl" : "rounded-br-md bg-red"
                }`}
              >
                {[0, 1, 2].map((d) => (
                  <span key={d} className={`typing-dot block h-1.5 w-1.5 rounded-full ${typing === "A" ? "bg-ink" : "bg-pearl"}`} />
                ))}
              </div>
            </Row>
          )}
          {stage === "done" && (
            <div className="mt-4 self-center text-[0.65rem] tracking-[0.4em] text-tan uppercase opacity-90">
              Scroll to explore ↓
            </div>
          )}
        </div>
      )}
    </>
  );
}
