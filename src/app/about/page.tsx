import type { Metadata } from "next";
import AboutPage from "@/components/sections/About/AboutPage";

export const metadata: Metadata = {
  title: "About — AUVOX Music",
  description: "More than lessons: live instruction, structured learning, premium materials and personal guidance in one connected musical world.",
};

export default function Page() {
  return (
    <main>
      <AboutPage />
    </main>
  );
}
