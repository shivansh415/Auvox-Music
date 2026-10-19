"use client";

import { useRef } from "react";
import TransitionLink from "@/components/ui/TransitionLink";
import { CONTACT_EMAIL } from "@/content/packages";
import { useReveal } from "./reveal";
import { mailtoDraft } from "./search";

/** The close: a person is one email away (with the last question already in the draft). */
export default function StillNeedHelp({ question }: { question?: string }) {
  const root = useRef<HTMLElement>(null);
  useReveal(root, ".as-still", 0.08);
  return (
    <section ref={root} className="bg-[#f5f5f7] py-24 md:py-32" aria-labelledby="still-title">
      <div className="mx-auto max-w-[760px] px-6 text-center">
        <h2 id="still-title" className="as-still as-display text-[2.25rem] leading-[1.08] font-semibold tracking-[-0.025em] text-[#1d1d1f] md:text-[3rem]">
          Still need help?
        </h2>
        <p className="as-still mx-auto mt-4 max-w-[32rem] text-[1.125rem] leading-snug text-[#6e6e73] md:text-[1.25rem]">
          A real person at AUVOX will reply. {question ? <>Your question, &ldquo;{question}&rdquo;, is already in the email.</> : "The email is drafted for you."}
        </p>
        <div className="as-still mt-9 flex flex-wrap items-center justify-center gap-3">
          <a href={mailtoDraft(question)} className="as-btn as-btn-fill as-btn-lg">
            Email us
          </a>
          <TransitionLink href="/reserve" className="as-btn as-btn-line as-btn-lg">
            Book a free demo
          </TransitionLink>
        </div>
        <p className="as-still mt-6 text-[0.875rem] text-[#86868b]">
          or write to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="as-link">
            {CONTACT_EMAIL}
          </a>
        </p>
      </div>
    </section>
  );
}
