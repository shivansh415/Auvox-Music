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

/** The showcase's big word per chapter: the verse, then one word for each of the client's three points. */
export const SHOWCASE_WORDS: Record<Verse, readonly string[]> = {
  guitar: ["Guitar", "Begin", "Guided", "Sound"],
  piano: ["Piano", "Stages", "Touch", "Timeless"],
};

/**
 * Where the instrument sits in each chapter, on wide screens: offset from the centre (x in vw, y in
 * vh), a small turn (deg) and the box its render fits in (h in vh, w in vw). It alternates sides; the
 * copy takes the other half. Renders: public/verse/<verse>-<chapter>.webp (Blender, transparent).
 */
export type Pose = { x: number; y: number; r: number; h: number; w: number };
export const SHOWCASE_POSES: Record<Verse, readonly Pose[]> = {
  guitar: [
    { x: 21, y: 2, r: 0, h: 86, w: 40 },
    { x: -22, y: 2, r: -3, h: 88, w: 36 },
    { x: 21, y: 0, r: 3, h: 72, w: 44 },
    { x: -20, y: 4, r: -2, h: 32, w: 46 },
  ],
  piano: [
    { x: 21, y: 4, r: 0, h: 50, w: 44 },
    { x: -21, y: 2, r: 0, h: 50, w: 44 },
    { x: 21, y: 0, r: 2, h: 60, w: 40 },
    { x: -21, y: 4, r: -2, h: 50, w: 44 },
  ],
};
