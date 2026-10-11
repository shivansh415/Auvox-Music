"use client";

import { useRef, useState, type PointerEvent } from "react";
import clsx from "clsx";
import { gsap, useGSAP } from "@/lib/gsap";
import { PACKAGES, packageById } from "@/content/packages";
import { useTransition } from "@/store/transition";
import SectionHead from "@/components/ui/SectionHead";
import Button from "@/components/ui/Button";
import TransitionLink from "@/components/ui/TransitionLink";
import { Field } from "@/components/sections/Enroll/fields";
import { activeAddOns, money, parseEnrollment, saveEnrollment, totalFor, useClientSnapshot, type Enrollment } from "@/components/sections/Enroll/enrollment";

/* ---------------------------------------------------------------- page */

export default function PaymentPage() {
  const snap = useClientSnapshot();
  const saved = parseEnrollment(snap?.raw);
  return (
    <main className="relative overflow-hidden bg-peach text-ink">
      <div className="grain pointer-events-none absolute inset-[-50%] opacity-[0.04] mix-blend-multiply" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_0%_100%,rgba(222,184,134,0.5),transparent_70%)]" />
      <div className="relative mx-auto max-w-[1440px] px-6 pt-32 pb-24 md:px-12 md:pt-44 md:pb-36">
        <SectionHead as="h1" immediate kicker="Payment" title="Almost there." accent="there." body="Check your order, add your card and your AUVOX journey begins." />
        <PaymentBody key={snap ? "client" : "server"} enrollment={saved} now={snap?.now ?? 0} />
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------- card logic */

type Brand = "visa" | "mastercard" | "amex" | null;

const BRAND_NAME: Record<Exclude<Brand, null>, string> = { visa: "Visa", mastercard: "Mastercard", amex: "American Express" };

