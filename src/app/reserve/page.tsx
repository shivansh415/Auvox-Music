import type { Metadata } from "next";
import ReservePage from "@/components/sections/Reserve/ReservePage";

export const metadata: Metadata = {
  title: "Reserve a free demo — AUVOX Music",
  description: "Meet an AUVOX instructor in a free live demo on guitar or keyboard. No commitment.",
};

export default function Page() {
  return (
    <main>
      <ReservePage />
    </main>
  );
}
