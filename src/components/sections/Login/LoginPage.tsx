"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { gsap, useGSAP } from "@/lib/gsap";
import SectionHead from "@/components/ui/SectionHead";
import Button from "@/components/ui/Button";
import TransitionLink from "@/components/ui/TransitionLink";
import { Field } from "@/components/sections/Enroll/fields";
import { CONTACT_EMAIL } from "@/content/packages";
import { useTransition } from "@/store/transition";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * /login: for students who have already enrolled. Front-end only for now (no accounts yet): the form
 * checks what it can, then opens the student space.
 */
export default function LoginPage() {
  const root = useRef<HTMLElement>(null);
  const go = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

  const errors = {
    email: !email.trim() ? "Enter the email you enrolled with." : !EMAIL.test(email.trim()) ? "That email doesn't look right." : undefined,
    password: !password ? "Enter your password." : password.length < 6 ? "Passwords are at least 6 characters." : undefined,
  };
  const valid = !errors.email && !errors.password;

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      gsap.fromTo(".lg-card", { y: reduced ? 0 : 36, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.2, ease: "expo.out", delay: 0.4 });
      gsap.fromTo(".lg-disc", { rotate: -40, autoAlpha: 0 }, { rotate: 0, autoAlpha: 1, duration: 1.8, ease: "expo.out", delay: 0.2 });
    },
    { scope: root },
  );

  const submit = () => {
    setAttempted(true);
    if (!valid || busy) return;
    setBusy(true);
    try {
      if (remember) localStorage.setItem("auvox:login", email.trim());
      else localStorage.removeItem("auvox:login");
    } catch {
      /* storage can be blocked; logging in still works */
    }
    window.setTimeout(() => go("/dashboard"), 650);
  };

  const resetMail = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Password reset")}&body=${encodeURIComponent(
    ["Hi AUVOX,", "", `Please help me reset the password for ${email.trim() || "my account"}.`, "", "Thanks,", ""].join("\n"),
  )}`;

  return (
    <main ref={root} className="relative overflow-hidden bg-peach text-ink">
      <div className="grain pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-multiply" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_100%_0%,rgba(231,180,126,0.45),transparent_70%)]" />
      <div className="relative mx-auto grid min-h-[100svh] max-w-[1440px] items-center gap-14 px-6 pt-32 pb-24 md:px-12 md:pt-40 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-20">
        {/* left: who this is for */}
        <div className="relative">
          <SectionHead
            as="h1"
            immediate
            kicker="Student space"
            title="Welcome back."
            accent="back."
            body="Log in to see your package, session credits, your next live class and renewal options."
          />
          <div className="lg-disc pointer-events-none relative mt-12 hidden h-56 w-56 opacity-0 lg:block" aria-hidden>
            <div className="absolute inset-0 animate-[spin_14s_linear_infinite] rounded-full bg-[repeating-radial-gradient(circle,#161616_0px,#161616_3px,#222_4px,#161616_5px)] shadow-[0_40px_70px_-30px_rgba(30,30,30,0.6)] motion-reduce:animate-none">
              <div className="absolute inset-[34%] flex items-center justify-center rounded-full bg-cream">
                <Image src="/svg/auvox-logomark.svg" alt="" width={44} height={40} unoptimized className="h-8 w-auto" />
              </div>
            </div>
          </div>
        </div>

        {/* right: the form */}
        <div className="lg-card relative overflow-hidden rounded-[1.75rem] bg-cream p-7 opacity-0 ring-1 ring-ink/10 md:p-10">
          <div className="grain pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-multiply" />
          <form
            noValidate
            className="relative"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <p className="text-[0.62rem] font-medium tracking-[0.38em] text-ink/60 uppercase">Log in</p>
            <Field id="lg-email" label="Email address" type="email" inputMode="email" autoComplete="email" value={email} onChange={setEmail} error={attempted ? errors.email : undefined} className="mt-4" />
            <Field
              id="lg-password"
              label="Password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              error={attempted ? errors.password : undefined}
              className="mt-6"
              trailing={
                <button type="button" onClick={() => setShow((s) => !s)} className="text-[0.62rem] font-semibold tracking-[0.25em] text-ink/60 uppercase hover:text-red" aria-pressed={show}>
                  {show ? "Hide" : "Show"}
                </button>
              }
            />

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <label className="flex cursor-pointer items-center gap-3 text-[0.9rem] text-ink/75 select-none">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-[#850909]" />
                Remember me
              </label>
              <button type="button" onClick={() => setForgot((f) => !f)} className="link-line text-[0.9rem] text-ink/75 hover:text-red" aria-expanded={forgot}>
                Forgot password?
              </button>
            </div>
            {forgot && (
              <p role="status" className="mt-4 rounded-2xl bg-peach/70 px-5 py-4 text-[0.9rem] leading-relaxed text-ink/80">
                We&rsquo;ll reset it for you by email.{" "}
                <a href={resetMail} className="font-medium text-red underline underline-offset-4">
                  Email us for a reset
                </a>
                , the request is already written.
              </p>
            )}

            <div className="mt-9">
              <Button type="submit" variant="red" size="lg" className={clsx("w-full sm:w-auto", busy && "pointer-events-none opacity-70")}>
                {busy ? "Logging in…" : "Log in"}
              </Button>
            </div>
            {attempted && !valid && (
              <p role="alert" className="mt-4 text-[0.85rem] text-red">
                Check the highlighted fields.
              </p>
            )}

            <div className="mt-10 border-t border-ink/10 pt-6 text-[0.9rem] text-ink/70">
              New to AUVOX?{" "}
              <TransitionLink href="/enroll" className="font-medium text-red underline-offset-4 hover:underline">
                Enroll now
              </TransitionLink>{" "}
              or{" "}
              <TransitionLink href="/reserve" className="font-medium text-red underline-offset-4 hover:underline">
                book a free demo
              </TransitionLink>
              .
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
