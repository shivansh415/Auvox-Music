// The Support page's topics (the icon row in the hero and the tabs in "Browse by topic"), their
// line icons, and which preloaded answers belong to each.

import type { ReactNode } from "react";
import { FAQS, type Faq } from "./search";

export type TopicKey = "guitar" | "piano" | "packages" | "classes" | "kit" | "account";
export type Topic = { key: TopicKey; label: string; short: string; tags: string[]; icon: ReactNode };

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const ICONS = {
  guitar: (
    <svg viewBox="0 0 48 48" {...S}>
      <path d="M31 9l8 8M35 13l-9.5 9.5" />
      <path d="M25.5 22.5c-2.6-2.6-7.4-2-10.2.8-1.6 1.6-1.6 3.6-3.4 4.7-2.6 1.5-5 2.4-5 6.4 0 4.2 4.7 8.6 8.6 8.6 4 0 4.9-2.4 6.4-5 1.1-1.8 3.1-1.8 4.7-3.4 2.8-2.8 3.4-7.6.9-10.1z" />
      <circle cx="19" cy="31" r="2.6" />
      <path d="M37.5 8.5l2 2" />
    </svg>
  ),
  piano: (
    <svg viewBox="0 0 48 48" {...S}>
      <rect x="6" y="13" width="36" height="22" rx="3" />
      <path d="M6 22h36M13 22v13M20 22v13M27 22v13M34 22v13" />
      <path d="M16.5 22v6M23.5 22v6M30.5 22v6" strokeWidth={3} />
    </svg>
  ),
  packages: (
    <svg viewBox="0 0 48 48" {...S}>
      <path d="M24 6l15 8v20l-15 8-15-8V14z" />
      <path d="M9 14l15 8 15-8M24 22v20" />
    </svg>
  ),
  classes: (
    <svg viewBox="0 0 48 48" {...S}>
      <rect x="6" y="11" width="26" height="22" rx="4" />
      <path d="M32 19l10-5v20l-10-5" />
      <path d="M14 39h10" />
    </svg>
  ),
  kit: (
    <svg viewBox="0 0 48 48" {...S}>
      <rect x="7" y="17" width="34" height="23" rx="2.5" />
      <path d="M5 11h38v6H5zM24 11v29" />
      <path d="M24 11c-3-6-10-6-9-1.5.6 2.6 6 1.5 9 1.5zM24 11c3-6 10-6 9-1.5-.6 2.6-6 1.5-9 1.5z" />
    </svg>
  ),
  account: (
    <svg viewBox="0 0 48 48" {...S}>
      <circle cx="24" cy="17" r="8" />
      <path d="M9 41c1.6-7.4 7.8-11.5 15-11.5S37.4 33.6 39 41" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 48 48" {...S}>
      <path d="M8 12a5 5 0 015-5h22a5 5 0 015 5v14a5 5 0 01-5 5H21l-8 7v-7a5 5 0 01-5-5z" />
      <path d="M16 18h16M16 24h10" />
    </svg>
  ),
  demo: (
    <svg viewBox="0 0 48 48" {...S}>
      <rect x="7" y="10" width="34" height="31" rx="4" />
      <path d="M7 19h34M16 6v8M32 6v8" />
      <path d="M18 30l4 4 8-8" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 48 48" {...S}>
      <rect x="6" y="11" width="36" height="26" rx="4" />
      <path d="M7 13l17 13 17-13" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" {...S} strokeWidth={1.8}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L20 20" />
    </svg>
  ),
} as const;

export const TOPICS: Topic[] = [
  { key: "guitar", label: "Guitar Verse", short: "Guitar", tags: ["guitar"], icon: ICONS.guitar },
  { key: "piano", label: "Piano Verse", short: "Piano", tags: ["piano"], icon: ICONS.piano },
  { key: "packages", label: "Packages & pricing", short: "Packages", tags: ["packages", "add-ons"], icon: ICONS.packages },
  { key: "classes", label: "Live classes & demo", short: "Classes", tags: ["classes", "demo"], icon: ICONS.classes },
  { key: "kit", label: "Kit & Frequency Box", short: "Your kit", tags: ["kit", "frequency-box"], icon: ICONS.kit },
  { key: "account", label: "Your account", short: "Account", tags: ["dashboard", "support"], icon: ICONS.account },
];

export const faqsFor = (key: TopicKey): Faq[] => {
  const t = TOPICS.find((x) => x.key === key);
  return t ? FAQS.filter((f) => f.tags.some((tag) => t.tags.includes(tag))) : [];
};

/** the answers most people open (shown under "Popular answers" and as quick links in the search) */
export const POPULAR: Faq[] = [1, 0, 11, 3, 14, 5].map((i) => FAQS[i]).filter(Boolean);
