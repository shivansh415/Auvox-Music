import Button from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-clip bg-peach px-6 text-center text-ink">
      <div className="grain pointer-events-none absolute inset-[-50%] opacity-[0.04] mix-blend-multiply" />
      <span className="text-[0.65rem] font-medium tracking-[0.38em] text-ink/60 uppercase">404</span>
      <h1 className="font-display mt-5 text-[clamp(2.6rem,7vw,6rem)] leading-[1.0]">
        This verse hasn&apos;t been <em className="text-red not-italic">written.</em>
      </h1>
      <p className="mt-6 max-w-[28rem] text-ink/70">The page you were looking for isn&apos;t here. Head back and find your voice.</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Button href="/">Back home</Button>
        <Button href="/support" variant="outline">Support</Button>
      </div>
    </main>
  );
}
