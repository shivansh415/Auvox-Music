import Hero from "@/components/sections/Hero/Hero";
import Session from "@/components/sections/Session/Session";
import VerseUniverse from "@/components/sections/VerseUniverse/VerseUniverse";
import Journey from "@/components/sections/Journey/Journey";
import FrequencyBox from "@/components/sections/FrequencyBox/FrequencyBox";
import Reach from "@/components/sections/Reach/Reach";
import Begin from "@/components/sections/Begin/Begin";
import Seam from "@/components/ui/Seam";
import { SHOWCASE } from "@/lib/showcase";

export default function Home() {
  return (
    <main>
      <Session />
      <Hero />
      <Seam from="var(--auvox-peach)" to="var(--auvox-cream)" />
      <VerseUniverse />
      <Journey />
      {!SHOWCASE && <FrequencyBox />}
      {!SHOWCASE && <Reach />}
      {!SHOWCASE && <Begin />}
    </main>
  );
}
