"use client";

import { useRef } from "react";
import TransitionLink from "@/components/ui/TransitionLink";
import { useReveal } from "./reveal";
import { mailtoDraft } from "./search";
import { ICONS } from "./topics";

type Props = { onChat: () => void; question?: string };

const Card = ({ icon, title, body, cta }: { icon: React.ReactNode; title: string; body: string; cta: string }) => (
  <>
    <span className="block h-11 w-11 text-red">{icon}</span>
    <span className="mt-6 block text-[1.3125rem] leading-tight font-semibold tracking-[-0.015em] text-[#1d1d1f]">{title}</span>
    <span className="mt-2 block text-[0.9375rem] leading-relaxed text-[#6e6e73]">{body}</span>
    <span className="as-link mt-auto inline-flex items-center gap-1 pt-6 text-[0.9375rem]">
      {cta}
      <span aria-hidden>›</span>
    </span>
  </>
);

const CARD = "as-card as-help flex min-h-[16.5rem] flex-col rounded-[1.5rem] bg-white p-7 text-left transition-[transform,box-shadow] duration-500 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] md:p-8";

/** Four ways to get help, as Apple-style cards on a light grey band. */
export default function GetHelp({ onChat, question }: Props) {
  const root = useRef<HTMLElement>(null);
  useReveal(root, ".as-help", 0.08);
  return (
    <section ref={root} className="bg-[#f5f5f7] py-20 md:py-28" aria-labelledby="get-help-title">
      <div className="mx-auto max-w-[1180px] px-6">
        <h2 id="get-help-title" className="as-display text-[2rem] leading-tight font-semibold tracking-[-0.02em] text-[#1d1d1f] md:text-[2.5rem]">
          Get help
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 md:mt-10 lg:grid-cols-4 lg:gap-5">
          <button type="button" onClick={onChat} className={CARD}>
            <Card icon={ICONS.chat} title="Ask AUVOX" body="Instant answers to the questions we hear most, in a chat." cta="Start a chat" />
          </button>
          <TransitionLink href="/reserve" className={CARD}>
            <Card icon={ICONS.demo} title="Book a free demo" body="Meet an instructor and try a live class before you choose." cta="Reserve a demo" />
          </TransitionLink>
          <a href={mailtoDraft(question)} className={CARD}>
            <Card icon={ICONS.mail} title="Email us" body="A real person replies. Your question is already written in the draft." cta="Write to us" />
          </a>
          <TransitionLink href="/dashboard" className={CARD}>
            <Card icon={ICONS.account} title="Student space" body="Your package, session credits, class time and renewal." cta="Open dashboard" />
          </TransitionLink>
        </div>
      </div>
    </section>
  );
}