const detectBrand = (digits: string): Brand => {
  if (/^4/.test(digits)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "mastercard";
  if (/^3[47]/.test(digits)) return "amex";
  return null;
};
const groupsFor = (brand: Brand) => (brand === "amex" ? [4, 6, 5] : [4, 4, 4, 4]);
const maxDigits = (brand: Brand) => (brand === "amex" ? 15 : 16);

/** "4242424242424242" → "4242 4242 4242 4242" (Amex: 4-6-5) */
function formatCard(digits: string, brand: Brand) {
  const out: string[] = [];
  let i = 0;
  for (const g of groupsFor(brand)) {
    if (i >= digits.length) break;
    out.push(digits.slice(i, i + g));
    i += g;
  }
  return out.join(" ");
}

/** the preview shows what's typed and dots for the rest */
function previewNumber(digits: string, brand: Brand) {
  const total = maxDigits(brand);
  const padded = digits + "•".repeat(Math.max(0, total - digits.length));
  return formatCard(padded, brand);
}

function luhn(digits: string) {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

const formatExpiry = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

type Card = { number: string; expiry: string; cvc: string; name: string; postal: string };
type CardErrors = Partial<Record<keyof Card, string>>;

function validate(c: Card, brand: Brand, now: number): CardErrors {
  const e: CardErrors = {};
  const digits = c.number.replace(/\D/g, "");
  if (digits.length !== maxDigits(brand) || !luhn(digits)) e.number = "Enter a valid card number.";
  const m = c.expiry.match(/^(\d{2})\/(\d{2})$/);
  if (!m) e.expiry = "Use MM/YY.";
  else {
    const month = Number(m[1]);
    const year = 2000 + Number(m[2]);
    const d = new Date(now);
    const past = year < d.getFullYear() || (year === d.getFullYear() && month < d.getMonth() + 1);
    if (month < 1 || month > 12 || (now && past)) e.expiry = "That card has expired.";
  }
  if (c.cvc.length !== (brand === "amex" ? 4 : 3)) e.cvc = brand === "amex" ? "4 digits on the front." : "3 digits on the back.";
  if (c.name.trim().length < 2) e.name = "Enter the name as printed on the card.";
  if (c.postal.trim().length < 3) e.postal = "Enter the billing postal code.";
  return e;
}

/* ---------------------------------------------------------------- body */

function PaymentBody({ enrollment, now }: { enrollment: Enrollment | null; now: number }) {
  const go = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const pkg = packageById(enrollment?.packageId ?? "") ?? PACKAGES[1];
  const addOns = activeAddOns(pkg, enrollment?.addOns ?? []);
  const total = totalFor(pkg, enrollment?.addOns ?? []);

  const [card, setCard] = useState<Card>({ number: "", expiry: "", cvc: "", name: "", postal: "" });
  const [cvcFocus, setCvcFocus] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [paying, setPaying] = useState(false);

  const digits = card.number.replace(/\D/g, "");
  const brand = detectBrand(digits);
  const errors: CardErrors = attempted ? validate(card, brand, now) : {};
  const set = <K extends keyof Card>(k: K, v: Card[K]) => setCard((c) => ({ ...c, [k]: v }));

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      gsap
        .timeline({ defaults: { ease: "expo.out" }, delay: 0.45 })
        .fromTo(q(".pay-summary"), { y: 36, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.2 }, 0)
        .fromTo(q(".pay-card"), { y: 40, rotateX: -12, autoAlpha: 0 }, { y: 0, rotateX: 0, autoAlpha: 1, duration: 1.3 }, 0.1)
        .fromTo(q(".en-row"), { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, stagger: 0.07 }, 0.3);
    },
    { scope: root },
  );

  const pay = () => {
    setAttempted(true);
    const errs = validate(card, brand, now);
    const first = (Object.keys(errs) as (keyof Card)[])[0];
    if (first) {
      const el = document.getElementById(`pay-${first}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
      return;
    }
    // never the full number — only what a receipt would show
    saveEnrollment({
      v: 1,
      student: enrollment?.student ?? { name: card.name, age: "", phone: "", email: "", tshirt: "", city: "", address: "", classTime: "", notes: "" },
      packageId: pkg.id,
      addOns: addOns.map((a) => a.name),
      total,
      savedAt: enrollment?.savedAt ?? new Date().toISOString(),
      payment: { brand: brand ? BRAND_NAME[brand] : "Card", last4: digits.slice(-4), name: card.name.trim(), postal: card.postal.trim().toUpperCase(), paidAt: new Date().toISOString() },
    });
    setPaying(true);
  };

  return (
    <div ref={root} className="mt-16 grid gap-12 md:mt-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
      {/* ---------- left: order summary ---------- */}
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="pay-summary relative overflow-hidden rounded-[1.6rem] bg-cream p-7 ring-1 ring-ink/10 md:p-9">
          <div className="grain pointer-events-none absolute inset-[-50%] opacity-[0.05] mix-blend-multiply" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_0%_100%,rgba(231,180,126,0.35),transparent_70%)]" />
          <div className="relative">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[0.62rem] font-medium tracking-[0.38em] text-ink/60 uppercase">Order summary</span>
              <TransitionLink href="/enroll" className="link-line text-[0.62rem] tracking-[0.3em] text-ink/60 uppercase">
                Edit
              </TransitionLink>
            </div>
            <p className="mt-6 text-[0.62rem] tracking-[0.35em] text-ink/55 uppercase">{pkg.verse === "guitar" ? "Guitar Verse" : "Piano Verse"}</p>
            <h2 className="font-display mt-2 text-[2.4rem] leading-none md:text-[3rem]">{pkg.name}</h2>
            {enrollment ? (
              <p className="mt-3 text-[0.9rem] text-ink/65">
                For {enrollment.student.name}
                {enrollment.student.city && <> · ships to {enrollment.student.city}</>}
              </p>
            ) : (
              <p className="mt-3 text-[0.9rem] text-ink/65">No enrollment on this session yet — showing the Guitar Complete package.</p>
            )}

            <dl className="mt-7 space-y-2 border-t border-ink/10 pt-6 text-[0.95rem]">
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
              <div className="flex justify-between gap-4 text-ink/70">
                <dt>Frequency Box shipping</dt>
                <dd>Included</dd>
              </div>
            </dl>
            <div className="mt-5 flex items-end justify-between gap-4 border-t border-ink/20 pt-5">
              <span className="text-[0.65rem] font-semibold tracking-[0.35em] uppercase">Total</span>
              <span className="flex items-baseline gap-2">
                <span className="font-display text-[2.2rem] leading-none tabular-nums md:text-[2.6rem]">{money(total)}</span>
                <span className="text-[0.6rem] tracking-[0.3em] text-ink/55 uppercase">CAD</span>
              </span>
            </div>
            <ul className="mt-6 space-y-1.5 border-t border-ink/10 pt-5 text-[0.8rem] text-ink/55">
              <li className="flex gap-2">
                <span className="text-red">✦</span> Test mode — nothing is charged and no card data leaves this page.
              </li>
              <li className="flex gap-2">
                <span className="text-red">✦</span> Try 4242 4242 4242 4242 · any future date · any CVC.
              </li>
            </ul>
          </div>
        </div>
      </aside>

      {/* ---------- right: card + form ---------- */}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          pay();
        }}
        className="min-w-0"
      >
        <CardPreview number={previewNumber(digits, brand)} name={card.name} expiry={card.expiry} cvc={card.cvc} brand={brand} flipped={cvcFocus} />

        <div className="mt-12">
          <div className="flex items-baseline gap-4 border-b border-ink/20 pb-4">
            <span className="font-display text-[1.7rem] leading-none text-red">05</span>
            <h3 className="text-[0.7rem] font-semibold tracking-[0.3em] uppercase">Payment information</h3>
          </div>
          <div className="mt-2 space-y-2">
            <Field
              id="pay-number"
              label="Card number"
              value={card.number}
              onChange={(v) => {
                const d = v.replace(/\D/g, "");
                set("number", formatCard(d.slice(0, maxDigits(detectBrand(d))), detectBrand(d)));
              }}
              error={errors.number}
              inputMode="numeric"
              autoComplete="cc-number"
              className="pay-number"
              trailing={<BrandBadge brand={brand} />}
            />
            <div className="grid gap-x-10 sm:grid-cols-2">
              <Field id="pay-expiry" label="Expiry (MM/YY)" value={card.expiry} onChange={(v) => set("expiry", formatExpiry(v))} error={errors.expiry} inputMode="numeric" autoComplete="cc-exp" maxLength={5} />
              <Field
                id="pay-cvc"
                label="CVC"
                value={card.cvc}
                onChange={(v) => set("cvc", v.replace(/\D/g, "").slice(0, brand === "amex" ? 4 : 3))}
                onFocus={() => setCvcFocus(true)}
                onBlur={() => setCvcFocus(false)}
                error={errors.cvc}
                inputMode="numeric"
                autoComplete="cc-csc"
              />
            </div>
            <Field id="pay-name" label="Name on card" value={card.name} onChange={(v) => set("name", v)} error={errors.name} autoComplete="cc-name" />
            <Field id="pay-postal" label="Billing postal code" value={card.postal} onChange={(v) => set("postal", v.toUpperCase().slice(0, 10))} error={errors.postal} autoComplete="postal-code" className="sm:max-w-[16rem]" />
          </div>

          <div className="en-row mt-10 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
            <Button type="submit" variant="red" size="lg" disabled={paying}>
              Pay {money(total)} CAD
            </Button>
            <p className="flex items-center gap-2 text-[0.78rem] text-ink/55">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="7" width="10" height="7" rx="1.6" />
                <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
              </svg>
              Secure test checkout · AUVOX Music
            </p>
          </div>
        </div>
      </form>

      {paying && <SwipeOverlay onDone={() => go("/dashboard")} />}
    </div>
  );
}

/* ---------------------------------------------------------------- the card */

function BrandBadge({ brand, className }: { brand: Brand; className?: string }) {
  if (!brand) return null;
  return (
    <span className={clsx("pay-brand", className)} aria-label={BRAND_NAME[brand]}>
      {brand === "visa" && <span className="font-display text-[0.85rem] italic tracking-[0.06em]">VISA</span>}
      {brand === "mastercard" && (
        <span className="flex items-center" aria-hidden>
          <span className="block h-3.5 w-3.5 rounded-full bg-red" />
          <span className="-ml-1.5 block h-3.5 w-3.5 rounded-full bg-tan mix-blend-multiply" />
        </span>
      )}
      {brand === "amex" && <span className="text-[0.55rem] font-semibold tracking-[0.2em]">AMEX</span>}
    </span>
  );
}

function CardPreview({ number, name, expiry, cvc, brand, flipped }: { number: string; name: string; expiry: string; cvc: string; brand: Brand; flipped: boolean }) {
  const tilt = useRef<HTMLDivElement>(null);

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const el = tilt.current;
    if (!el || window.matchMedia("(pointer: coarse)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    gsap.to(el, { rotateY: x * 18, rotateX: -y * 14, duration: 0.7, ease: "power3.out" });
  };
  const leave = () => {
    if (tilt.current) gsap.to(tilt.current, { rotateY: 0, rotateX: 0, duration: 1, ease: "expo.out" });
  };

  return (
    <div className="pay-card" onPointerMove={move} onPointerLeave={leave}>
      <div ref={tilt} className="pay-card-tilt">
        <div className={clsx("pay-card-inner", flipped && "is-flipped")}>
          {/* front */}
          <div className="pay-face pay-front" aria-hidden>
            <div className="grain pointer-events-none absolute inset-[-50%] opacity-[0.07] mix-blend-screen" />
            <div className="pay-sheen" />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-start justify-between">
                <span className="pay-logo" />
                <span className="text-[0.55rem] tracking-[0.35em] text-peach/60 uppercase">AUVOX Music</span>
              </div>
              <div>
                <span className="pay-chip" />
                <p className="mt-4 text-[clamp(1.05rem,3.4vw,1.45rem)] tracking-[0.14em] text-peach tabular-nums">{number}</p>
              </div>
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <span className="block text-[0.5rem] tracking-[0.3em] text-peach/50 uppercase">Name on card</span>
                  <span className="mt-1 block truncate text-[0.85rem] tracking-[0.12em] text-peach uppercase">{name.trim() || "Your name"}</span>
                </div>
                <div className="flex items-end gap-5">
                  <div>
                    <span className="block text-[0.5rem] tracking-[0.3em] text-peach/50 uppercase">Expires</span>
                    <span className="mt-1 block text-[0.85rem] tracking-[0.12em] text-peach tabular-nums">{expiry || "MM/YY"}</span>
                  </div>
                  <BrandBadge brand={brand} className="pay-brand-card" />
                </div>
              </div>
            </div>
          </div>
          {/* back */}
          <div className="pay-face pay-back" aria-hidden>
            <div className="grain pointer-events-none absolute inset-[-50%] opacity-[0.07] mix-blend-screen" />
            <div className="pay-stripe" />
            <div className="pay-sign">
              <span className="pay-cvc">{cvc || "•••"}</span>
            </div>
            <p className="absolute right-7 bottom-6 left-7 text-[0.5rem] leading-relaxed tracking-[0.12em] text-peach/45 uppercase">Test card · no real charges · {BRAND_NAME[brand ?? "visa"]}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- swipe loading screen */

/**
 * The client's ask: a credit-card swipe as the loading screen.
 * The card slides through the reader's slot, a tan light follows it, then the tick draws.
 */
function SwipeOverlay({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"swiping" | "received">("swiping");

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.documentElement.dataset.overlay = "1";
      const tl = gsap.timeline({
        defaults: { ease: "expo.out" },
        onComplete: () => {
          document.documentElement.dataset.overlay = "";
          onDone();
        },
      });
      tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, ease: "power2.out" }, 0).fromTo(q(".sw-reader"), { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8 }, 0.1);

      tl.fromTo(q(".sw-text"), { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6 }, 0.4);

      if (reduced) {
        tl.to(q(".sw-slot"), { backgroundColor: "#e7b47e", duration: 0.3 }, 0.6)
          .to([q(".sw-reader"), q(".sw-card"), q(".sw-text")], { autoAlpha: 0, duration: 0.3 }, 1.0)
          .fromTo(q(".sw-tick"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, 1.1)
          .add(() => setStatus("received"), 1.1)
          .to(q(".sw-text"), { autoAlpha: 1, duration: 0.4 }, 1.2)
          .to({}, { duration: 0.8 });
      } else {
        tl.fromTo(q(".sw-card"), { x: -300, y: 8, rotate: -3, autoAlpha: 0 }, { x: -300, y: 0, rotate: 0, autoAlpha: 1, duration: 0.35, ease: "power2.out" }, 0.35)
          .to(q(".sw-card"), { x: 300, duration: 1.0, ease: "power2.inOut" }, 0.7)
          .fromTo(q(".sw-light"), { x: -300, autoAlpha: 0 }, { x: 300, autoAlpha: 1, duration: 1.0, ease: "power2.inOut" }, 0.78)
          .to(q(".sw-light"), { autoAlpha: 0, duration: 0.25 }, 1.6)
          .to(q(".sw-slot"), { backgroundColor: "#e7b47e", boxShadow: "0 0 24px rgba(231,180,126,0.9)", duration: 0.2, ease: "power2.out" }, 1.45)
          .to(q(".sw-card"), { autoAlpha: 0, y: -10, duration: 0.3, ease: "power2.in" }, 1.6)
          .to(q(".sw-reader"), { autoAlpha: 0, scale: 0.92, y: 20, duration: 0.45, ease: "power2.inOut" }, 1.7)
          .to(q(".sw-text"), { autoAlpha: 0, y: -8, duration: 0.25, ease: "power2.in" }, 1.75)
          .fromTo(q(".sw-tick"), { autoAlpha: 0, scale: 0.8 }, { autoAlpha: 1, scale: 1, duration: 0.6 }, 1.85)
          .fromTo(q(".sw-ring"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.8 }, 1.85)
          .fromTo(q(".sw-check"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.5 }, 2.05)
          .add(() => setStatus("received"), 2.0)
          .fromTo(q(".sw-text"), { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, immediateRender: false }, 2.15)
          .to({}, { duration: 0.45 });
      }

      return () => {
        document.documentElement.dataset.overlay = "";
      };
    },
    { scope: root },
  );

  return (
    <div ref={root} className="sw-overlay fixed inset-0 z-[150] flex items-center justify-center overflow-hidden bg-peach text-ink opacity-0" role="status" aria-live="polite" data-lenis-prevent>
      <div className="grain pointer-events-none absolute inset-[-50%] opacity-[0.05] mix-blend-multiply" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_100%,rgba(222,184,134,0.55),transparent_70%)]" />
      <div className="relative flex flex-col items-center">
        <div className="sw-scene">
          {/* the card, in flight */}
          <div className="sw-card" aria-hidden>
            <span className="pay-logo sw-card-logo" />
            <span className="sw-card-chip" />
            <span className="sw-card-num">•••• 4242</span>
          </div>
          {/* the reader */}
          <div className="sw-reader" aria-hidden>
            <div className="sw-slot" />
            <div className="sw-light" />
            <span className="sw-reader-dot" />
            <span className="sw-reader-label">AUVOX · POS</span>
          </div>
          {/* the tick */}
          <svg className="sw-tick" viewBox="0 0 120 120" aria-hidden>
            <circle className="sw-ring" cx="60" cy="60" r="52" fill="none" stroke="#850909" strokeWidth="2.5" />
            <path className="sw-check" d="M38 62 L53 77 L84 44" fill="none" stroke="#850909" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="sw-text mt-10 text-center">
          <span className="block text-[0.62rem] font-medium tracking-[0.38em] text-ink/60 uppercase">{status === "received" ? "Payment received" : "Processing"}</span>
          <span className="font-display mt-2 block text-[1.8rem] leading-none md:text-[2.2rem]">{status === "received" ? "Welcome to AUVOX." : "Reading your card…"}</span>
        </p>
        <p className="sr-only">{status === "received" ? "Payment received. Opening your student space." : "Processing payment."}</p>
      </div>
    </div>
  );
}
