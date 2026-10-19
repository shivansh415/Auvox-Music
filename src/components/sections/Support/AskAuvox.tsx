"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import Image from "next/image";
import clsx from "clsx";
import { bestAnswer, FAQS, mailtoDraft, type Faq } from "./search";
import { useReveal } from "./reveal";

type Msg = { id: number; role: "user" | "auvox"; text: string; faq?: Faq; miss?: boolean; question?: string };

const GREETING = "Hi! Ask me anything about packages, live classes, your kit or the Frequency Box.";
const MISS = "That one is beyond my preloaded answers, but a person can help. Email us and your question is already in the draft.";
const SUGGEST = [FAQS[1], FAQS[3], FAQS[5], FAQS[11]].filter(Boolean);

/** what the rest of the page can do with the chat */
export type AskHandle = { ask: (q: string) => void; focus: () => void };

function Bubble({ msg }: { msg: Msg }) {
  const user = msg.role === "user";
  return (
    <div className={clsx("as-bubble flex max-w-[86%] flex-col md:max-w-[70%]", user ? "self-end items-end" : "self-start items-start")}>
      <div
        className={clsx(
          "rounded-[1.25rem] px-4 py-2.5 text-[1rem] leading-snug md:text-[1.0625rem]",
          user ? "rounded-br-[0.4rem] bg-red text-white" : "rounded-bl-[0.4rem] bg-cream text-[#1d1d1f]",
        )}
      >
        {msg.faq && <p className="mb-1 text-[0.75rem] font-semibold text-[#6e6e73]">{msg.faq.q}</p>}
        <p>{msg.text}</p>
        {msg.miss && (
          <a href={mailtoDraft(msg.question)} className="as-btn as-btn-fill mt-3 inline-flex">
            Email us
          </a>
        )}
      </div>
    </div>
  );
}

type Props = { onAsk?: (q: string) => void; ref?: Ref<AskHandle> };

/** iMessage-style chat: the typed question becomes a red bubble, the best preloaded answer types back. */
export default function AskAuvox({ onAsk, ref }: Props) {
  const root = useRef<HTMLElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const timer = useRef(0);
  const seq = useRef(1);
  const [messages, setMessages] = useState<Msg[]>([{ id: 0, role: "auvox", text: GREETING }]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const typingRef = useRef(false);
  useReveal(root, ".as-chat", 0.1);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // keep the newest bubble in view (inside the log only, never the page)
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const ask = (raw: string) => {
    const text = raw.trim();
    if (!text || typingRef.current) return;
    const best = bestAnswer(text);
    const userId = seq.current++;
    const replyId = seq.current++;
    setMessages((m) => [...m, { id: userId, role: "user", text }]);
    setDraft("");
    setTyping(true);
    typingRef.current = true;
    onAsk?.(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => {
        setTyping(false);
        typingRef.current = false;
        setMessages((m) => [...m, best ? { id: replyId, role: "auvox", text: best.faq.a, faq: best.faq } : { id: replyId, role: "auvox", text: MISS, miss: true, question: text }]);
      },
      650 + Math.min(900, text.length * 20),
    );
  };

  useImperativeHandle(ref, () => ({ ask, focus: () => field.current?.focus({ preventScroll: true }) }));

  return (
    <section ref={root} id="ask" className="scroll-mt-20 bg-cream py-20 md:py-28" aria-labelledby="ask-title">
      <div className="mx-auto max-w-[1180px] px-6">
        <div className="text-center">
          <h2 id="ask-title" className="as-display text-[2rem] leading-tight font-semibold tracking-[-0.02em] text-[#1d1d1f] md:text-[2.5rem]">
            Ask AUVOX
          </h2>
          <p className="mx-auto mt-3 max-w-[30rem] text-[1.0625rem] text-[#6e6e73]">Type it like you would text us. Anything I can&rsquo;t answer goes to a person.</p>
        </div>

        <div className="as-chat mx-auto mt-10 max-w-[46rem] overflow-hidden rounded-[1.75rem] bg-peach ring-1 ring-black/5">
          {/* header: who you're talking to */}
          <div className="flex items-center gap-3 border-b border-black/[0.06] bg-cream/70 px-5 py-3.5 backdrop-blur md:px-6">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red">
              <Image src="/svg/auvox-logomark.svg" alt="" width={20} height={18} unoptimized className="h-[18px] w-auto brightness-0 invert" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-[0.9375rem] font-semibold text-[#1d1d1f]">AUVOX</span>
              <span className="text-[0.75rem] text-[#6e6e73]">Preloaded answers, instantly</span>
            </span>
          </div>

          <div ref={log} data-lenis-prevent role="log" aria-live="polite" aria-relevant="additions" className="flex h-[24rem] flex-col gap-2.5 overflow-y-auto px-4 py-5 md:h-[26rem] md:px-6">
            {messages.map((m) => (
              <Bubble key={m.id} msg={m} />
            ))}
            {typing && (
              <div className="flex items-center gap-1 self-start rounded-[1.25rem] rounded-bl-[0.4rem] bg-cream px-4 py-3.5" aria-label="AUVOX is typing">
                {[0, 1, 2].map((d) => (
                  <span key={d} className="typing-dot block h-2 w-2 rounded-full bg-[#8e8e93]" />
                ))}
              </div>
            )}
          </div>

          {messages.length === 1 && (
            <ul className="flex gap-2 overflow-x-auto px-4 pb-3 md:flex-wrap md:px-6" aria-label="Suggested questions">
              {SUGGEST.map((f) => (
                <li key={f.id} className="shrink-0">
                  <button type="button" onClick={() => ask(f.q)} className="as-chip whitespace-nowrap">
                    {f.q}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form
            className="flex items-center gap-2 border-t border-black/[0.06] bg-cream/70 px-3 py-3 md:px-4"
            onSubmit={(e) => {
              e.preventDefault();
              ask(draft);
            }}
          >
            <label htmlFor="support-ask" className="sr-only">
              Ask AUVOX a question
            </label>
            <input
              ref={field}
              id="support-ask"
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message"
              autoComplete="off"
              enterKeyHint="send"
              className="h-11 min-w-0 flex-1 rounded-full border border-black/10 bg-cream px-4 text-[1rem] text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus:border-black/25"
            />
            <button
              type="submit"
              aria-label="Send question"
              disabled={!draft.trim() || typing}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red text-white transition-[opacity,transform] duration-300 active:scale-95 disabled:opacity-30"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
