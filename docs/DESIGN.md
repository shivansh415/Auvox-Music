# AUVOX Music — design & build brief

Target: Awwwards SOTD-level. Every section needs one "wow" moment, but the whole must feel like ONE site:
same type scale, same motion language, same palette, same grain.

## Palette (Tailwind tokens, already in globals.css)
- `bg-peach` #FAE3C5 — page base. "Beige/white background" in the client doc = peach.
- `bg-peach-deep` #DEB886 — arches, shapes, soft panels on peach.
- `bg-tan` #E7B47E — accent shapes, beads, rings, highlights.
- `bg-cream` #FDF2E3 — lighter panels/cards on peach.
- `bg-red` #850909 — brand red: accents, the coloured last word, red sections (bookings page 2).
- `bg-ink` #1E1E1E — black sections (packages, footer). Text on ink = `text-peach`.
- `text-ink` on peach. Never pure white. Never neon. Gradients + grain are REQUIRED by the client:
  use `<div className="grain pointer-events-none absolute inset-[-50%] opacity-[0.04] mix-blend-multiply" />`
  (on ink use `mix-blend-screen opacity-[0.06]`) and soft radial/linear gradients of peach→tan or red→ink.

## Type
- Display: `font-display` (DM Serif Display until the licensed Tan Pearl arrives). Italic for the accent word.
- Body/UI: default sans (Afacad Flux).
- Heading format from the client, always: tiny kicker (T) → large heading (L) with the LAST WORD in
  `text-red` (or `text-tan` on ink) → small body (S). Use `<SectionHead>` for this.
- Kicker: `text-[0.65rem] font-medium tracking-[0.38em] uppercase text-ink/70` preceded by a 40px rule.
- Headline: `font-display text-[clamp(2.4rem,5vw,5.2rem)] leading-[1.0] tracking-[-0.015em]`.
- Labels/buttons: `text-[0.7rem] font-semibold tracking-[0.3em] uppercase`.

## Motion language (GSAP from `@/lib/gsap`: gsap, ScrollTrigger, SplitText, Flip, useGSAP)
- Ease: `expo.out` for entrances, `expo.inOut` for transitions, `power3.out` for pointer follow.
- Text reveals: SplitText lines/words, `yPercent: 110` from an overflow-hidden line, stagger 0.035–0.06.
- Sections enter on ScrollTrigger `start: "top 75%"`, `once: true`. Pinned scenes use `pin: true, scrub: 1`.
- Pointer parallax: write to a shared state object in `useFrame`/ticker, never setState per frame.
- Lenis is the scroller. For scripted scroll use `window.__lenis.scrollTo()` (dev only).
- Hover: magnetic buttons (`<Button>`). No custom cursor (removed at the user's request) — `data-cursor` attributes are inert.
- Reduced motion: respect `prefers-reduced-motion` — skip pins/parallax, keep fades.
- Every tappable thing on touch gets a visible TAP affordance (client rule).

## Shared components (src/components/ui)
- `SectionHead` — T/L/S block with the reveal built in. Props: kicker, title, accent (last word), body, tone ("light" on peach | "dark" on ink/red), align, size.
- `Button` — pill, magnetic. Props: href | onClick, variant ("ink" | "red" | "outline" | "peach"), size, arrow.
- `TransitionLink` / `useTransition().go(href)` — route changes go through the curtain (never bare router.push).
- `Marquee` — infinite horizontal band.
- `Header` / `Footer` — in layout, don't re-add. Sections set `data-theme="dark"` to switch the header to light text over them.
- `ScrollCue` — fixed, global (client: "keep the scroll icon constant"). Don't add per-section scroll hints.

## Layout
- Container: `mx-auto max-w-[1440px] px-6 md:px-12`. Section padding: `py-24 md:py-36`.
- Sections get `id`s used by the nav: `verse-universe`, `journey`, `frequency-box`, `begin`.
- Mobile first and real: stack, keep 3D, smaller. Test in your head at 375 and 1440.

## 3D (R3F + drei, `@react-three/fiber`, `@react-three/drei`, three)
- Models: `/models/guitar-red.glb` (brand-red Ibanez, AUVOX headstock), `/models/casio.glb` (keyboard),
  `/world/moon_rock_04/moon_rock_04_1k.gltf`, `/world/boulder_01/boulder_01_1k.gltf`, HDRI `/world/studio_1k.hdr`.
  Guitar: rotation `[-Math.PI/2, 0, Math.PI]` faces the camera with the neck along +X. See `Hero/World.tsx` `useNormalized`.
- Canvas: `dpr={[1, 2]}`, `alpha`, ACES tone mapping, warm key light from upper-left (`#ffe2bd`), hemisphere fill.
- Keep each canvas light: no postprocessing stacks, ≤ 2 shadow lights, dispose on unmount.
- Never use drei `<Html>` (breaks under React 19 StrictMode here) — project to DOM via state instead.

## Audio
`@/components/sections/Session/audio`: `unlockAudio()`, `playRiff()`, `playChord()`, `pluck(i)`, `blip()`. Call `unlockAudio()` inside a user gesture first.

## Copy
`src/content/*.ts` is the source of truth (client doc, verbatim). Don't invent prices or features.

## Quality bar / checks
- `npx tsc --noEmit -p .` and `npx eslint <your files>` must pass (React Compiler lint rules: no ref reads during render,
  no mutations after render — put them in effects/handlers).
- No layout shift: reserve space for 3D canvases and images.
- Don't touch other people's files beyond adding your import/route. Don't use the browser tools; the lead verifies.
