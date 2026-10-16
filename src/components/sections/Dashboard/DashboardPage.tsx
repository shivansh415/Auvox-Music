"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import clsx from "clsx";
import { useLenis } from "lenis/react";
import { gsap, useGSAP } from "@/lib/gsap";
import { ABOUT, CONTACT_EMAIL, PACKAGES, packageById, packagesFor } from "@/content/packages";
import { useTransition } from "@/store/transition";
import SectionHead from "@/components/ui/SectionHead";
import Button from "@/components/ui/Button";
import { MOCK_STUDENT, clearEnrollment, money, parseEnrollment, useClientSnapshot, type Enrollment } from "@/components/sections/Enroll/enrollment";

/* ---------------------------------------------------------------- page */

export default function DashboardPage() {
  const snap = useClientSnapshot();
  const enrollment = parseEnrollment(snap?.raw);
  return (
    <main className="relative overflow-hidden bg-peach text-ink">
      <div className="grain pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-multiply" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_40%_at_100%_0%,rgba(231,180,126,0.4),transparent_70%)]" />
      <DashboardBody key={snap ? "client" : "server"} enrollment={enrollment} now={snap?.now ?? 0} />
    </main>
  );
}

/* ---------------------------------------------------------------- data */

const TOTAL_CREDITS = 12;
const DAYS_LEFT = 41;
const RENEW_AT = 4;

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "profile", label: "My profile" },
  { id: "package", label: "My package" },
  { id: "about", label: "About AUVOX" },
  { id: "help", label: "Need a hand?" },
] as const;

const longDate = (d: Date) => `${d.toLocaleDateString("en-CA", { weekday: "long" })} · ${d.toLocaleDateString("en-CA", { day: "numeric", month: "long", year: "numeric" })}`;
const shortDate = (d: Date) => d.toLocaleDateString("en-CA", { weekday: "short", day: "numeric", month: "short" });

/* ---------------------------------------------------------------- body */

