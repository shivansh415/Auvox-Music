import type { Metadata } from "next";
import PaymentPage from "@/components/sections/Payment/PaymentPage";

export const metadata: Metadata = {
  title: "Payment — AUVOX Music",
  description: "Almost there — complete your AUVOX enrollment.",
  robots: { index: false, follow: false },
};

export default function Payment() {
  return <PaymentPage />;
}
