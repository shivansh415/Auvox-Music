"use client";

import { useRef } from "react";
import SectionHead from "@/components/ui/SectionHead";
import Button from "@/components/ui/Button";
import { CONTACT_EMAIL } from "@/content/packages";
import { mailtoDraft } from "./search";
import { useReveal } from "./reveal";

type Props = { question?: string };

/** Closing band on ink: email draft (with the last typed question) or reserve a demo. */
export default function StillStuck({ question }: Props) {
  const root = useRef<HTMLElement>(null);
  useReveal(root, ".support-stuck", 0.12);

  return (
    <section ref={root} data-theme="dark" className="relative isolate overflow-hidden bg-ink py-24 text-peach md:py-36" aria-label="Still stuck?">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_80%_at_85%_20%,rgba(133,9,9,0.55),rgba(30,30,30,0)_70%)]" aria-hidden="true" />
      <div className="grain pointer-events-none absolute inset-[-50%] -z-10 opacity-[0.06] mix-blend-screen" aria-hidden="true" />

      <div className="mx-auto max-w-[1440px] px-6 md:px-12">
        <div className="grid gap-12 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-end md:gap-16">
          <div>
            <SectionHead tone="dark" kicker="Still stuck?" title="A human is one email away." accent="away." body="Send the draft and we'll reply personally. Or skip the inbox and meet an instructor on a free demo." />
            <div className="support-stuck mt-10 flex flex-wrap gap-4 opacity-0">
              <Button href={mailtoDraft(question)} variant="peach">
                Email us
              </Button>
              <Button href="/reserve" variant="red">
                Reserve a free demo
              </Button>
            </div>
          </div>

          <div className="support-stuck rounded-[1.5rem] border border-peach/15 bg-peach/[0.04] p-6 opacity-0 md:p-8" aria-label="Email draft preview">
            <p className="text-[0.62rem] font-medium tracking-[0.35em] text-peach/55 uppercase">Draft · ready to send</p>
            <dl className="mt-5 space-y-3 text-[0.95rem]">
              <div className="flex gap-4 border-b border-peach/10 pb-3">
                <dt className="w-16 shrink-0 text-peach/50">To</dt>
                <dd className="text-peach">{CONTACT_EMAIL}</dd>
              </div>
              <div className="flex gap-4 border-b border-peach/10 pb-3">
                <dt className="w-16 shrink-0 text-peach/50">Subject</dt>
                <dd className="text-peach">Support request</dd>
              </div>
              <div className="flex gap-4">
                <dt className="w-16 shrink-0 text-peach/50">Body</dt>
                <dd className="text-peach/80">
                  Hi AUVOX,
                  <br />
                  {question ? (
                    <>
                      My question: <span className="text-tan">{question}</span>
                    </>
                  ) : (
                    <span className="text-peach/50">I have a question about…</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
