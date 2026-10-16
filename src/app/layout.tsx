import type { Metadata } from "next";
import { Afacad_Flux, DM_Serif_Display } from "next/font/google";
import SmoothScroll from "@/components/providers/SmoothScroll";
import PageTransition from "@/components/providers/PageTransition";
import Preloader from "@/components/preloader/Preloader";
import Header from "@/components/ui/Header";
import Footer from "@/components/ui/Footer";
import ScrollCue from "@/components/ui/ScrollCue";
import "./globals.css";

const afacadFlux = Afacad_Flux({
  variable: "--font-afacad-flux",
  subsets: ["latin"],
});

// stand-in for the licensed display face (Tan Pearl) until its files arrive
const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  // set NEXT_PUBLIC_SITE_URL on Vercel so share images resolve to the real domain
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://auvoxmusic.com"),
  title: "AUVOX Music — Every instrument has a voice",
  description: "Live instruction, structured learning, premium materials and personal guidance — one connected musical world. Guitar Verse and Piano Verse, Toronto.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${afacadFlux.variable} ${dmSerif.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-peach font-sans text-ink">
        <SmoothScroll>
          <Preloader />
          <Header />
          {children}
          <Footer />
          <PageTransition />
          <ScrollCue />
        </SmoothScroll>
      </body>
    </html>
  );
}
