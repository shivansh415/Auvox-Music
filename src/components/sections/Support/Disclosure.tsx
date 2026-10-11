"use client";

import { useRef, type ReactNode } from "react";
import clsx from "clsx";
import { gsap, useGSAP } from "@/lib/gsap";
import { prefersReduced } from "./reveal";

type Props = {
  id: string;
  open: boolean;
  onToggle: () => void;
  title: ReactNode;
  children: ReactNode;
  /** small text to the left of the title (e.g. "01") */
  index?: string;
  className?: string;
  titleClass?: string;
};

/** One accordion row: labelled button + GSAP height-animated panel. Plus rotates into a minus. */
export default function Disclosure({ id, open, onToggle, title, children, index, className, titleClass }: Props) {
  const panel = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = panel.current;
      if (!el) return;
      const inner = el.firstElementChild;
      const reduced = prefersReduced();
      gsap.to(el, { height: open ? "auto" : 0, duration: reduced ? 0 : 0.8, ease: "expo.inOut", overwrite: true });
      if (inner) gsap.to(inner, { y: open ? 0 : 10, autoAlpha: open ? 1 : 0, duration: reduced ? 0 : 0.7, delay: open && !reduced ? 0.15 : 0, ease: "expo.out", overwrite: true });
    },
    { dependencies: [open] },
  );

  return (
    <div className={className}>
      <button
        type="button"
        id={`${id}-btn`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={onToggle}
        className="support-row group flex w-full items-start justify-between gap-6 py-5 text-left md:py-6"
      >
        <span className="flex min-w-0 items-baseline gap-5">
          {index && <span className="w-6 shrink-0 text-[0.65rem] font-medium tracking-[0.3em] text-ink/45">{index}</span>}
          <span className={clsx("support-row-title transition-colors duration-300 group-hover:text-red", titleClass)}>{title}</span>
        </span>
        <span className="support-plus mt-2 text-ink" aria-hidden="true" />
      </button>
      <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-btn`} ref={panel} className="h-0 overflow-hidden" inert={!open}>
        <div className={clsx("pb-7 opacity-0", index && "md:pl-11")}>{children}</div>
      </div>
    </div>
  );
}