function DashboardBody({ enrollment, now }: { enrollment: Enrollment | null; now: number }) {
  const go = useTransition();
  const lenis = useLenis();
  const root = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(7);
  const [active, setActive] = useState<(typeof NAV)[number]["id"]>("overview");

  const student = enrollment?.student.name ? enrollment.student : MOCK_STUDENT;
  const pkg = packageById(enrollment?.packageId ?? "") ?? PACKAGES[1];
  const first = student.name.trim().split(/\s+/)[0] || "there";
  const today = now ? new Date(now) : null;
  const nextClass = today ? new Date(now + 3 * 86_400_000) : null;
  const used = TOTAL_CREDITS - left;
  const renew = left <= RENEW_AT;
  const last4 = enrollment?.payment?.last4 || "4242";
  const tiers = packagesFor(pkg.verse);

  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Class slot request — ${student.name}`)}&body=${encodeURIComponent(
    `Hi AUVOX team,\n\nI'd like to request a time slot for my next live class.\n\nStudent: ${student.name}\nPackage: ${pkg.name}\nPreferred time: ${student.classTime || "flexible"}\n\nCould you share the slots available this week?\n\nThanks,\n${first}`,
  )}`;

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const q = gsap.utils.selector(el);
      gsap
        .timeline({ defaults: { ease: "expo.out" }, delay: 0.3 })
        .fromTo(q(".dash-side"), { x: -16, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 1 }, 0)
        .fromTo(q(".dash-card"), { y: 36, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.2, stagger: 0.09 }, 0.5);
    },
    { scope: root },
  );

  const jump = (id: (typeof NAV)[number]["id"]) => {
    setActive(id);
    const el = document.getElementById(`dash-${id}`);
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: -110, duration: 1.2 });
    else el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const signOut = () => {
    clearEnrollment();
    go("/");
  };

  return (
    <div ref={root} className="relative mx-auto max-w-[1440px] px-6 pt-28 pb-24 md:px-12 md:pt-40 md:pb-36 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16">
      {/* ---------- sidebar / mobile tab row ---------- */}
      <aside className="dash-side lg:sticky lg:top-28 lg:self-start">
        <span className="hidden text-[0.62rem] font-medium tracking-[0.38em] text-ink/60 uppercase lg:block">Student space</span>
        <nav aria-label="Student space" className="dash-nav mt-0 lg:mt-6">
          {NAV.map((n) => (
            <button key={n.id} type="button" onClick={() => jump(n.id)} className={clsx("dash-nav-item", active === n.id && "is-active")} aria-current={active === n.id ? "page" : undefined}>
              <span className="dash-nav-dot" aria-hidden />
              {n.label}
            </button>
          ))}
          <button type="button" onClick={signOut} className="dash-nav-item text-ink/55">
            <span className="dash-nav-dot" aria-hidden />
            Sign out
          </button>
        </nav>
      </aside>

      {/* ---------- main ---------- */}
      <div className="mt-10 min-w-0 lg:mt-0" id="dash-overview">
        <SectionHead as="h1" immediate size="md" kicker={today ? longDate(today) : "Today"} title={`Hey ${first}. Ready to play?`} accent="play?" body="Everything about your AUVOX journey, in one place." />

        <div className="mt-12 grid gap-5 md:grid-cols-2 md:gap-6">
          {/* (1) package */}
          <Card id="dash-package" kicker="Package" badge="Status · Active" className="md:col-span-2">
            <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div>
                <p className="text-[0.62rem] tracking-[0.35em] text-ink/55 uppercase">{pkg.verse === "guitar" ? "Guitar Verse" : "Piano Verse"}</p>
                <h2 className="font-display mt-2 text-[2.4rem] leading-none md:text-[3rem]">{pkg.name}</h2>
                <dl className="mt-7 grid grid-cols-2 gap-6">
                  <div>
                    <dt className="text-[0.58rem] tracking-[0.3em] text-ink/55 uppercase">Next live class</dt>
                    <dd className="mt-1.5 text-[1.05rem]">{nextClass ? `${shortDate(nextClass)} · 6:30 PM` : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[0.58rem] tracking-[0.3em] text-ink/55 uppercase">Days left</dt>
                    <dd className="font-display mt-1 text-[1.6rem] leading-none">{DAYS_LEFT}</dd>
                  </div>
                </dl>
                <Button href="/packages" variant="ink" size="sm" className="mt-8">
                  View package
                </Button>
              </div>
              <Disc />
            </div>
          </Card>

          {/* (2) session credits */}
          <Card kicker="Session credits">
            <div className="flex items-center gap-7">
              <Ring left={left} total={TOTAL_CREDITS} />
              <dl className="grid flex-1 grid-cols-3 gap-3 sm:gap-4">
                {[
                  { k: "Used", v: used },
                  { k: "Total", v: TOTAL_CREDITS },
                  { k: "Left", v: left, hot: true },
                ].map((s) => (
                  <div key={s.k}>
                    <dt className="text-[0.58rem] tracking-[0.3em] text-ink/55 uppercase">{s.k}</dt>
                    <dd className={clsx("font-display mt-1 text-[1.9rem] leading-none tabular-nums", s.hot && "text-red")}>{s.v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-ink/10 pt-5">
              <span className="rounded-full border border-dashed border-ink/30 px-2.5 py-1 text-[0.52rem] tracking-[0.3em] text-ink/55 uppercase">Dev</span>
              <button type="button" onClick={() => setLeft((n) => (n === 3 ? 7 : 3))} className="link-line text-[0.72rem] tracking-[0.08em] text-ink/70">
                {left === 3 ? "reset to 7 credits left" : "simulate 3 credits left"}
              </button>
            </div>
          </Card>

          {/* (3) renewal — only when credits run low */}
          {renew && (
            <RenewalCard left={left} tiers={tiers.map((t) => ({ name: t.name, tier: t.tier, price: t.price }))} />
          )}

          {/* (4) need a hand */}
          <Card id="dash-help" kicker="Need a hand?">
            <h3 className="font-display text-[1.7rem] leading-[1.05] md:text-[2rem]">
              Want a different class slot? <em className="text-red not-italic">Just ask.</em>
            </h3>
            <p className="mt-4 text-[0.95rem] text-ink/70">We&rsquo;ve drafted the email for you — your name, package and preferred time are already in it. Hit send and we&rsquo;ll reply with the open slots.</p>
            <Button href={mailto} variant="red" size="sm" className="mt-7">
              Email us (draft ready)
            </Button>
            <p className="mt-4 text-[0.75rem] text-ink/50">{CONTACT_EMAIL}</p>
          </Card>

          {/* (5) your details */}
          <Card id="dash-profile" kicker="Your details" className="md:col-span-2">
            <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { k: "Name", v: student.name },
                { k: "Age", v: student.age || "—" },
                { k: "Phone", v: student.phone || "—" },
                { k: "Email", v: student.email || "—" },
                { k: "T-shirt", v: student.tshirt || "—" },
                { k: "Preferred time", v: student.classTime || "—" },
                { k: "Address", v: student.address ? `${student.address}${student.city && !student.address.includes(student.city) ? `, ${student.city}` : ""}` : student.city || "—", wide: true },
                { k: "Saved card", v: `•••• ${last4}`, card: true },
              ].map((f) => (
                <div key={f.k} className={clsx("min-w-0 border-b border-ink/10 pb-4", f.wide && "sm:col-span-2")}>
                  <dt className="text-[0.58rem] tracking-[0.3em] text-ink/55 uppercase">{f.k}</dt>
                  <dd className="mt-1.5 flex items-center gap-3 text-[1rem] break-words">
                    {f.card && (
                      <span className="flex h-6 w-9 shrink-0 items-center justify-center rounded-[4px] bg-ink" aria-hidden>
                        <span className="block h-[3px] w-5 rounded-full bg-tan" />
                      </span>
                    )}
                    {f.v}
                  </dd>
                </div>
              ))}
            </dl>
            <Button href="/enroll" variant="outline" size="sm" className="mt-7">
              Edit details
            </Button>
          </Card>

          {/* (6) about */}
          <Card id="dash-about" kicker="About AUVOX" className="md:col-span-2" tone="ink">
            <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div>
                <h3 className="font-display text-[1.8rem] leading-[1.05] md:text-[2.2rem]">
                  {ABOUT.what.title.slice(0, -ABOUT.what.accent.length)}
                  <em className="text-tan not-italic">{ABOUT.what.accent}</em>
                </h3>
                <p className="mt-4 max-w-[40rem] text-[0.95rem] text-peach/70">{ABOUT.what.body[1]}</p>
              </div>
              <Button href="/#verse-universe" variant="peach" size="sm">
                Explore the universe
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- pieces */

function Card({ id, kicker, badge, tone = "cream", className, children }: { id?: string; kicker: string; badge?: string; tone?: "cream" | "ink"; className?: string; children: ReactNode }) {
  const ink = tone === "ink";
  return (
    <section id={id} className={clsx("dash-card relative overflow-hidden rounded-[1.6rem] p-6 md:p-8", ink ? "bg-ink text-peach" : "bg-cream text-ink ring-1 ring-ink/10", className)}>
      <div className={clsx("grain pointer-events-none absolute inset-0", ink ? "opacity-[0.06] mix-blend-screen" : "opacity-[0.05] mix-blend-multiply")} />
      {ink && <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_80%_at_100%_0%,rgba(133,9,9,0.5),transparent_70%)]" />}
      <div className="relative">
        <div className="flex items-center justify-between gap-4">
          <span className={clsx("text-[0.62rem] font-medium tracking-[0.38em] uppercase", ink ? "text-peach/60" : "text-ink/60")}>{kicker}</span>
          {badge && (
            <span className="flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-[0.55rem] font-semibold tracking-[0.3em] text-peach uppercase">
              <span className="dash-pulse block h-1.5 w-1.5 rounded-full bg-tan" aria-hidden />
              {badge}
            </span>
          )}
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}

/** the rotating disc with notes drifting up around it (client: keep this) */
function Disc() {
  const notes = [
    { ch: "♪", x: "6%", d: "0s", t: "5.2s", s: "1.1rem" },
    { ch: "♫", x: "22%", d: "1.4s", t: "6s", s: "1.5rem" },
    { ch: "♩", x: "70%", d: "0.6s", t: "5.6s", s: "1rem" },
    { ch: "♬", x: "86%", d: "2.2s", t: "6.4s", s: "1.3rem" },
    { ch: "♪", x: "50%", d: "3.1s", t: "5s", s: "0.95rem" },
  ];
  return (
    <div className="dash-disc-wrap mx-auto sm:mx-0" aria-hidden>
      {notes.map((n, i) => (
        <span key={i} className="dash-note" style={{ "--x": n.x, "--d": n.d, "--t": n.t, fontSize: n.s } as CSSProperties}>
          {n.ch}
        </span>
      ))}
      <svg className="dash-disc" viewBox="0 0 200 200">
        <defs>
          <radialGradient id="dash-disc-shine" cx="30%" cy="25%" r="80%">
            <stop offset="0" stopColor="#5a5a5a" />
            <stop offset="0.45" stopColor="#1e1e1e" />
            <stop offset="1" stopColor="#111" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="98" fill="url(#dash-disc-shine)" />
        {[90, 83, 76, 69, 62, 55, 48].map((r) => (
          <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#fae3c5" strokeOpacity={r % 2 ? 0.1 : 0.16} strokeWidth="0.8" />
        ))}
        <circle cx="100" cy="100" r="34" fill="#e7b47e" />
        <circle cx="100" cy="100" r="34" fill="none" stroke="#1e1e1e" strokeOpacity="0.25" strokeWidth="0.6" />
        <image href="/svg/auvox-logomark.svg" x="84" y="85.5" width="32" height="29" />
        <circle cx="100" cy="100" r="3.5" fill="#1e1e1e" />
      </svg>
      <span className="dash-disc-shadow" />
    </div>
  );
}

/** credits ring: draws to the share of credits left */
function Ring({ left, total }: { left: number; total: number }) {
  const root = useRef<SVGSVGElement>(null);
  const pct = Math.round((left / total) * 100);
  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      gsap.fromTo(el.querySelector(".dash-ring"), { drawSVG: "0%" }, { drawSVG: `${pct}%`, duration: 1.6, ease: "expo.out" });
    },
    { dependencies: [pct], scope: root },
  );
  return (
    <div className="relative h-[8.5rem] w-[8.5rem] shrink-0">
      <svg ref={root} viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r="52" fill="none" stroke="#1e1e1e" strokeOpacity="0.12" strokeWidth="6" />
        <circle className="dash-ring" cx="60" cy="60" r="52" fill="none" stroke="#850909" strokeWidth="6" strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-[1.9rem] leading-none tabular-nums">
          {left}
          <span className="text-[1rem] text-ink/50"> / {total}</span>
        </span>
        <span className="mt-1 text-[0.55rem] tracking-[0.3em] text-ink/55 uppercase">left</span>
      </div>
      <p className="sr-only">
        {left} of {total} session credits left
      </p>
    </div>
  );
}

function RenewalCard({ left, tiers }: { left: number; tiers: { name: string; tier: string; price: number }[] }) {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      if (!root.current) return;
      gsap.fromTo(root.current, { y: 30, scale: 0.98, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 1.1, ease: "expo.out" });
    },
    { scope: root },
  );
  return (
    <section ref={root} className="dash-card relative overflow-hidden rounded-[1.6rem] bg-red p-6 text-peach md:p-8">
      <div className="grain pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-screen" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_70%_at_100%_100%,rgba(30,30,30,0.55),transparent_70%)]" />
      <div className="relative">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[0.62rem] font-medium tracking-[0.38em] text-peach/70 uppercase">Renewal</span>
          <span className="rounded-full bg-peach/15 px-3 py-1.5 text-[0.55rem] font-semibold tracking-[0.3em] uppercase">{left} credits left</span>
        </div>
        <h3 className="font-display mt-6 text-[1.8rem] leading-[1.05] md:text-[2.1rem]">
          Keep your momentum <em className="text-tan not-italic">going.</em>
        </h3>
        <ul className="mt-6 space-y-2 border-t border-peach/15 pt-5">
          {tiers.map((t) => (
            <li key={t.name} className="flex items-baseline justify-between gap-4">
              <span className="text-[0.95rem]">{t.name}</span>
              <span className="flex items-baseline gap-1.5">
                <span className="font-display text-[1.3rem] leading-none tabular-nums">{money(t.price)}</span>
                <span className="text-[0.55rem] tracking-[0.3em] text-peach/60 uppercase">CAD</span>
              </span>
            </li>
          ))}
        </ul>
        <Button href="/packages" variant="peach" size="sm" className="mt-7">
          View renewal plans
        </Button>
      </div>
    </section>
  );
}
