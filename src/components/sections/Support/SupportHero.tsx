"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { gsap, useGSAP } from "@/lib/gsap";
import Answer from "./Answer";
import { prefersReduced } from "./reveal";
import { mailtoDraft, matchFaqs } from "./search";
import { ICONS, POPULAR, TOPICS, type TopicKey } from "./topics";

type Props = {
  /** a topic tile was picked: show its answers in "Browse by topic" */
  onTopic: (key: TopicKey) => void;
  /** hand a question to the Ask AUVOX chat */
  onAsk: (q: string) => void;
  /** remember the last question (it prefills the email draft at the end of the page) */
  onQuery: (q: string) => void;
};

/** The top of the page: the title, the topic row and the big search with live answers. */
export default function SupportHero({ onTopic, onAsk, onQuery }: Props) {
  const root = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const trimmed = query.trim();
  const results = useMemo(() => matchFaqs(trimmed, 6), [trimmed]);
  const showQuick = !trimmed && focused;

  // "/" focuses the search from anywhere on the page
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // the intro: title, tiles and search rise in, Apple-quiet
  useGSAP(
    () => {
      const reduced = prefersReduced();
      gsap.fromTo(
        ".as-rise",
        { y: reduced ? 0 : 22, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 1.1, ease: "power3.out", stagger: 0.08, delay: 0.35 },
      );
    },
    { scope: root },
  );

  const change = (v: string) => {
    setQuery(v);
    setOpen(null);
    setActive(0);
  };
  const submit = () => {
    if (!trimmed) return;
    onQuery(trimmed);
    if (results[0]) setOpen(results[Math.min(active, results.length - 1)].faq.id);
  };

  return (
    <section ref={root} className="relative bg-cream pt-32 pb-16 md:pt-44 md:pb-24" aria-label="AUVOX Support">
      <div className="mx-auto max-w-[980px] px-6 text-center">
        <h1 className="as-rise as-display text-[2.75rem] leading-[1.05] font-semibold tracking-[-0.025em] text-[#1d1d1f] md:text-[4rem]">
          AUVOX Support
        </h1>
        <p className="as-rise mx-auto mt-4 max-w-[34rem] text-[1.1875rem] leading-snug text-[#6e6e73] md:text-[1.375rem]">
          Answers about packages, live classes, your kit and your account.
        </p>

        {/* topics */}
        <ul className="as-rise as-tiles mx-auto mt-12 grid max-w-[22rem] grid-cols-3 gap-x-2 gap-y-7 md:mt-14 md:flex md:max-w-none md:justify-center md:gap-4" aria-label="Topics">
          {TOPICS.map((t) => (
            <li key={t.key} className="flex justify-center">
              <button type="button" onClick={() => onTopic(t.key)} className="as-tile group flex w-[6.5rem] flex-col items-center gap-3 md:w-[7.5rem]">
                <span className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[1.25rem] bg-peach text-[#1d1d1f] transition-[background-color,color,transform] duration-300 group-hover:bg-peach-deep/40 group-hover:text-red group-active:scale-95 md:h-20 md:w-20">
                  <span className="block h-9 w-9 md:h-10 md:w-10">{t.icon}</span>
                </span>
                <span className="text-[0.8125rem] leading-tight text-[#1d1d1f] md:text-[0.875rem]">{t.short}</span>
              </button>
            </li>
          ))}
        </ul>

        {/* search */}
        <form
          role="search"
          className="as-rise mx-auto mt-12 max-w-[42rem] text-left md:mt-16"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label htmlFor="support-search" className="sr-only">
            Search Support
          </label>
          <div className={clsx("as-search flex items-center gap-3 rounded-full border bg-cream px-5 transition-[border-color,box-shadow] duration-300", focused ? "border-[#1d1d1f]/40 shadow-[0_8px_30px_rgba(0,0,0,0.08)]" : "border-black/15")}>
            <span className="block h-5 w-5 shrink-0 text-[#6e6e73]">{ICONS.search}</span>
            <input
              ref={input}
              id="support-search"
              type="search"
              value={query}
              onChange={(e) => change(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => window.setTimeout(() => setFocused(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  if (query) change("");
                  else e.currentTarget.blur();
                } else if (e.key === "ArrowDown" && results.length) {
                  e.preventDefault();
                  setActive((a) => Math.min(results.length - 1, a + 1));
                } else if (e.key === "ArrowUp" && results.length) {
                  e.preventDefault();
                  setActive((a) => Math.max(0, a - 1));
                }
              }}
              placeholder="Search Support"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              aria-describedby="support-search-status"
              className="h-14 w-full bg-transparent text-[1.0625rem] text-[#1d1d1f] outline-none placeholder:text-[#86868b] md:h-16 md:text-[1.1875rem]"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  change("");
                  input.current?.focus();
                }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/[0.08] text-[0.95rem] text-[#1d1d1f] transition-colors hover:bg-black/15"
              >
                ×
              </button>
            )}
          </div>

          <p id="support-search-status" className="sr-only" aria-live="polite">
            {trimmed ? (results.length ? `${results.length} answers found` : "No preloaded answer found") : ""}
          </p>

          {/* quick links while the field is empty and focused */}
          {showQuick && (
            <div className="as-pop mt-3 rounded-[1.25rem] bg-cream p-5 shadow-[0_12px_40px_rgba(0,0,0,0.10)] ring-1 ring-black/5">
              <p className="text-[0.75rem] font-medium text-[#6e6e73]">Quick links</p>
              <ul className="mt-2">
                {POPULAR.slice(0, 4).map((f) => (
                  <li key={f.id}>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => change(f.q)} className="as-quick flex w-full items-center gap-3 rounded-lg py-2 text-left text-[0.9375rem] text-[#1d1d1f] hover:text-red">
                      <span className="block h-4 w-4 shrink-0 text-[#86868b]">{ICONS.search}</span>
                      {f.q}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* live answers */}
          {trimmed && (
            <div className="as-pop mt-3 rounded-[1.25rem] bg-cream px-5 pt-1 pb-4 shadow-[0_12px_40px_rgba(0,0,0,0.10)] ring-1 ring-black/5 md:px-6">
              {results.length ? (
                <div>
                  {results.map((r, i) => (
                    <div key={r.faq.id} className={clsx("rounded-lg", i === active && open !== r.faq.id && "as-active")}>
                      <Answer faq={r.faq} words={r.words} compact open={open === r.faq.id} onToggle={() => setOpen((o) => (o === r.faq.id ? null : r.faq.id))} />
                    </div>
                  ))}
                  <p className="mt-4 text-[0.875rem] text-[#6e6e73]">
                    Not what you need?{" "}
                    <button type="button" className="as-link" onClick={() => onAsk(trimmed)}>
                      Ask AUVOX
                    </button>{" "}
                    or{" "}
                    <a className="as-link" href={mailtoDraft(trimmed)}>
                      email us
                    </a>
                    .
                  </p>
                </div>
              ) : (
                <div className="py-4">
                  <p className="text-[1rem] text-[#1d1d1f]">No preloaded answer for &ldquo;{trimmed}&rdquo;.</p>
                  <p className="mt-1 text-[0.9375rem] text-[#6e6e73]">A real person can answer it. Your question is already written in the email.</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <a className="as-btn as-btn-fill" href={mailtoDraft(trimmed)} onClick={() => onQuery(trimmed)}>
                      Email us
                    </a>
                    <button type="button" className="as-btn as-btn-line" onClick={() => onAsk(trimmed)}>
                      Ask AUVOX
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <p className="mt-4 hidden text-center text-[0.8125rem] text-[#86868b] md:block">
            Tip: press <kbd className="rounded border border-black/15 px-1.5 py-0.5 font-sans text-[0.75rem]">/</kbd> to search from anywhere on this page.
          </p>
        </form>
      </div>
    </section>
  );
}
