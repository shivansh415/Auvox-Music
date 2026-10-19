"use client";

import { useId, useState } from "react";
import clsx from "clsx";
import Highlight from "./Highlight";
import { mailtoDraft, type Faq } from "./search";

/**
 * One preloaded answer, Apple-support style: the question as a row with a chevron; it opens in place
 * (a grid-rows transition, no measuring) and asks "Was this helpful?". A "No" offers the email draft
 * with the question already in it.
 */
export default function Answer({ faq, words = [], open, onToggle, compact }: { faq: Faq; words?: string[]; open: boolean; onToggle: () => void; compact?: boolean }) {
  const id = useId();
  const [vote, setVote] = useState<"yes" | "no" | null>(null);
  return (
    <div className={clsx("as-answer border-b border-black/10", open && "is-open")}>
      <button
        type="button"
        id={`${id}-q`}
        aria-expanded={open}
        aria-controls={`${id}-a`}
        onClick={onToggle}
        className={clsx("group flex w-full items-center justify-between gap-6 text-left", compact ? "py-4" : "py-5")}
      >
        <span className={clsx("font-medium text-[#1d1d1f] transition-colors group-hover:text-red", compact ? "text-[1rem]" : "text-[1.0625rem] md:text-[1.1875rem]")}>
          <Highlight text={faq.q} words={words} />
        </span>
        <span className="as-chev flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-[#1d1d1f] transition-transform duration-500" aria-hidden>
          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 4.5L6 7.5 9 4.5" />
          </svg>
        </span>
      </button>
      <div id={`${id}-a`} role="region" aria-labelledby={`${id}-q`} className="as-panel grid" inert={!open}>
        <div className="overflow-hidden">
          <div className="pb-6 md:max-w-[44rem]">
            <p className="text-[1rem] leading-relaxed text-[#424245] md:text-[1.0625rem]">
              <Highlight text={faq.a} words={words} />
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-[0.875rem] text-[#6e6e73]">
              {vote === null && (
                <>
                  <span>Was this helpful?</span>
                  <button type="button" onClick={() => setVote("yes")} className="as-chip">
                    Yes
                  </button>
                  <button type="button" onClick={() => setVote("no")} className="as-chip">
                    No
                  </button>
                </>
              )}
              {vote === "yes" && <span role="status">Thanks for letting us know.</span>}
              {vote === "no" && (
                <span role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  Sorry about that. A person can help:
                  <a href={mailtoDraft(faq.q)} className="as-link">
                    Email us about this
                  </a>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
