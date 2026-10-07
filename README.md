# AUVOX Music

Website for AUVOX Music, an online guitar and piano academy.

## Setup

Requires Node 20+.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The preloader plays on every reload during development.

Before opening a Pull Request:

```bash
npm run build
npm run lint
```

Both must pass with zero errors.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4. Brand tokens live in `src/app/globals.css` |
| Animation | GSAP with ScrollTrigger, SplitText, DrawSVG, MorphSVG and CustomEase; Motion |
| Scroll | Lenis, synced with ScrollTrigger in `SmoothScroll.tsx` |
| 3D | Three.js, React Three Fiber, Drei |
| State | Zustand |

## Structure

```
src/
  app/                    layout, page, global styles
  components/
    preloader/            finished, don't rebuild
    providers/            SmoothScroll (Lenis + GSAP ticker)
    sections/             one file per page section (Hero.tsx, VerseUniverse.tsx, …)
    ui/                   shared pieces (buttons, the T/L/S heading, scroll indicator, …)
  lib/
    gsap.ts               import gsap and plugins from here, never from "gsap" directly
    utils.ts              cn() class helper
  store/
    preloader.ts          `done` flips to true when the preloader leaves; start the hero intro from it
  hooks/
public/
  svg/                    logo files
  fonts/                  Tan Pearl goes here when the client sends it
```

## Brand

| Token | Hex | Tailwind |
|---|---|---|
| Red | `#850909` | `bg-red`, `text-red` |
| Tan | `#E7B47E` | `bg-tan`, `text-tan` |
| Pearl | `#F1EDE9` | `bg-pearl`, `text-pearl` |
| Ink | `#1E1E1E` | `bg-ink`, `text-ink` |

- Headings use `font-display`. It is Tan Pearl once the files arrive and falls back to Afacad Flux until then.
- Body text uses `font-sans` (Afacad Flux).
- A film-grain overlay is available as `.grain`.

## Conventions

- **GSAP:** animate inside `useGSAP()` and import from `@/lib/gsap`, so animations clean up on unmount.
- **Performance:**
  - Animate only `transform` and `opacity`.
  - Lazy-load 3D models and heavy images, and use `next/image`.
- **Reduced motion:** respect `prefers-reduced-motion`.
- **Git:**
  - Use one branch per section, e.g. `feat/hero`.
  - Open a PR to `main`; Vercel builds a preview for every PR.
  - Never push to `main` directly.
- **Dependencies:** ask before adding a new library.
