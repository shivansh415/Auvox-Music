// Preloaded-answer matching for the Support page. Pure functions — safe to call from useMemo and handlers.

import { CONTACT_EMAIL, SUPPORT_FAQ } from "@/content/packages";

export type Faq = (typeof SUPPORT_FAQ)[number] & { id: string };

export const FAQS: Faq[] = SUPPORT_FAQ.map((f, i) => ({ ...f, id: `faq-${i + 1}` }));

/** Words that carry no meaning for matching ("what is the…"). */
const STOP = new Set([
  "a", "an", "and", "any", "are", "as", "at", "be", "but", "by", "can", "did", "do", "does", "for", "from", "get", "have", "how", "i", "if", "im", "in", "is", "it", "its",
  "me", "my", "of", "on", "or", "so", "the", "there", "this", "to", "we", "what", "whats", "when", "where", "which", "who", "why", "will", "with", "you", "your",
]);

/** Very light stemming so "classes" finds "class" and "packages" finds "package". */
const stem = (w: string) => {
  if (w.length > 5 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s")) return w.slice(0, -1);
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  return w;
};

export const tokenize = (s: string): string[] => {
  const words = s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP.has(w))
    .map(stem);
  return [...new Set(words)];
};

export type Match = { faq: Faq; score: number; words: string[] };

/**
 * Fuzzy-ish: lowercase `includes` per word. Question hits weigh most, tags next, answer least.
 * Returns matches sorted by score (best first). Empty query → no matches.
 */
export function matchFaqs(query: string, limit = Infinity): Match[] {
  const words = tokenize(query);
  if (!words.length) return [];
  const out: Match[] = [];
  for (const faq of FAQS) {
    const q = faq.q.toLowerCase();
    const a = faq.a.toLowerCase();
    const t = faq.tags.join(" ").toLowerCase();
    let score = 0;
    const hits: string[] = [];
    for (const w of words) {
      let s = 0;
      if (q.includes(w)) s += 3;
      if (t.includes(w)) s += 2;
      if (a.includes(w)) s += 1;
      if (s) {
        score += s;
        hits.push(w);
      }
    }
    if (!score) continue;
    if (hits.length === words.length) score += 2; // every word landed
    out.push({ faq, score, words: hits });
  }
  out.sort((x, y) => y.score - x.score);
  return out.slice(0, limit);
}

/** The single best preloaded answer, or null when the question is out of scope. */
export function bestAnswer(query: string): Match | null {
  const [best] = matchFaqs(query, 1);
  return best && best.score >= 3 ? best : null;
}

/** Human labels for the FAQ tags (accordion groups). */
export const TAG_LABEL: Record<string, string> = {
  packages: "Packages",
  "add-ons": "Add-ons",
  classes: "Live classes",
  demo: "Free demo",
  "frequency-box": "The Frequency Box",
  kit: "Your AUVOX Kit",
  dashboard: "Dashboard",
  support: "Support",
  guitar: "Guitar",
  piano: "Piano",
};

export type Group = { tag: string; label: string; items: Faq[] };

/** FAQs grouped by their primary tag, in first-seen order. */
export const GROUPS: Group[] = (() => {
  const map = new Map<string, Faq[]>();
  for (const f of FAQS) {
    const tag = f.tags[0] ?? "support";
    const list = map.get(tag);
    if (list) list.push(f);
    else map.set(tag, [f]);
  }
  return [...map].map(([tag, items]) => ({ tag, label: TAG_LABEL[tag] ?? tag, items }));
})();

/** A ready-to-send email draft. The typed question lands in the body. */
export function mailtoDraft(question?: string): string {
  const q = question?.trim();
  const body = ["Hi AUVOX,", "", q ? `My question: ${q}` : "I have a question about…", "", "Thanks,", ""].join("\n");
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Support request")}&body=${encodeURIComponent(body)}`;
}
