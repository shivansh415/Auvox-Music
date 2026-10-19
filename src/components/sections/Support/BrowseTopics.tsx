"use client";

import { forwardRef, useState } from "react";
import clsx from "clsx";
import Answer from "./Answer";
import { faqsFor, TOPICS, type TopicKey } from "./topics";

type Props = { topic: TopicKey; onTopic: (key: TopicKey) => void };

/** Every preloaded answer, a topic at a time: a segmented control over an Apple-style list. */
const BrowseTopics = forwardRef<HTMLElement, Props>(function BrowseTopics({ topic, onTopic }, ref) {
  const [open, setOpen] = useState<string | null>(null);
  const current = TOPICS.find((t) => t.key === topic)!;
  const items = faqsFor(topic);
  return (
    <section ref={ref} id="browse" className="scroll-mt-20 bg-peach py-20 md:py-28" aria-labelledby="browse-title">
      <div className="mx-auto max-w-[1180px] px-6">
        <h2 id="browse-title" className="as-display text-[2rem] leading-tight font-semibold tracking-[-0.02em] text-[#1d1d1f] md:text-[2.5rem]">
          Browse by topic
        </h2>

        <div className="as-seg-wrap mt-8 -mx-6 overflow-x-auto px-6 md:mx-0 md:px-0">
          <div role="tablist" aria-label="Topics" className="as-seg inline-flex gap-1 rounded-full bg-black/[0.06] p-1">
            {TOPICS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={t.key === topic}
                onClick={() => {
                  onTopic(t.key);
                  setOpen(null);
                }}
                className={clsx(
                  "rounded-full px-4 py-2 text-[0.875rem] whitespace-nowrap transition-[background-color,color,box-shadow] duration-300 md:px-5",
                  t.key === topic ? "bg-cream font-medium text-[#1d1d1f] shadow-[0_2px_8px_rgba(0,0,0,0.08)]" : "text-[#424245] hover:text-[#1d1d1f]",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div role="tabpanel" aria-label={current.label} className="mt-8 grid gap-10 rounded-[1.5rem] bg-cream p-6 md:mt-10 md:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)] md:p-10">
          <div>
            <span className="block h-12 w-12 text-red">{current.icon}</span>
            <h3 className="as-display mt-5 text-[1.5rem] leading-tight font-semibold tracking-[-0.015em] text-[#1d1d1f]">{current.label}</h3>
            <p className="mt-2 text-[0.9375rem] text-[#6e6e73]">
              {items.length} {items.length === 1 ? "answer" : "answers"}
            </p>
          </div>
          <div className="border-t border-black/10">
            {items.map((f) => (
              <Answer key={f.id} faq={f} open={open === f.id} onToggle={() => setOpen((o) => (o === f.id ? null : f.id))} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
});

export default BrowseTopics;
