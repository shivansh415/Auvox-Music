"use client";

import { useRef, useState } from "react";
import { Inter } from "next/font/google";
import { useLenis } from "lenis/react";
import SupportHero from "./SupportHero";
import GetHelp from "./GetHelp";
import PopularAnswers from "./PopularAnswers";
import BrowseTopics from "./BrowseTopics";
import AskAuvox, { type AskHandle } from "./AskAuvox";
import StillNeedHelp from "./StillNeedHelp";
import type { TopicKey } from "./topics";

// Apple devices get the real SF Pro (system font); everyone else gets Inter, its closest open cousin.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

/**
 * /support, in the manner of Apple Support: a white page with light grey bands, one big search,
 * topic tiles, help cards, popular answers, every answer by topic, a chat and a way to a person.
 * The last question typed (search or chat) prefills the email drafts.
 */
export default function SupportPage() {
  const lenis = useLenis();
  const [question, setQuestion] = useState<string | undefined>(undefined);
  const [topic, setTopic] = useState<TopicKey>("packages");
  const browse = useRef<HTMLElement>(null);
  const chat = useRef<AskHandle>(null);

  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    // Lenis honours the section's scroll-margin (80px); this lands it just under the header
    if (lenis) lenis.scrollTo(el, { offset: 8, duration: 1.2, force: true });
    else el.scrollIntoView({ behavior: "smooth" });
  };
  const pickTopic = (key: TopicKey) => {
    setTopic(key);
    go("browse");
  };
  const toChat = (q?: string) => {
    go("ask");
    window.setTimeout(() => {
      if (q) chat.current?.ask(q);
      else chat.current?.focus();
    }, 700);
  };

  return (
    <div className={`apple-support ${inter.variable} bg-cream`}>
      <SupportHero onTopic={pickTopic} onAsk={(q) => toChat(q)} onQuery={setQuestion} />
      <GetHelp onChat={() => toChat()} question={question} />
      <PopularAnswers />
      <BrowseTopics ref={browse} topic={topic} onTopic={setTopic} />
      <AskAuvox ref={chat} onAsk={setQuestion} />
      <StillNeedHelp question={question} />
    </div>
  );
}
