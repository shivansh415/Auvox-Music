"use client";

import Link from "next/link";
import { type ComponentProps, type MouseEvent } from "react";
import { useTransition } from "@/store/transition";

/** A Next link that goes through the page curtain. Modifier-clicks and external links pass through. */
export default function TransitionLink({ href, onClick, ...rest }: ComponentProps<typeof Link>) {
  const go = useTransition();
  const to = typeof href === "string" ? href : (href.pathname ?? "/");
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (/^(https?:|mailto:|tel:)/.test(to) || rest.target === "_blank") return;
    e.preventDefault();
    go(to);
  };
  return <Link href={href} onClick={handle} {...rest} />;
}
