import type { Metadata } from "next";
import { Afacad_Flux } from "next/font/google";
import SmoothScroll from "@/components/providers/SmoothScroll";
import Preloader from "@/components/preloader/Preloader";
import "./globals.css";

const afacadFlux = Afacad_Flux({
  variable: "--font-afacad-flux",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AUVOX Music",
  description: "AUVOX Music",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${afacadFlux.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <SmoothScroll>
          <Preloader />
          {children}
        </SmoothScroll>
      </body>
    </html>
  );
}
