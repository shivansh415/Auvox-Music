"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { gsap, useGSAP } from "@/lib/gsap";
import SectionHead from "@/components/ui/SectionHead";
import Button from "@/components/ui/Button";
import Disclosure from "./Disclosure";
import Highlight from "./Highlight";
import Waveform from "./Waveform";
import { prefersReduced } from "./reveal";
import { mailtoDraft, matchFaqs, TAG_LABEL } from "./search";

const HINTS = ["Frequency Box", "beginner", "renew", "T-shirt"];

type Props = { onQuery?: (q: string) => void };

/** Hero band: kicker / headline / the big underline search that filters the preloaded answers live. */
export default function SupportHero({ onQuery }: Props) {
  const root = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const trimmed = query.trim();
  const results = useMemo(() => matchFaqs(trimmed, 6), [trimmed]);
  const sig = results.map((r) => r.faq.id).join("|");
  const energy = focused ? 1 : trimmed ? 0.6 : 0;

  // "/" focuses the search from anywhere on the page
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      input.current?.focus();
      input.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // intro: the underline draws in, the field rises
  useGSAP(
    () => {
      const reduced = prefersReduced();
      const tl = gsap.timeline({ defaults: { ease: "expo.out" }, delay: 0.5 });
      tl.fromTo(".support-field", { y: reduced ? 0 : 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.1 })
        .fromTo(".support-line", { scaleX: 0 }, { scaleX: 1, duration: 1.5, ease: "expo.inOut" }, 0.1)
        .fromTo(".support-hint", { y: reduced ? 0 : 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.06 }, 0.7);
    },
    { scope: root },
  );

  // results: staggered line reveal whenever the set of matches changes
  useGSAP(
    () => {
      if (!sig) return;
      const reduced = prefersReduced();
      gsap.fromTo(
        ".support-result",
        { yPercent: reduced ? 0 : 110, autoAlpha: reduced ? 0 : 1 },
        { yPercent: 0, autoAlpha: 1, duration: 1, ease: "expo.out", stagger: 0.05, overwrite: true },
      );
    },
    { scope: root, dependencies: [sig] },
  );

  const change = (v: string) => {
    setQuery(v);
    setOpen(null);
  };

  return (
    <section ref={root} className="support-hero relative isolate overflow-hidden bg-peach text-ink pt-36 pb-20 md:pt-48 md:pb-28" aria-label="Support">
      <div className="support-hero-glow pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
      <div className="grain pointer-events-none absolute inset-0 -z-10 opacity-[0.04] mix-blend-multiply" aria-hidden="true" />
      <Waveform energy={energy} />

      <div className="relative mx-auto max-w-[1440px] px-6 md:px-12">
        <SectionHead
          as="h1"
          immediate
          size="xl"
          kicker="Support"
          title="How can we help you play?"
          accent="play?"
          body="Preloaded answers to the questions we hear most. If yours isn't here, email us — the draft is already written."
          className="max-w-[52rem]"
        />

        <form
          role="search"
          className="support-field mt-14 opacity-0 md:mt-20"
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed) onQuery?.(trimmed);
            if (results[0]) setOpen(results[0].faq.id);
          }}
        >
          <label htmlFor="support-search" className="sr-only">
            Search a question
          </label>
          <div className="support-search relative">
            <input
              ref={input}
              id="support-search"
              type="search"
              value={query}
              onChange={(e) => change(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key !== "Escape") return;
                if (query) change("");
                else e.currentTarget.blur();
              }}
              placeholder="Search a question…"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              aria-describedby="support-search-status"
              className="font-display w-full bg-transparent py-4 pr-20 text-[clamp(1.75rem,4.6vw,4rem)] leading-[1.1] tracking-[-0.015em] text-ink outline-none md:pr-28"
            />
            <div className="absolute inset-y-0 right-0 flex items-center gap-3">
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    change("");
                    input.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/25 text-ink transition-colors duration-300 hover:border-red hover:text-red"
                >
                  <span aria-hidden="true" className="text-xl leading-none">
                    ×
                  </span>
                </button>
              ) : (
                <kbd aria-hidden="true" className="support-kbd hidden items-center justify-center rounded-md border border-ink/25 px-2.5 py-1 font-sans text-[0.7rem] text-ink/60 md:flex">
                  /
                </kbd>
              )}
            </div>
            <span className="support-line" aria-hidden="true" />
            <span className="support-line-focus" aria-hidden="true" />
          </div>
        </form>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          <p id="support-search-status" aria-live="polite" className="text-[0.7rem] font-medium tracking-[0.3em] text-ink/60 uppercase">
            {trimmed ? `${results.length} ${results.length === 1 ? "answer" : "answers"} for “${trimmed}”` : "Try"}
          </p>
          {!trimmed && (
            <ul className="flex flex-wrap gap-2" aria-label="Suggested searches">
              {HINTS.map((h) => (
                <li key={h} className="support-hint">
                  <button
                    type="button"
                    onClick={() => {
                      change(h);
                      input.current?.focus();
                    }}
                    className="rounded-full border border-ink/20 px-3.5 py-1.5 text-[0.78rem] text-ink/80 transition-colors duration-300 hover:border-ink hover:bg-ink hover:text-peach"
                  >
                    {h}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {trimmed && (
          <div className="support-results mt-10 max-w-[56rem]">
            {results.length ? (
              <ul className="divide-y divide-ink/15 border-t border-ink/15" aria-label="Matching answers">
                {results.map(({ faq, words }, i) => (
                  <li key={faq.id} className="overflow-hidden">
                    <div className="support-result">
                      <Disclosure
                        id={`search-${faq.id}`}
                        index={String(i + 1).padStart(2, "0")}
                        open={open === faq.id}
                        onToggle={() => setOpen((o) => (o === faq.id ? null : faq.id))}
                        title={<Highlight text={faq.q} words={words} />}
                        titleClass="font-display text-[clamp(1.3rem,2.3vw,2rem)] leading-[1.15]"
                      >
                        <p className="max-w-[40rem] text-[1.05rem] leading-relaxed text-ink/75">
                          <Highlight text={faq.a} words={words} />
                        </p>
                        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Topics">
                          {faq.tags.map((t) => (
                            <li key={t} className="rounded-full bg-cream px-3 py-1 text-[0.62rem] font-medium tracking-[0.25em] text-ink/70 uppercase">
                              {TAG_LABEL[t] ?? t}
                            </li>
                          ))}
                        </ul>
                      </Disclosure>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={clsx("support-result rounded-[1.5rem] bg-cream p-7 md:p-9")}>
                <p className="font-display text-[clamp(1.4rem,2.6vw,2.2rem)] leading-[1.1] text-ink">
                  Nothing preloaded for <em className="text-red not-italic">“{trimmed}”</em>.
                </p>
                <p className="mt-3 max-w-[34rem] text-[1.02rem] leading-relaxed text-ink/75">That one needs a human. Your question is already in the draft — just hit send.</p>
                <div className="mt-6">
                  <Button href={mailtoDraft(trimmed)} variant="red">
                    Email us
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
