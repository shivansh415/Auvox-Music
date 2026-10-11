"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";

/**
 * A small custom cursor for fine pointers: a dot that eases after the pointer, grows into a ring over
 * links and buttons, and shows a label over anything with `data-cursor="…"`.
 */
export default function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const el = dot.current;
    const lb = label.current;
    if (!el || !lb) return;
    document.documentElement.classList.add("has-cursor");
    const x = gsap.quickTo(el, "x", { duration: 0.35, ease: "power3.out" });
    const y = gsap.quickTo(el, "y", { duration: 0.35, ease: "power3.out" });
    let shown = false;
    const move = (e: PointerEvent) => {
      x(e.clientX);
      y(e.clientY);
      if (!shown) {
        shown = true;
        gsap.to(el, { autoAlpha: 1, duration: 0.3 });
      }
      const t = (e.target as HTMLElement | null)?.closest<HTMLElement>("a, button, [data-cursor], input, textarea, select, label");
      const text = t?.dataset.cursor ?? "";
      const typing = t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
      el.dataset.state = typing ? "text" : text ? "label" : t ? "link" : "";
      if (text && lb.textContent !== text) lb.textContent = text;
    };
    const leave = () => gsap.to(el, { autoAlpha: 0, duration: 0.3 });
    const enter = () => gsap.to(el, { autoAlpha: 1, duration: 0.3 });
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    document.documentElement.addEventListener("pointerenter", enter);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      document.documentElement.removeEventListener("pointerenter", enter);
      document.documentElement.classList.remove("has-cursor");
    };
  }, []);

  return (
    <div ref={dot} className="cursor pointer-events-none fixed top-0 left-0 z-[300] opacity-0" aria-hidden>
      <div className="cursor-dot" />
      <div ref={label} className="cursor-label" />
    </div>
  );
}
