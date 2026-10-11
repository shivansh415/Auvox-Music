"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import { prefersReduced } from "./reveal";

const W = 1440;
const H = 240;
const N = 200;

/**
 * A faint sine polyline that breathes on the GSAP ticker behind the hero band.
 * `energy` (0–1) raises the amplitude while the search field is in use. Only ticks while on screen.
 */
export default function Waveform({ energy }: { energy: number }) {
  const svg = useRef<SVGSVGElement>(null);
  const lineA = useRef<SVGPolylineElement>(null);
  const lineB = useRef<SVGPolylineElement>(null);
  const state = useRef({ t: 0, amp: 0.35, target: 0.35 });

  useEffect(() => {
    state.current.target = 0.3 + energy * 0.7;
  }, [energy]);

  useEffect(() => {
    const root = svg.current;
    const a = lineA.current;
    const b = lineB.current;
    if (!root || !a || !b) return;
    const s = state.current;

    const draw = () => {
      let pa = "";
      let pb = "";
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const x = (u * W).toFixed(1);
        const env = 0.35 + 0.65 * Math.sin(u * Math.PI);
        const wave = Math.sin(u * 9.5 + s.t) * 0.6 + Math.sin(u * 23 - s.t * 1.6) * 0.3 + Math.sin(u * 47 + s.t * 0.7) * 0.1;
        const wave2 = Math.sin(u * 7 - s.t * 0.8 + 1.3) * 0.6 + Math.sin(u * 19 + s.t * 1.2) * 0.4;
        pa += `${x},${(H / 2 + wave * env * s.amp * 70).toFixed(1)} `;
        pb += `${x},${(H / 2 + wave2 * env * s.amp * 40).toFixed(1)} `;
      }
      a.setAttribute("points", pa);
      b.setAttribute("points", pb);
    };

    draw();
    if (prefersReduced()) return;

    const tick = (_time: number, delta: number) => {
      s.t += delta * 0.0009;
      s.amp += (s.target - s.amp) * 0.05;
      draw();
    };
    let running = false;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !running) {
        gsap.ticker.add(tick);
        running = true;
      } else if (!entry.isIntersecting && running) {
        gsap.ticker.remove(tick);
        running = false;
      }
    });
    io.observe(root);
    return () => {
      io.disconnect();
      gsap.ticker.remove(tick);
    };
  }, []);

  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] w-full">
      <polyline ref={lineA} fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" className="text-ink/20" />
      <polyline ref={lineB} fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" className="text-ink/10" />
    </svg>
  );
}
