// Page-level copy for the verse pages. Headlines, points and the package data come from
// src/content/packages.ts (the client's doc, verbatim); these are the short supporting lines.

import { VERSE_COPY, type Verse } from "@/content/packages";

export const VERSE_NAME: Record<Verse, string> = { guitar: "Guitar", piano: "Piano" };

/** "What you'll learn": one line under each of the client's three points. */
export const LEARN_COPY: Record<Verse, readonly string[]> = {
  guitar: [
    "Start from zero. Your first chords, your first strum, and a clear path from one to the next — no experience needed.",
    "Live classes with AUVOX instructors who play. Real feedback, personal doubt-solving sessions and support beyond the session.",
    "Find your tone and your rhythm. Learn the songs you genuinely love, then play them the way only you can.",
  ],
  piano: [
    "A structured path from your first notes to full pieces, one clear stage at a time, with a live instructor beside you.",
    "Posture, touch and both hands together. Learn to hear what you play and let the keys carry every musical idea.",
    "From simple melodies to timeless compositions — pieces you will keep coming back to, long after the course.",
  ],
};

/** The closing marquee: verse name, the three points, and the academy. */
export const marqueeItems = (verse: Verse) => [`${VERSE_NAME[verse]} Verse`, ...VERSE_COPY[verse].points.map((p) => p.replace(/\.$/, "")), "Toronto", "AUVOX Music"];
