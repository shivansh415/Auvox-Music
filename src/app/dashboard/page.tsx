import type { Metadata } from "next";
import DashboardPage from "@/components/sections/Dashboard/DashboardPage";

export const metadata: Metadata = {
  title: "Student Space — AUVOX Music",
  description: "Everything about your AUVOX journey, in one place.",
  // a personal page: keep it out of search results
  robots: { index: false, follow: false },
};

export default function Dashboard() {
  return <DashboardPage />;
}
