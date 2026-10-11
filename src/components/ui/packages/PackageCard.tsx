"use client";

import clsx from "clsx";
import { type Package } from "@/content/packages";
import Button from "../Button";

const money = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

/**
 * One package. "Complete" is the Best Value card: ink on peach pages, red-accented on ink pages.
 * `tone` is the page it sits on.
 */
export default function PackageCard({ pkg, tone = "light", compact, className }: { pkg: Package; tone?: "light" | "dark"; compact?: boolean; className?: string }) {
  const best = !!pkg.bestValue;
  const dark = tone === "dark";
  // card surfaces: on peach pages Complete flips to ink; on ink pages Complete gets a red wash
  const surface = best
    ? dark
      ? "bg-[radial-gradient(90%_80%_at_80%_0%,rgba(133,9,9,0.55),transparent_70%)] bg-ink text-peach ring-1 ring-tan/40"
      : "bg-ink text-peach"
    : dark
      ? "bg-ink text-peach ring-1 ring-peach/15"
      : "bg-cream text-ink ring-1 ring-ink/10";
  const muted = best || dark ? "text-peach/60" : "text-ink/55";
  const rule = best || dark ? "border-peach/15" : "border-ink/10";
  const verse = pkg.verse === "guitar" ? "Guitar Verse" : "Piano Verse";
  const tier = pkg.tier === "core" ? "Core" : "Complete";

  return (
    <article className={clsx("pkg relative flex flex-col overflow-hidden rounded-[1.6rem] p-7 md:p-9", surface, className)} data-best={best ? "1" : "0"}>
      <div className="grain pointer-events-none absolute inset-[-50%] opacity-[0.05] mix-blend-multiply" />
      {best && (
        <span className="absolute top-6 right-6 rounded-full bg-tan px-3 py-1.5 text-[0.55rem] font-semibold tracking-[0.3em] text-ink uppercase">Best value</span>
      )}
      <span className={clsx("text-[0.6rem] tracking-[0.35em] uppercase", muted)}>{verse}</span>
      <h3 className="font-display mt-3 text-[2.4rem] leading-none md:text-[3rem]">{tier}</h3>
      <p className="mt-4 flex items-baseline gap-2">
        <span className="font-display text-[2rem] leading-none md:text-[2.4rem]">{money(pkg.price)}</span>
        <span className={clsx("text-[0.62rem] tracking-[0.3em] uppercase", muted)}>{pkg.currency}</span>
      </p>
      <ul className={clsx("mt-7 space-y-2.5 border-t pt-6 text-[0.95rem]", rule)}>
        {pkg.includes.map((it) => (
          <li key={it} className="flex gap-3">
            <span className={clsx("mt-[0.55em] block h-1.5 w-1.5 shrink-0 rounded-full", best || dark ? "bg-tan" : "bg-red")} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
      {!compact && (
        <div className={clsx("mt-7 border-t pt-5", rule)}>
          <span className={clsx("text-[0.6rem] tracking-[0.3em] uppercase", muted)}>Optional add-on{pkg.addOns.length > 1 ? "s" : ""}</span>
          <ul className="mt-2 space-y-1 text-sm">
            {pkg.addOns.map((a) => (
              <li key={a.name} className="flex justify-between gap-4">
                <span>{a.name}</span>
                <span className={muted}>{money(a.price)} {pkg.currency}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-8 flex-1" />
      <Button href={`/enroll?package=${pkg.id}`} variant={best ? "peach" : dark ? "peach" : "ink"} className="self-start">
        Enroll now
      </Button>
    </article>
  );
}
