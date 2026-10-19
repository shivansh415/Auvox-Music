import type { Metadata } from "next";
import LoginPage from "@/components/sections/Login/LoginPage";

export const metadata: Metadata = {
  title: "Log in — AUVOX Music",
  description: "Log in to your AUVOX student space: your package, session credits and next live class.",
  robots: { index: false, follow: false },
};

export default function Login() {
  return <LoginPage />;
}
