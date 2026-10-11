import type { Metadata } from "next";
import SupportPage from "@/components/sections/Support/SupportPage";

export const metadata: Metadata = {
  title: "Support — AUVOX Music",
  description: "Preloaded answers about AUVOX packages, live classes, your kit and the Frequency Box — or email us directly with a draft ready to send.",
};

export default function Page() {
  return (
    <main>
      <SupportPage />
    </main>
  );
}
