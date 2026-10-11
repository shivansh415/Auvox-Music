import type { Metadata } from "next";
import DashboardPage from "@/components/sections/Dashboard/DashboardPage";

export const metadata: Metadata = {
  title: "Student Space — AUVOX Music",
  description: "Everything about your AUVOX journey, in one place.",
};

export default function Dashboard() {
  return <DashboardPage />;
}
