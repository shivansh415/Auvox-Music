import type { Metadata } from "next";
import PackagesPage from "@/components/sections/Packages/PackagesPage";

export const metadata: Metadata = {
  title: "Packages — AUVOX Music",
  description: "Guitar and Piano Verse packages — Core for the essentials, Complete for the full AUVOX experience. All prices in CAD.",
};

export default function Page() {
  return (
    <main>
      <PackagesPage />
    </main>
  );
}
