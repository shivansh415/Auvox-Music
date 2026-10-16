"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import SectionHead from "@/components/ui/SectionHead";
import Button from "@/components/ui/Button";
import { bestAnswer, FAQS, mailtoDraft, type Faq } from "./search";
import { useReveal } from "./reveal";

type Msg = { id: number; role: "user" | "auvox"; text: string; faq?: Faq; miss?: boolean; question?: string };

const GREETING = "Hi — ask me anything about packages, live classes, your kit or the Frequency Box.";
const MISS = "That's beyond my preloaded answers, but a human isn't. Email us and we'll reply personally — your question is already in the draft.";
const SUGGEST = [FAQS[1], FAQS[3], FAQS[5]];

function Bubble({ msg }: { msg: Msg }) {
  const user = msg.role === "user";
  return (
    <div className={clsx("support-bubble flex max-w-[92%] flex-col gap-1.5 md:max-w-[76%]", user ? "is-user self-end items-end" : "self-start items-start")}>
      {!user && (
        <span className="flex items-center gap-2 pl-1 text-[0.6rem] font-medium tracking-[0.3em] text-ink/55 uppercase">
          <span className="block h-1.5 w-1.5 rounded-full bg-red" aria-hidden="true" />
          AUVOX
        </span>
      )}
      <div className={clsx("rounded-[1.4rem] px-5 py-3.5 text-[1.02rem] leading-relaxed", user ? "rounded-br-md bg-ink text-peach" : "rounded-bl-md bg-peach text-ink")}>
        {msg.faq && <p className="mb-1.5 text-[0.62rem] font-medium tracking-[0.25em] text-ink/55 uppercase">{msg.faq.q}</p>}
        <p>{msg.text}</p>
        {msg.miss && (
          <div className="mt-4">
            <Button href={mailtoDraft(msg.question)} variant="red" size="sm">
              Email us
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

type Props = { onAsk?: (q: string) => void };

/** Chat-style box: the typed question becomes a user bubble, the best preloaded answer types back. */
export default function AskAuvox({ onAsk }: Props) {
  const root = useRef<HTMLElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const timer = useRef(0);
  const seq = useRef(1);
  const [messages, setMessages] = useState<Msg[]>([{ id: 0, role: "auvox", text: GREETING }]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  useReveal(root, ".support-chat", 0.1);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // keep the newest bubble in view
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const ask = (raw: string) => {
    const text = raw.trim();
    if (!text || typing) return;
    const best = bestAnswer(text);
    const userId = seq.current++;
    const replyId = seq.current++;
    setMessages((m) => [...m, { id: userId, role: "user", text }]);
    setDraft("");
    setTyping(true);
    onAsk?.(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => {
        setTyping(false);
        setMessages((m) => [...m, best ? { id: replyId, role: "auvox", text: best.faq.a, faq: best.faq } : { id: replyId, role: "auvox", text: MISS, miss: true, question: text }]);
      },
      700 + Math.min(900, text.length * 22),
    );
  };

  return (
    <section ref={root} className="bg-peach py-24 md:py-36" aria-label="Ask AUVOX">
      <div className="mx-auto max-w-[1440px] px-6 md:px-12">
        <div className="grid gap-12 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16">
          <SectionHead
            kicker="Ask AUVOX"
            title="Type it like you'd text us."
            accent="us."
            body="Preloaded answers, instantly. Anything beyond them goes straight to a human by email — with your question already written."
            size="md"
            className="md:sticky md:top-32 md:self-start"
          />

          <div className="support-chat relative overflow-hidden rounded-[1.75rem] bg-cream opacity-0">
            <div className="grain pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-multiply" aria-hidden="true" />
            <div className="relative flex items-center justify-between border-b border-ink/10 px-5 py-4 md:px-7">
              <span className="text-[0.65rem] font-medium tracking-[0.38em] text-ink/70 uppercase">Ask AUVOX</span>
              <span className="flex items-center gap-2 text-[0.62rem] tracking-[0.25em] text-ink/55 uppercase">
                <span className="block h-1.5 w-1.5 rounded-full bg-red" aria-hidden="true" />
                Preloaded answers
              </span>
            </div>

            <div ref={log} data-lenis-prevent role="log" aria-live="polite" aria-relevant="additions" className="support-log relative flex max-h-[28rem] min-h-[20rem] flex-col gap-4 overflow-y-auto px-5 py-6 md:px-7">
              {messages.map((m) => (
                <Bubble key={m.id} msg={m} />
              ))}
              {typing && (
                <div className="support-bubble flex items-center gap-1.5 self-start rounded-[1.4rem] rounded-bl-md bg-peach px-5 py-4" aria-label="AUVOX is typing">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="typing-dot block h-1.5 w-1.5 rounded-full bg-ink" />
                  ))}
                </div>
              )}
            </div>

            {messages.length === 1 && (
              <ul className="relative flex flex-wrap gap-2 px-5 pb-4 md:px-7" aria-label="Suggested questions">
                {SUGGEST.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => ask(f.q)}
                      className="rounded-full border border-ink/20 px-3.5 py-1.5 text-left text-[0.8rem] text-ink/80 transition-colors duration-300 hover:border-ink hover:bg-ink hover:text-peach"
                    >
                      {f.q}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form
              className="relative flex items-center gap-3 border-t border-ink/10 px-5 py-4 md:px-7"
              onSubmit={(e) => {
                e.preventDefault();
                ask(draft);
              }}
            >
              <label htmlFor="support-ask" className="sr-only">
                Ask AUVOX a question
              </label>
              <input
                id="support-ask"
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask a question…"
                autoComplete="off"
                enterKeyHint="send"
                className="min-w-0 flex-1 bg-transparent py-2 text-[1.05rem] text-ink placeholder:text-ink/40 outline-none"
              />
              <button
                type="submit"
                aria-label="Send question"
                disabled={!draft.trim() || typing}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-peach transition-colors duration-300 hover:bg-red disabled:opacity-40"
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  ↑
                </span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
