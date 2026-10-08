import Session from "@/components/sections/Session/Session";

export default function Home() {
  return (
    <main>
      <Session />
      {/* Placeholder so the Session has something to hand off to. Real hero comes next. */}
      <section className="relative flex min-h-screen items-center justify-center bg-pearl text-ink">
        <div className="text-center">
          <p className="text-xs font-medium tracking-[0.4em] uppercase opacity-50">Section 3</p>
          <h1 className="font-display mt-4 text-5xl font-semibold">
            Hero coming <span className="text-red">soon</span>
          </h1>
        </div>
      </section>
    </main>
  );
}
