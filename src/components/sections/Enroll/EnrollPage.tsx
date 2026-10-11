"use client";

import { Suspense, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { PACKAGES, packageById, type Package } from "@/content/packages";
import { useTransition } from "@/store/transition";
import SectionHead from "@/components/ui/SectionHead";
import Button from "@/components/ui/Button";
import { Chips, Field } from "./fields";
import {
  CLASS_TIMES,
  DEFAULT_PACKAGE_ID,
  EMPTY_STUDENT,
  TSHIRT_SIZES,
  activeAddOns,
  money,
  parseEnrollment,
  saveEnrollment,
  totalFor,
  useClientSnapshot,
  type Enrollment,
  type Student,
} from "./enrollment";

/* ---------------------------------------------------------------- page */

export default function EnrollPage() {
  return (
    <main className="relative overflow-hidden bg-peach text-ink">
      <div className="grain pointer-events-none absolute inset-[-50%] opacity-[0.04] mix-blend-multiply" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_100%_0%,rgba(231,180,126,0.45),transparent_70%)]" />
      <div className="relative mx-auto max-w-[1440px] px-6 pt-32 pb-24 md:px-12 md:pt-44 md:pb-36">
        <SectionHead
          as="h1"
          immediate
          kicker="Enrollment"
          title="Let's set up your verse."
          accent="verse."
          body="A few details, your package and where the Frequency Box ships. Payment comes on the next step."
        />
        <Suspense fallback={null}>
          <EnrollInner />
        </Suspense>
      </div>
    </main>
  );
}

/** reads `?package=` and the saved enrollment; re-keys the form once the client snapshot is in */
function EnrollInner() {
  const params = useSearchParams();
  const snap = useClientSnapshot();
  const saved = parseEnrollment(snap?.raw);
  const fromUrl = packageById(params.get("package") ?? "")?.id;
  const initialPackage = fromUrl ?? saved?.packageId ?? DEFAULT_PACKAGE_ID;
  return <EnrollBody key={snap ? "client" : "server"} saved={saved} initialPackage={initialPackage} />;
}

/* ---------------------------------------------------------------- form state */

type FormState = Student & { packageId: Package["id"]; addOns: string[] };
type Errors = Partial<Record<keyof Student, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(f: FormState): Errors {
  const e: Errors = {};
  if (f.name.trim().length < 2) e.name = "Please enter the student's full name.";
  const age = Number(f.age);
  if (!f.age.trim() || !Number.isInteger(age) || age < 4 || age > 99) e.age = "Enter an age between 4 and 99.";
  if (f.phone.replace(/\D/g, "").length < 10) e.phone = "Enter a phone number we can reach you on.";
  if (!EMAIL.test(f.email.trim())) e.email = "Enter a valid email address.";
  if (!f.tshirt) e.tshirt = "Pick a T-shirt size for the kit.";
  if (f.city.trim().length < 2) e.city = "Which city should the kit ship to?";
  if (f.address.trim().length < 8) e.address = "Enter the complete shipping address.";
  if (!f.classTime) e.classTime = "Choose a preferred class time.";
  return e;
}

const FIELD_ORDER: (keyof Student)[] = ["name", "age", "phone", "email", "tshirt", "city", "address", "classTime", "notes"];

