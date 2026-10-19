"use client";

import { useRef, useState } from "react";
import Answer from "./Answer";
import { useReveal } from "./reveal";
import { POPULAR } from "./topics";

/** The answers most people open, two columns of rows that open in place. */
export default function PopularAnswers() {
  const root = useRef<HTMLElement>(null);
  const [open, setOpen] = useState<string | null>(null);
  useReveal(root, ".as-pop-row", 0.05);
  const half = Math.ceil(POPULAR.length / 2);
  const cols = [POPULAR.slice(0, half), POPULAR.slice(half)];
  return (
    <section ref={root} className="bg-cream py-20 md:py-28" aria-labelledby="popular-title">
      <div className="mx-auto max-w-[1180px] px-6">
        <h2 id="popular-title" className="as-display text-[2rem] leading-tight font-semibold tracking-[-0.02em] text-[#1d1d1f] md:text-[2.5rem]">
          Popular answers
        </h2>
        <div className="mt-6 grid gap-x-16 md:mt-8 md:grid-cols-2">
          {cols.map((col, c) => (
            <div key={c} className={c === 0 ? "border-t border-black/10" : "border-black/10 md:border-t"}>
              {col.map((f) => (
                <div key={f.id} className="as-pop-row">
                  <Answer faq={f} open={open === f.id} onToggle={() => setOpen((o) => (o === f.id ? null : f.id))} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
