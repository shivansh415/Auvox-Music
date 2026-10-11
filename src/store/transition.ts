import { create } from "zustand";

/** Route changes go through the curtain: `go(href)` closes it, the new page opens it. */
type TransitionState = {
  /** curtain is covering the page */
  covering: boolean;
  /** target href while a transition is in flight */
  pending: string | null;
  go: (href: string) => void;
  _set: (s: Partial<TransitionState>) => void;
};

export const useTransitionStore = create<TransitionState>((set) => ({
  covering: false,
  pending: null,
  go: (href) => set({ pending: href }),
  _set: (s) => set(s),
}));

export const useTransition = () => useTransitionStore((s) => s.go);
