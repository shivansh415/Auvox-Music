"use client";

import { useSyncExternalStore } from "react";
import { packageById, type Package } from "@/content/packages";

/**
 * The enrollment hand-off between /enroll → /payment → /dashboard.
 * UI-only: everything lives in `sessionStorage` under one key, nothing leaves the browser.
 */
export const STORAGE_KEY = "auvox:enrollment";
const CHANGE_EVENT = "auvox:enrollment";

export const DEFAULT_PACKAGE_ID: Package["id"] = "guitar-complete";
export const TSHIRT_SIZES = ["XS", "S", "M", "L", "XL"] as const;
export const CLASS_TIMES = ["Mornings", "Afternoons", "Evenings", "Weekends"] as const;

export type Student = {
  name: string;
  age: string;
  phone: string;
  email: string;
  tshirt: string;
  city: string;
  address: string;
  classTime: string;
  notes: string;
};

export type Enrollment = {
  v: 1;
  student: Student;
  packageId: Package["id"];
  /** add-on names (from `Package.addOns`) the student switched on */
  addOns: string[];
  /** CAD, package + add-ons */
  total: number;
  savedAt: string;
  /** set by /payment after the mock charge — never the full card number */
  payment?: { brand: string; last4: string; name: string; postal: string; paidAt: string };
};

export const EMPTY_STUDENT: Student = { name: "", age: "", phone: "", email: "", tshirt: "", city: "", address: "", classTime: "", notes: "" };

/** mock student shown on /dashboard when nothing was saved */
export const MOCK_STUDENT: Student = {
  name: "Jordan Lee",
  age: "24",
  phone: "+1 (416) 555-0148",
  email: "jordan.lee@example.com",
  tshirt: "M",
  city: "Toronto",
  address: "88 Queen St W, Toronto, ON M5H 2M5",
  classTime: "Evenings",
  notes: "",
};

export const money = (n: number) => `$${n.toFixed(2)}`;

/** the add-ons that actually exist on this package (a switch of package drops the rest) */
export const activeAddOns = (pkg: Package, names: readonly string[]) => pkg.addOns.filter((a) => names.includes(a.name));

export const totalFor = (pkg: Package, names: readonly string[]) => activeAddOns(pkg, names).reduce((sum, a) => sum + a.price, pkg.price);

export function parseEnrollment(raw: string | null | undefined): Enrollment | null {
  if (!raw) return null;
  try {
    const e = JSON.parse(raw) as Partial<Enrollment>;
    const pkg = packageById(e.packageId ?? "");
    if (e.v !== 1 || !pkg || !e.student) return null;
    const addOns = Array.isArray(e.addOns) ? e.addOns.filter((n): n is string => typeof n === "string") : [];
    return {
      v: 1,
      student: { ...EMPTY_STUDENT, ...e.student },
      packageId: pkg.id,
      addOns,
      total: totalFor(pkg, addOns),
      savedAt: e.savedAt ?? "",
      payment: e.payment,
    };
  } catch {
    return null;
  }
}

export function saveEnrollment(e: Enrollment) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(e));
  } catch {
    /* private mode: the pages still work from defaults */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearEnrollment() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// ---------- hydration-safe client snapshot ----------
// `null` on the server and during hydration; afterwards the stored enrollment (raw) plus a timestamp.
// Both pieces update together so pages re-key exactly once after mount.

export type ClientSnapshot = { raw: string | null; now: number };

let snapshot: ClientSnapshot | null = null;

const readStorage = () => {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};
const read = (): ClientSnapshot => ({ raw: readStorage(), now: Date.now() });
const getSnapshot = () => (snapshot ??= read());
const getServerSnapshot = () => null;
const subscribe = (cb: () => void) => {
  const handle = () => {
    snapshot = read();
    cb();
  };
  window.addEventListener("storage", handle);
  window.addEventListener(CHANGE_EVENT, handle);
  return () => {
    window.removeEventListener("storage", handle);
    window.removeEventListener(CHANGE_EVENT, handle);
  };
};

/** `null` until the component is on the client; then `{ raw, now }`. */
export const useClientSnapshot = () => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
