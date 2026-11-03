import type { Metadata } from "next";
import localFont from "next/font/local";
import SmoothScroll from "@/components/providers/SmoothScroll";
import PageTransition from "@/components/providers/PageTransition";
import Preloader from "@/components/preloader/Preloader";
import Header from "@/components/ui/Header";
import CloseButton from "@/components/ui/CloseButton";
import Footer from "@/components/ui/Footer";
import ScrollCue from "@/components/ui/ScrollCue";
import "./globals.css";

// The faces are self-hosted (src/app/fonts, the latin woff2 of each, all under the SIL Open Font
// License): next/font/google downloads at build time and silently swaps in a fallback when it
// cannot reach Google — a dev server started on a flaky connection showed a fallback face.
const afacadFlux = localFont({
  src: "./fonts/afacad-flux.woff2",
  variable: "--font-afacad-flux",
  weight: "100 1000",
});


// stand-in for the licensed display face (Tan Pearl) until its files arrive
const dmSerif = localFont({
  src: [
    { path: "./fonts/dm-serif-display.woff2", weight: "400", style: "normal" },
    { path: "./fonts/dm-serif-display-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-dm-serif",
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
          <CloseButton />
          {children}
          <Footer />
          <PageTransition />
          <ScrollCue />
        </SmoothScroll>
      </body>
    </html>
  );
}
