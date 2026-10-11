"use client";

// Section 8, page 2 — /reserve. Red page: a ghosted 3D instrument floats on the left (guitar, or
// the keyboard once it is picked), the Free Demo Booking Form sits on the right. Mock submit:
// validate, fold the form away, show the "You're on the list." state.

import dynamic from "next/dynamic";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import clsx from "clsx";
import { gsap, SplitText, useGSAP } from "@/lib/gsap";
import SectionHead from "@/components/ui/SectionHead";
import Button from "@/components/ui/Button";
import { reserve, type DemoInstrument } from "./state";

const ReserveWorld = dynamic(() => import("./ReserveWorld"), { ssr: false });

type Level = "Complete Beginner" | "Beginner" | "Intermediate";
const LEVELS: Level[] = ["Complete Beginner", "Beginner", "Intermediate"];
const INSTRUMENTS: { key: DemoInstrument; word: string; verse: string }[] = [
  { key: "guitar", word: "Guitar", verse: "Guitar Verse" },
  { key: "keyboard", word: "Keyboard", verse: "Piano Verse" },
];

type Form = {
  name: string;
  age: string;
  phone: string;
  email: string;
  instrument: DemoInstrument;
  date: string;
  time: string;
  level: Level | "";
  goals: string;
};
type Errors = Partial<Record<keyof Form, string>>;

const EMPTY: Form = { name: "", age: "", phone: "", email: "", instrument: "guitar", date: "", time: "", level: "", goals: "" };

function validate(f: Form): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = "Please tell us your name";
  const age = Number(f.age);
  if (!f.age.trim()) e.age = "Required";
  else if (!Number.isInteger(age) || age < 4 || age > 99) e.age = "Enter an age between 4 and 99";
  if (!f.phone.trim()) e.phone = "Required";
  else if (f.phone.replace(/\D/g, "").length < 10) e.phone = "Enter a full phone number";
  if (!f.email.trim()) e.email = "Required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = "Enter a valid email address";
  if (!f.date) e.date = "Pick a date";
  if (!f.time) e.time = "Pick a time";
  if (!f.level) e.level = "Pick the one that fits you";
  return e;
}

const prettyDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" });
};
const prettyTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  const d = new Date();
  d.setHours(h, m ?? 0, 0, 0);
  return d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
};

