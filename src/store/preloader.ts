import { create } from "zustand";

type PreloaderState = {
  /** 0–100, mirrors the on-screen counter */
  progress: number;
  /** true once the preloader has fully left the screen — hero animations key off this */
  done: boolean;
  setProgress: (progress: number) => void;
  finish: () => void;
};

export const usePreloaderStore = create<PreloaderState>((set) => ({
  progress: 0,
  done: false,
  setProgress: (progress) => set({ progress }),
  finish: () => set({ done: true, progress: 100 }),
}));
