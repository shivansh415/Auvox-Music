import type { Metadata } from "next";
import { Afacad_Flux, DM_Serif_Display, Inter, Pinyon_Script } from "next/font/google";
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

// the Support page's system-style face on non-Apple devices. Declared here (not on the page) so no
// route carries its own CSS chunk: the home page prefetches /support and Chrome would warn about the
// preloaded, unused stylesheet. The font files themselves only download where the face is used.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap", preload: false });

// stand-in for the licensed display face (Tan Pearl) until its files arrive
const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

// a calligraphic swash, for the single capital that opens a line of display type
const pinyon = Pinyon_Script({
  variable: "--font-pinyon",
  subsets: ["latin"],
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
