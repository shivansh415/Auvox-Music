import type { Metadata } from "next";
import { VERSE_COPY } from "@/content/packages";
import VersePage from "@/components/sections/Verse/VersePage";

export const metadata: Metadata = {
  title: "Guitar Verse — AUVOX Music",
  description: `${VERSE_COPY.guitar.body} Guitar Core and Guitar Complete packages, live classes with AUVOX instructors, Toronto.`,
};

export default function GuitarVersePage() {
  return <VersePage verse="guitar" />;
}
