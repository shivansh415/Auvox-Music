"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useTransitionStore } from "@/store/transition";

/**
 * A close button on every page but the home page (client): it takes the visitor back to the page they
 * came from inside the site, or to the home screen (the hero) when they arrived directly. Fixed under
 * the header's right side, a small round glass button with an ✕.
 */
export default function CloseButton() {
  const pathname = usePathname();
  // the in-site trail of pages, so "close" can go back to the previous one (this lives in the layout)
  const trail = useRef<string[]>([]);
  useEffect(() => {
    const t = trail.current;
    if (t[t.length - 1] !== pathname) t.push(pathname);
    if (t.length > 20) t.splice(0, t.length - 20);
  }, [pathname]);

  if (pathname === "/") return null;

  const close = () => {
    const t = trail.current;
    // the page before this one (skipping repeats of this page)
    let prev: string | undefined;
    for (let i = t.length - 2; i >= 0; i--) {
      if (t[i] !== pathname) {
        prev = t[i];
        t.length = i + 1;
        break;
      }
    }
    useTransitionStore.getState().go(!prev || prev === "/" ? "/#home" : prev);
  };

  return (
    <button
      type="button"
      onClick={close}
      aria-label="Close and go back"
      className="fixed top-[5.25rem] right-4 z-[110] flex h-11 w-11 items-center justify-center rounded-full border border-ink/15 bg-cream/80 text-ink shadow-[0_8px_24px_-12px_rgba(30,30,30,0.45)] backdrop-blur-md transition-colors duration-300 hover:bg-ink hover:text-peach md:top-[6.5rem] md:right-8 md:h-12 md:w-12"
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
        <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
      </svg>
    </button>
  );
}
