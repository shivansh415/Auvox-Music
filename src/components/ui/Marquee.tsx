"use client";

import clsx from "clsx";
import { type ReactNode } from "react";

/** An endless horizontal band. Pass the items; they are repeated to fill. */
export default function Marquee({ children, speed = 40, reverse, className }: { children: ReactNode; speed?: number; reverse?: boolean; className?: string }) {
  return (
    <div className={clsx("marquee flex overflow-hidden whitespace-nowrap", className)} style={{ ["--marquee-s" as string]: `${speed}s` }}>
      {[0, 1].map((i) => (
        <div key={i} aria-hidden={i === 1} className={clsx("marquee-track flex shrink-0 items-center", reverse && "marquee-reverse")}>
          {children}
        </div>
      ))}
    </div>
  );
}
