import { Fragment } from "react";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Wraps every occurrence of `words` in `text` with a tan <mark>. */
export default function Highlight({ text, words }: { text: string; words: string[] }) {
  if (!words.length) return <>{text}</>;
  const sorted = [...words].sort((a, b) => b.length - a.length).map(escape);
  const parts = text.split(new RegExp(`(${sorted.join("|")})`, "gi"));
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}
