import type { Metadata } from "next";
import { VERSE_COPY } from "@/content/packages";
import VersePage from "@/components/sections/Verse/VersePage";

export const metadata: Metadata = {
  title: "Piano Verse — AUVOX Music",
  description: `${VERSE_COPY.piano.body} Piano Core and Piano Complete packages, live classes with AUVOX instructors, Toronto.`,
};

export default function PianoVersePage() {
  return <VersePage verse="piano" />;
}
