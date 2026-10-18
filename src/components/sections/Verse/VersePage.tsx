"use client";

// A verse page (Guitar Verse / Piano Verse): the scroll showcase (the instrument travelling through
// the verse and its three points), then the packages, the comparison and the close.

import { usePreloaderStore } from "@/store/preloader";
import { useTransitionStore } from "@/store/transition";
import type { Verse } from "@/content/packages";
import VerseShowcase from "./VerseShowcase";
import PackagesBand from "./PackagesBand";
import CompareBand from "./CompareBand";
import ClosingBand from "./ClosingBand";

export default function VersePage({ verse }: { verse: Verse }) {
  // on a direct load the preloader covers the page; on a route change the page curtain does.
  // The showcase's entrance waits until neither is in the way, so it's actually seen.
  const done = usePreloaderStore((s) => s.done);
  const covering = useTransitionStore((s) => s.covering);
  const ready = done && !covering;

  return (
    <main className="verse relative bg-peach text-ink">
      <VerseShowcase key={verse} verse={verse} ready={ready} />
      <PackagesBand verse={verse} />
      <CompareBand verse={verse} />
      <ClosingBand verse={verse} />
    </main>
  );
}