/** Underlined input on red with a floating label. Date/time inputs keep the label floated. */
function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  textarea,
  inputMode,
  autoComplete,
  className,
}: {
  id: keyof Form;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: "text" | "email" | "tel" | "number" | "date" | "time";
  textarea?: boolean;
  inputMode?: "text" | "numeric" | "tel" | "email";
  autoComplete?: string;
  className?: string;
}) {
  const floated = type === "date" || type === "time";
  const cls = clsx(
    "rsv-input peer w-full border-b bg-transparent pt-7 pb-3 text-[1.05rem] text-peach outline-none transition-colors duration-300 placeholder:text-transparent focus:border-tan [color-scheme:dark]",
    error ? "border-tan" : "border-peach/40",
  );
  return (
    <div className={clsx("rsv-field relative", className)} data-floated={floated ? "1" : "0"}>
      {textarea ? (
        <textarea id={id} name={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={label} rows={3} className={clsx(cls, "resize-none")} />
      ) : (
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={label}
          inputMode={inputMode}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          className={cls}
        />
      )}
      <label htmlFor={id} className="rsv-label pointer-events-none absolute top-[1.65rem] left-0 origin-left text-[1.05rem] text-peach/55">
        {label}
      </label>
      <span className={clsx("rsv-error mt-2 block text-[0.6rem] font-semibold tracking-[0.25em] text-tan uppercase transition-opacity duration-300", error ? "opacity-100" : "opacity-0")} aria-live="polite">
        {error ?? " "}
      </span>
    </div>
  );
}

function Chips({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="rsv-field">
      <span className="block text-[0.62rem] font-medium tracking-[0.35em] text-peach/55 uppercase">{label}</span>
      <div className="mt-4 flex flex-wrap gap-2.5">{children}</div>
      <span className={clsx("mt-2 block text-[0.6rem] font-semibold tracking-[0.25em] text-tan uppercase transition-opacity duration-300", error ? "opacity-100" : "opacity-0")} aria-live="polite">
        {error ?? " "}
      </span>
    </div>
  );
}

export default function ReservePage() {
  const root = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [stage, setStage] = useState<"form" | "leaving" | "done">("form");
  const set = (k: keyof Form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };

  // pointer → the 3D rig; the form fields rise in
  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      gsap.fromTo(q(".rsv-in"), { y: 22, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.1, stagger: 0.06, ease: "expo.out", delay: 0.3 });
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const onMove = (e: PointerEvent) => {
        reserve.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        reserve.mouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
      };
      window.addEventListener("pointermove", onMove);
      return () => window.removeEventListener("pointermove", onMove);
    },
    { scope: root },
  );

  // the success state's reveal
  useGSAP(
    () => {
      if (stage !== "done" || !root.current) return;
      const q = gsap.utils.selector(root.current);
      const split = new SplitText(q(".rsv-done-title"), { type: "lines,words", linesClass: "rsv-line" });
      gsap.set(split.lines, { overflow: "hidden", paddingBottom: "0.1em", marginBottom: "-0.1em" });
      gsap
        .timeline({ defaults: { ease: "expo.out" } })
        .fromTo(q(".rsv-done-rule"), { scaleX: 0 }, { scaleX: 1, duration: 1, transformOrigin: "left" }, 0)
        .from(split.words, { yPercent: 110, duration: 1.1, stagger: 0.04 }, 0.1)
        .fromTo(q(".rsv-done-in"), { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.08 }, 0.5)
        .add(() => split.revert());
      return () => split.revert();
    },
    { scope: root, dependencies: [stage] },
  );

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (stage !== "form") return;
    const errs = validate(form);
    setErrors(errs);
    const first = (Object.keys(errs) as (keyof Form)[])[0];
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      gsap.fromTo(formRef.current, { x: -6 }, { x: 0, duration: 0.5, ease: "elastic.out(1, 0.35)" });
      return;
    }
    setStage("leaving");
    gsap.to(formRef.current, { autoAlpha: 0, y: -28, duration: 0.7, ease: "expo.inOut", onComplete: () => setStage("done") });
  };

  const pickedInstrument = INSTRUMENTS.find((i) => i.key === form.instrument) ?? INSTRUMENTS[0];

  return (
    <section ref={root} data-theme="dark" className="rsv relative min-h-[100svh] overflow-clip bg-red text-peach">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_15%_30%,rgba(231,180,126,0.22),transparent_70%),linear-gradient(180deg,rgba(30,30,30,0)_40%,rgba(30,30,30,0.45)_100%)]" />
      <div className="grain pointer-events-none absolute inset-[-50%] opacity-[0.06] mix-blend-screen" />

      <div className="relative mx-auto grid max-w-[1440px] gap-14 px-6 pt-32 pb-24 md:px-12 md:pt-40 md:pb-32 lg:grid-cols-12 lg:gap-10">
        {/* left: ghost instrument + copy (on phones the instrument sits faintly behind the copy) */}
        <div className="relative flex min-h-[26rem] flex-col justify-end lg:col-span-5 lg:block lg:self-start lg:sticky lg:top-28">
          <div className="rsv-world absolute inset-0 opacity-70 lg:relative lg:inset-auto lg:h-[clamp(22rem,52vh,34rem)] lg:opacity-100">
            <ReserveWorld instrument={form.instrument} />
          </div>
          <div className="relative z-10 lg:mt-6">
            <SectionHead as="h1" kicker="Book a free demo" title="Meet your instructor. No commitment." accent="commitment." body="One live session with an AUVOX instructor, on your instrument, at a time that suits you." tone="dark" immediate />
          </div>
        </div>

        {/* right: the form, or the success state */}
        <div className="relative lg:col-span-7 lg:col-start-6">
          {stage !== "done" ? (
            <form ref={formRef} onSubmit={submit} noValidate className="rsv-form">
              <div className="rsv-in flex items-center gap-4">
                <span className="block h-px w-10 bg-peach/50" />
                <span className="text-[0.65rem] font-medium tracking-[0.38em] text-peach/70 uppercase">Free Demo Booking Form</span>
              </div>

              <div className="mt-10 grid gap-x-8 gap-y-6 md:grid-cols-2">
                <Field id="name" label="Full Name" value={form.name} onChange={set("name")} error={errors.name} autoComplete="name" className="rsv-in md:col-span-2" />
                <Field id="age" label="Age" type="number" inputMode="numeric" value={form.age} onChange={set("age")} error={errors.age} className="rsv-in" />
                <Field id="phone" label="Phone Number" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} error={errors.phone} className="rsv-in" />
                <Field id="email" label="Email Address" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} className="rsv-in md:col-span-2" />

                <div className="rsv-in md:col-span-2">
                  <Chips label="Instrument for Demo" error={errors.instrument}>
                    {INSTRUMENTS.map((i) => {
                      const on = form.instrument === i.key;
                      return (
                        <button
                          key={i.key}
                          type="button"
                          aria-pressed={on}
                          onClick={() => set("instrument")(i.key)}
                          className={clsx(
                            "rsv-chip-big flex min-w-[11rem] flex-1 flex-col items-start gap-1 rounded-[1.2rem] border px-6 py-5 text-left transition-colors duration-300",
                            on ? "border-peach bg-peach text-red" : "border-peach/40 text-peach hover:border-peach",
                          )}
                        >
                          <span className="font-display text-[1.7rem] leading-none">{i.word}</span>
                          <span className={clsx("text-[0.58rem] tracking-[0.3em] uppercase", on ? "text-red/70" : "text-peach/55")}>{i.verse}</span>
                        </button>
                      );
                    })}
                  </Chips>
                </div>

                <Field id="date" label="Preferred Date" type="date" value={form.date} onChange={set("date")} error={errors.date} className="rsv-in" />
                <Field id="time" label="Preferred Time" type="time" value={form.time} onChange={set("time")} error={errors.time} className="rsv-in" />

                <div className="rsv-in md:col-span-2">
                  <Chips label="Current Experience Level" error={errors.level}>
                    {LEVELS.map((l) => {
                      const on = form.level === l;
                      return (
                        <button
                          key={l}
                          type="button"
                          aria-pressed={on}
                          onClick={() => set("level")(l)}
                          className={clsx(
                            "rounded-full border px-5 py-3 text-[0.62rem] font-semibold tracking-[0.3em] uppercase transition-colors duration-300",
                            on ? "border-peach bg-peach text-red" : "border-peach/40 text-peach hover:border-peach",
                          )}
                        >
                          {l}
                        </button>
                      );
                    })}
                  </Chips>
                </div>

                <Field id="goals" label="Musical Goals" textarea value={form.goals} onChange={set("goals")} className="rsv-in md:col-span-2" />
              </div>

              <div className="rsv-in mt-8 flex flex-wrap items-center gap-6">
                <Button type="submit" variant="peach" disabled={stage === "leaving"}>
                  Reserve my Free Demo
                </Button>
                <span className="text-sm text-peach/55">Free. No card, no commitment.</span>
              </div>
            </form>
          ) : (
            <div className="rsv-done flex min-h-[60vh] flex-col justify-center">
              <div className="flex items-center gap-4">
                <span className="rsv-done-rule block h-px w-10 bg-peach/50" />
                <span className="rsv-done-in text-[0.65rem] font-medium tracking-[0.38em] text-peach/70 uppercase">Demo reserved</span>
              </div>
              <h2 className="rsv-done-title font-display mt-6 text-[clamp(2.8rem,7vw,7rem)] leading-[1.0] tracking-[-0.015em]">
                You&rsquo;re on the <em className="text-tan not-italic">list.</em>
              </h2>
              <dl className="rsv-done-in mt-10 grid max-w-[36rem] gap-5 border-t border-peach/15 pt-8 sm:grid-cols-3">
                <div>
                  <dt className="text-[0.6rem] tracking-[0.3em] text-peach/55 uppercase">Instrument</dt>
                  <dd className="font-display mt-2 text-2xl">{pickedInstrument.word}</dd>
                </div>
                <div>
                  <dt className="text-[0.6rem] tracking-[0.3em] text-peach/55 uppercase">Date</dt>
                  <dd className="font-display mt-2 text-2xl">{prettyDate(form.date)}</dd>
                </div>
                <div>
                  <dt className="text-[0.6rem] tracking-[0.3em] text-peach/55 uppercase">Time</dt>
                  <dd className="font-display mt-2 text-2xl">{prettyTime(form.time)}</dd>
                </div>
              </dl>
              <p className="rsv-done-in mt-6 max-w-[32rem] text-[1.05rem] leading-relaxed text-peach/75">
                Thanks, {form.name.trim().split(/\s+/)[0]}. An AUVOX instructor will confirm your {pickedInstrument.verse} demo by email shortly.
              </p>
              <div className="rsv-done-in mt-10">
                <Button href="/" variant="peach">
                  Back home
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
