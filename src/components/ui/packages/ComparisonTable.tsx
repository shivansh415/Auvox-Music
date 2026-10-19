"use client";

import clsx from "clsx";
import { COMPARISON, type Verse } from "@/content/packages";

const Mark = ({ v, dark }: { v: boolean | string; dark: boolean }) => {
  if (typeof v === "string") return <span className={clsx("text-[0.62rem] tracking-[0.12em] whitespace-nowrap uppercase sm:text-[0.7rem] sm:tracking-[0.2em]", dark ? "text-peach/80" : "text-ink/80")}>{v}</span>;
  return v ? (
    <span className={clsx("inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem]", dark ? "bg-tan text-ink" : "bg-red text-peach")}>✓</span>
  ) : (
    <span className={clsx("inline-flex h-6 w-6 items-center justify-center rounded-full border text-[0.6rem]", dark ? "border-peach/25 text-peach/40" : "border-ink/20 text-ink/40")}>✕</span>
  );
};

/** Core vs Complete, one verse at a time (client: the comparison sits below each verse's packages). */
export default function ComparisonTable({ verse, tone = "light", className }: { verse: Verse; tone?: "light" | "dark"; className?: string }) {
  const dark = tone === "dark";
  const rows = COMPARISON(verse);
  return (
    <div className={clsx("overflow-hidden rounded-[1.4rem] ring-1", dark ? "ring-peach/15" : "ring-ink/10", className)}>
      <table className="w-full border-collapse text-left text-[0.85rem] sm:text-[0.95rem]">
        <thead>
          <tr className={clsx("text-[0.56rem] tracking-[0.18em] uppercase sm:text-[0.6rem] sm:tracking-[0.3em]", dark ? "bg-peach/5 text-peach/60" : "bg-ink/5 text-ink/55")}>
            <th className="py-4 pr-2 pl-4 font-medium sm:px-5 md:px-7">Inclusions</th>
            <th className="px-2 py-4 text-center font-medium sm:px-5 md:px-7">Core</th>
            <th className="py-4 pr-4 pl-2 text-center font-medium sm:px-5 md:px-7">Complete</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.label} className={clsx("cmp-row border-t", dark ? "border-peach/10" : "border-ink/8", i % 2 ? (dark ? "bg-peach/[0.025]" : "bg-ink/[0.02]") : "")}>
              <td className="py-3.5 pr-2 pl-4 sm:px-5 md:px-7">{r.label}</td>
              <td className="px-2 py-3.5 text-center sm:px-5 md:px-7"><Mark v={r.core} dark={dark} /></td>
              <td className="py-3.5 pr-4 pl-2 text-center sm:px-5 md:px-7"><Mark v={r.complete} dark={dark} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
