import type { Metadata } from "next";
import localFont from "next/font/local";
import SmoothScroll from "@/components/providers/SmoothScroll";
import PageTransition from "@/components/providers/PageTransition";
import Preloader from "@/components/preloader/Preloader";
import Header from "@/components/ui/Header";
import Footer from "@/components/ui/Footer";
import ScrollCue from "@/components/ui/ScrollCue";
import "./globals.css";

// The faces are self-hosted (src/app/fonts, the latin woff2 of each, all under the SIL Open Font
// License): next/font/google downloads at build time and silently swaps in a fallback when it
// cannot reach Google — a dev server started on a flaky connection showed the swash Y in Georgia.
const afacadFlux = localFont({
  src: "./fonts/afacad-flux.woff2",
  variable: "--font-afacad-flux",
  weight: "100 1000",
});

// the Support page's system-style face on non-Apple devices. Declared here (not on the page) so no
// route carries its own CSS chunk: the home page prefetches /support and Chrome would warn about the
// preloaded, unused stylesheet. The font file itself only downloads where the face is used.
const inter = localFont({ src: "./fonts/inter.woff2", variable: "--font-inter", weight: "100 900", display: "swap", preload: false });

// stand-in for the licensed display face (Tan Pearl) until its files arrive
const dmSerif = localFont({
  src: [
    { path: "./fonts/dm-serif-display.woff2", weight: "400", style: "normal" },
    { path: "./fonts/dm-serif-display-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-dm-serif",
});

// a calligraphic swash, for the single capital that opens a line of display type
const pinyon = localFont({
  src: "./fonts/pinyon-script.woff2",
  variable: "--font-pinyon",
  weight: "400",
});

export const metadata: Metadata = {
  // set NEXT_PUBLIC_SITE_URL on Vercel so share images resolve to the real domain
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://auvoxmusic.com"),
  title: "AUVOX Music — Every instrument has a voice",
  description: "Live instruction, structured learning, premium materials and personal guidance — one connected musical world. Guitar Verse and Piano Verse, Toronto.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${afacadFlux.variable} ${dmSerif.variable} ${pinyon.variable} ${inter.variable} h-full antialiased`}>
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
