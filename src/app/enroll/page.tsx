import type { Metadata } from "next";
import EnrollPage from "@/components/sections/Enroll/EnrollPage";

export const metadata: Metadata = {
  title: "Enroll — AUVOX Music",
  description: "Set up your verse: choose your package, your add-ons and where your AUVOX Kit ships.",
};

export default function Enroll() {
  return <EnrollPage />;
}
