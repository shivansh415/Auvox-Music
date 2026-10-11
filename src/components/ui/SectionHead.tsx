"use client";

import { useRef } from "react";
import clsx from "clsx";
import { gsap, SplitText, useGSAP } from "@/lib/gsap";

type Props = {
  kicker: string;
  title: string;
  /** the tail of `title` that takes the accent colour (client rule: the last word) */
  accent?: string;
  body?: string | readonly string[];
  tone?: "light" | "dark";
  align?: "left" | "center";
  size?: "md" | "lg" | "xl";
  className?: string;
  /** play the reveal immediately instead of on scroll */
  immediate?: boolean;
  as?: "h1" | "h2" | "h3";
};

/** The client's T / L / S heading block, with the line reveal built in. */
export default function SectionHead({ kicker, title, accent, body, tone = "light", align = "left", size = "lg", className, immediate, as: Tag = "h2" }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const dark = tone === "dark";
  const head = accent && title.endsWith(accent) ? title.slice(0, -accent.length) : title;
  const bodies = body ? (Array.isArray(body) ? body : [body]) : [];

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      const split = new SplitText(q(".sh-title"), { type: "lines,words", linesClass: "sh-line" });
      gsap.set(split.lines, { overflow: "hidden", paddingBottom: "0.1em", marginBottom: "-0.1em" });
      const tl = gsap.timeline({
        defaults: { ease: "expo.out" },
        scrollTrigger: immediate ? undefined : { trigger: el, start: "top 80%", once: true },
      });
      tl.fromTo(q(".sh-rule"), { scaleX: 0 }, { scaleX: 1, duration: 1, transformOrigin: "left" }, 0)
        .fromTo(q(".sh-kicker"), { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8 }, 0.1)
        .from(split.words, { yPercent: 110, duration: 1.1, stagger: 0.03 }, 0.2)
        .fromTo(q(".sh-body"), { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.08 }, 0.6)
        .add(() => split.revert());
      return () => {
        split.revert();
      };
    },
    { scope: root },
  );

  return (
    <div ref={root} className={clsx("max-w-[44rem]", align === "center" && "mx-auto text-center", className)}>
      <div className={clsx("flex items-center gap-4", align === "center" && "justify-center")}>
        <span className={clsx("sh-rule block h-px w-10", dark ? "bg-peach/50" : "bg-ink/50")} />
        <span className={clsx("sh-kicker text-[0.65rem] font-medium tracking-[0.38em] uppercase", dark ? "text-peach/70" : "text-ink/70")}>{kicker}</span>
        {align === "center" && <span className={clsx("sh-rule block h-px w-10", dark ? "bg-peach/50" : "bg-ink/50")} />}
      </div>
      <Tag
        className={clsx(
          "sh-title font-display mt-6 leading-[1.0] tracking-[-0.015em]",
          size === "xl" && "text-[clamp(2.8rem,6vw,6.2rem)]",
          size === "lg" && "text-[clamp(2.4rem,5vw,5.2rem)]",
          size === "md" && "text-[clamp(1.9rem,3.4vw,3.4rem)]",
          dark ? "text-peach" : "text-ink",
        )}
      >
        {head}
        {accent && <em className={clsx("not-italic", dark ? "text-tan" : "text-red")}>{accent}</em>}
      </Tag>
      {bodies.map((b, i) => (
        <p key={i} className={clsx("sh-body text-[1.05rem] leading-relaxed", i === 0 ? "mt-7" : "mt-3", dark ? "text-peach/75" : "text-ink/75")}>
          {b}
        </p>
      ))}
    </div>
  );
}
