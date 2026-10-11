import Hero from "@/components/sections/Hero/Hero";
import Session from "@/components/sections/Session/Session";
import VerseUniverse from "@/components/sections/VerseUniverse/VerseUniverse";
import Journey from "@/components/sections/Journey/Journey";
import FrequencyBox from "@/components/sections/FrequencyBox/FrequencyBox";
import Begin from "@/components/sections/Begin/Begin";

export default function Home() {
  return (
    <main>
      <Session />
      <Hero />
      <VerseUniverse />
      <Journey />
      <FrequencyBox />
      <Begin />
    </main>
  );
}
