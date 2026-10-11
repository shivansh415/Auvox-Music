"use client";

import { useRef, type ReactNode } from "react";
import clsx from "clsx";
import { gsap } from "@/lib/gsap";
import TransitionLink from "./TransitionLink";

type Variant = "ink" | "red" | "outline" | "peach" | "ghost";

const VARIANTS: Record<Variant, string> = {
  ink: "bg-ink text-peach hover:bg-red",
  red: "bg-red text-peach hover:bg-ink",
  outline: "border border-current text-ink hover:bg-ink hover:text-peach",
  peach: "bg-peach text-ink hover:bg-tan",
  ghost: "text-current underline-offset-4 hover:underline",
};

type Props = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  arrow?: boolean;
  className?: string;
  disabled?: boolean;
};

/** The pill button. It leans toward the pointer (magnetic) and the arrow nudges on hover. */
export default function Button({ children, href, onClick, type = "button", variant = "ink", size = "md", arrow = true, className, disabled }: Props) {
  const ref = useRef<HTMLElement>(null);

  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || window.matchMedia("(pointer: coarse)").matches) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2);
    const y = e.clientY - (r.top + r.height / 2);
    gsap.to(el, { x: x * 0.22, y: y * 0.28, duration: 0.6, ease: "power3.out" });
  };
  const leave = () => {
    if (ref.current) gsap.to(ref.current, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.5)" });
  };

  const cls = clsx(
    "group inline-flex items-center justify-center gap-3 rounded-full font-semibold tracking-[0.3em] uppercase transition-colors duration-300 select-none",
    size === "sm" && "px-5 py-3 text-[0.62rem]",
    size === "md" && "px-8 py-[1.05rem] text-[0.7rem]",
    size === "lg" && "px-10 py-5 text-[0.76rem]",
    VARIANTS[variant],
    disabled && "pointer-events-none opacity-50",
    className,
  );
  const inner = (
    <>
      <span>{children}</span>
      {arrow && <span className="inline-block transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">↗</span>}
    </>
  );
  if (href) {
    return (
      <TransitionLink ref={ref as React.Ref<HTMLAnchorElement>} href={href} className={cls} onPointerMove={move} onPointerLeave={leave} onClick={onClick}>
        {inner}
      </TransitionLink>
    );
  }
  return (
    <button ref={ref as React.Ref<HTMLButtonElement>} type={type} className={cls} onPointerMove={move} onPointerLeave={leave} onClick={onClick} disabled={disabled}>
      {inner}
    </button>
  );
}
