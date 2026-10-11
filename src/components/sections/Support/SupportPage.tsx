"use client";

import { useState } from "react";
import SupportHero from "./SupportHero";
import VerseTiles from "./VerseTiles";
import QuickLinks from "./QuickLinks";
import AskAuvox from "./AskAuvox";
import FaqAccordion from "./FaqAccordion";
import StillStuck from "./StillStuck";

/** /support — the whole page. The last question typed (search or chat) prefills the email draft at the end. */
export default function SupportPage() {
  const [question, setQuestion] = useState<string | undefined>(undefined);
  return (
    <div className="support">
      <SupportHero onQuery={setQuestion} />
      <VerseTiles />
      <QuickLinks />
      <AskAuvox onAsk={setQuestion} />
      <FaqAccordion />
      <StillStuck question={question} />
    </div>
  );
}