function EnrollBody({ saved, initialPackage }: { saved: Enrollment | null; initialPackage: Package["id"] }) {
  const go = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<FormState>(() => ({ ...EMPTY_STUDENT, ...saved?.student, packageId: initialPackage, addOns: saved?.addOns ?? [] }));
  const [attempted, setAttempted] = useState(false);

  const pkg = packageById(form.packageId) ?? PACKAGES[1];
  const addOns = activeAddOns(pkg, form.addOns);
  const total = totalFor(pkg, form.addOns);
  const errors: Errors = attempted ? validate(form) : {};

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const toggleAddOn = (name: string) => setForm((f) => ({ ...f, addOns: f.addOns.includes(name) ? f.addOns.filter((n) => n !== name) : [...f.addOns, name] }));

  // each numbered group rises in as it reaches the viewport; the summary card arrives with the head
  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const q = gsap.utils.selector(el);
      gsap.fromTo(q(".en-summary"), { y: reduced ? 0 : 36, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.2, ease: "expo.out", delay: 0.5 });
      q<HTMLElement>(".en-group").forEach((group) => {
        const rows = group.querySelectorAll(".en-row");
        gsap
          .timeline({ defaults: { ease: "expo.out" }, scrollTrigger: { trigger: group, start: "top 80%", once: true } })
          .fromTo(group.querySelector(".en-rule"), { scaleX: 0 }, { scaleX: 1, duration: 1.1, transformOrigin: "left" }, 0)
          .fromTo(group.querySelector(".en-num"), { y: reduced ? 0 : 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9 }, 0.05)
          .fromTo(rows, { y: reduced ? 0 : 28, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, stagger: 0.08 }, 0.15);
      });
      ScrollTrigger.refresh();
    },
    { scope: root },
  );

  const submit = () => {
    setAttempted(true);
    const errs = validate(form);
    const first = FIELD_ORDER.find((k) => errs[k]);
    if (first) {
      const el = document.getElementById(`en-${first}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.focus({ preventScroll: true });
      return;
    }
    const { packageId, addOns: chosen, ...student } = form;
    saveEnrollment({ v: 1, student, packageId, addOns: activeAddOns(pkg, chosen).map((a) => a.name), total, savedAt: new Date().toISOString() });
    go("/payment");
  };

  return (
    <div ref={root} className="mt-16 grid gap-12 md:mt-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
      {/* ---------- left: selected package summary ---------- */}
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="en-summary relative overflow-hidden rounded-[1.6rem] bg-cream p-7 ring-1 ring-ink/10 md:p-9">
          <div className="grain pointer-events-none absolute inset-[-50%] opacity-[0.05] mix-blend-multiply" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_100%_100%,rgba(231,180,126,0.35),transparent_70%)]" />
          <div className="relative">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[0.62rem] font-medium tracking-[0.38em] text-ink/60 uppercase">Selected package</span>
              {pkg.bestValue && <span className="rounded-full bg-ink px-3 py-1.5 text-[0.55rem] font-semibold tracking-[0.3em] text-peach uppercase">Best value</span>}
            </div>
            <p className="mt-6 text-[0.62rem] tracking-[0.35em] text-ink/55 uppercase">{pkg.verse === "guitar" ? "Guitar Verse" : "Piano Verse"}</p>
            <h2 key={pkg.id} className="en-pop font-display mt-2 text-[2.6rem] leading-none md:text-[3.2rem]">
              {pkg.tier === "core" ? "Core" : "Complete"}
            </h2>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-[1.6rem] leading-none">{money(pkg.price)}</span>
              <span className="text-[0.6rem] tracking-[0.3em] text-ink/55 uppercase">{pkg.currency}</span>
            </p>

            <ul className="mt-7 space-y-2 border-t border-ink/10 pt-6 text-[0.95rem]">
              {pkg.includes.map((it) => (
                <li key={it} className="flex gap-3">
                  <span className="mt-[0.55em] block h-1.5 w-1.5 shrink-0 rounded-full bg-red" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>

            <div className="mt-7 border-t border-ink/10 pt-6">
              <span className="text-[0.6rem] tracking-[0.3em] text-ink/55 uppercase">Add-ons</span>
              <div className="mt-3 flex flex-wrap gap-2">
                {pkg.addOns.map((a) => {
                  const on = form.addOns.includes(a.name);
                  return (
                    <button
                      key={a.name}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggleAddOn(a.name)}
                      className={clsx("en-addon", on && "is-on")}
                    >
                      <span className="en-addon-box" aria-hidden>
                        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5">
                          <path d="M2 6.3 5 9l5-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span>{a.name}</span>
                      <span className="opacity-60">+{money(a.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <dl className="mt-7 space-y-1.5 border-t border-ink/10 pt-6 text-[0.95rem]">
              <div className="flex justify-between gap-4">
                <dt>{pkg.name}</dt>
                <dd className="tabular-nums">{money(pkg.price)}</dd>
              </div>
              {addOns.map((a) => (
                <div key={a.name} className="flex justify-between gap-4 text-ink/70">
                  <dt>{a.name}</dt>
                  <dd className="tabular-nums">{money(a.price)}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex items-end justify-between gap-4 border-t border-ink/20 pt-5">
              <span className="text-[0.65rem] font-semibold tracking-[0.35em] uppercase">Total</span>
              <span className="flex items-baseline gap-2">
                <span key={total} className="en-pop font-display text-[2.2rem] leading-none tabular-nums md:text-[2.6rem]">
                  {money(total)}
                </span>
                <span className="text-[0.6rem] tracking-[0.3em] text-ink/55 uppercase">CAD</span>
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* ---------- right: the enrollment form ---------- */}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="min-w-0"
      >
        <h2 className="sr-only">Enrollment Form</h2>

        <Group num="01" title="Student">
          <Field id="en-name" label="Student's Full Name" value={form.name} onChange={(v) => set("name", v)} error={errors.name} autoComplete="name" />
          <div className="grid gap-x-10 sm:grid-cols-[1fr_2fr]">
            <Field id="en-age" label="Age" value={form.age} onChange={(v) => set("age", v.replace(/\D/g, "").slice(0, 2))} error={errors.age} inputMode="numeric" />
            <Field id="en-phone" label="Phone Number" value={form.phone} onChange={(v) => set("phone", v)} error={errors.phone} type="tel" inputMode="tel" autoComplete="tel" />
          </div>
          <Field id="en-email" label="Email Address" value={form.email} onChange={(v) => set("email", v)} error={errors.email} type="email" inputMode="email" autoComplete="email" />
          <Chips id="en-tshirt" label="T-shirt Size" options={TSHIRT_SIZES} value={form.tshirt} onChange={(v) => set("tshirt", v)} error={errors.tshirt} />
        </Group>

        <Group num="02" title="Package">
          <fieldset className="en-row">
            <legend className="en-legend">Select Your Package</legend>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {PACKAGES.map((p) => {
                const on = p.id === form.packageId;
                return (
                  <label key={p.id} className={clsx("en-pkg", on && "is-on")}>
                    <input type="radio" name="package" value={p.id} checked={on} onChange={() => set("packageId", p.id)} className="sr-only" />
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-[0.58rem] tracking-[0.32em] uppercase opacity-60">{p.verse === "guitar" ? "Guitar Verse" : "Piano Verse"}</span>
                      <span className="en-pkg-dot" aria-hidden />
                    </span>
                    <span className="font-display mt-3 block text-[1.7rem] leading-none">{p.name}</span>
                    <span className="mt-2 block text-[0.85rem] opacity-70">{p.tier === "complete" ? `${p.verse === "guitar" ? "Guitar" : "Keyboard"} included · 8 + 1 live classes` : "Your own instrument · 6 + 1 live classes"}</span>
                    <span className="mt-4 flex items-baseline gap-1.5">
                      <span className="font-display text-[1.25rem] leading-none">{money(p.price)}</span>
                      <span className="text-[0.55rem] tracking-[0.3em] uppercase opacity-60">{p.currency}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </Group>

        <Group num="03" title="Delivery">
          <Field id="en-city" label="City" value={form.city} onChange={(v) => set("city", v)} error={errors.city} autoComplete="address-level2" />
          <Field id="en-address" label="Complete Shipping Address" value={form.address} onChange={(v) => set("address", v)} error={errors.address} textarea autoComplete="street-address" />
        </Group>

        <Group num="04" title="Preferences">
          <Chips id="en-classTime" label="Preferred Class Time" options={CLASS_TIMES} value={form.classTime} onChange={(v) => set("classTime", v)} error={errors.classTime} />
          <Field id="en-notes" label="Additional Notes" value={form.notes} onChange={(v) => set("notes", v)} textarea hint="Optional — anything your instructor should know." />
        </Group>

        <div className="en-group mt-14">
          <div className="en-rule h-px w-full bg-ink/15" />
          <div className="en-row mt-6 flex items-center gap-4 rounded-[1.2rem] border border-dashed border-ink/25 px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-peach" aria-hidden>
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="7" width="10" height="7" rx="1.6" />
                <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
              </svg>
            </span>
            <div>
              <span className="block text-[0.65rem] font-semibold tracking-[0.3em] uppercase">Payment Information</span>
              <span className="mt-1 block text-[0.9rem] text-ink/65">Entered on the next step.</span>
            </div>
          </div>
          <div className="en-row mt-10 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
            <Button type="submit" variant="red" size="lg">
              Complete Enrollment and Payment
            </Button>
            {attempted && Object.keys(errors).length > 0 && (
              <p role="alert" className="text-[0.85rem] text-red">
                A few fields need a look — scroll up to the highlighted ones.
              </p>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------------- pieces */

function Group({ num, title, children }: { num: string; title: string; children: ReactNode }) {
  return (
    <section className="en-group mt-14 first:mt-0">
      <header className="relative pb-4">
        <div className="en-num flex items-baseline gap-4">
          <span className="font-display text-[1.7rem] leading-none text-red">{num}</span>
          <h3 className="text-[0.7rem] font-semibold tracking-[0.3em] uppercase">{title}</h3>
        </div>
        <span className="en-rule absolute inset-x-0 bottom-0 block h-px bg-ink/20" />
      </header>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}
