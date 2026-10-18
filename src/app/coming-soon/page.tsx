import type { Metadata } from "next";
import Button from "@/components/ui/Button";

export const metadata: Metadata = { title: "Coming soon — AUVOX Music", robots: { index: false } };

/** Where the preview build sends the pages that are still being built. */
export default function ComingSoon() {
  return (
    <main className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-clip bg-peach px-6 text-center text-ink">
      <div className="grain pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-multiply" />
      <span className="text-[0.65rem] font-medium tracking-[0.38em] text-ink/60 uppercase">Preview build</span>
      <h1 className="font-display mt-5 text-[clamp(2.6rem,7vw,6rem)] leading-[1.0]">
        This verse is still being <em className="text-red not-italic">written.</em>
      </h1>
      <p className="mt-6 max-w-[30rem] text-ink/70">This page is in the studio right now. The full AUVOX experience arrives with the final version.</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Button href="/">Back home</Button>
      </div>
    </main>
  );
}
