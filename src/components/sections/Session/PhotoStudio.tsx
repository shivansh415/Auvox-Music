"use client";

// The studio as a "living photograph": the generated plates are layered in an orthographic scene
// (1 world unit = 1 px). The shader also draws the studio as a pencil sketch and paints the photo
// over it with an ink wipe (the intro, and in reverse as the section scrolls away).

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { Line2, LineSegments2 } from "three-stdlib";
import { onPluck, playRiff, pluck, sampleAudio, unlockAudio } from "./audio";
import {
  coverFit,
  dismissGuitarHint,
  HERO_CENTER_X as HERO_CENTER_X_SHARED,
  HERO_PHONE as HERO_PHONE_PX,
  session,
  SIGN_WORDMARK,
} from "./state";

const TAN = "#e7b47e";
const IMG = { w: 1536, h: 1024 };

// ---------------------------------------------------------------------------
// Calibration (pixels in the 1536×1024 plates)
// ---------------------------------------------------------------------------
/** Six strings on 03-A-hero.png, low E (top) → high E, bridge saddles → nut (measured from the fretboard) */
const STRINGS = Array.from({ length: 6 }, (_, i) => ({
  a: [392, 743 + i * 10.8] as [number, number],
  b: [1037, 763 + i * 7.8] as [number, number],
}));
const GUITAR_BODY = { x: 290, y: 650, w: 330, h: 260 };
/** Fraction of each string hidden under his picking hand at the bridge end — lines start past it */
const STRING_VISIBLE_FROM = 0.135;
const PLUCK_CURSOR =
  'url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2722%27 height=%2722%27><circle cx=%2711%27 cy=%2711%27 r=%274.5%27 fill=%27%23e7b47e%27/><circle cx=%2711%27 cy=%2711%27 r=%279.5%27 fill=%27none%27 stroke=%27%23e7b47e%27 stroke-opacity=%27.5%27/></svg>") 11 11, pointer';
const HERO_PHONE = [HERO_PHONE_PX.x, HERO_PHONE_PX.y] as const;
const HERO_CHEST = [680, 560] as const;
/** Strings at rest read as bright silver; a plucked string flares to brand gold */
const STRING_REST = new THREE.Color("#e9e6df");
const STRING_LIT = new THREE.Color(TAN).multiplyScalar(1.5);

/** Pointer pan, as a whole-frame camera drift (uv units at full deflection = PAN * (PAN_DEPTH - 0.5)) */
const PAN = 0.05;
const PAN_DEPTH = 0.75;
/** Slight overscan so the pan never reveals the plate's edge */
const OVERSCAN = 1.035;

const uvOf = (px: number, py: number) => new THREE.Vector2(px / IMG.w, 1 - py / IMG.h);
const smooth = (p: number, a: number, b: number) => THREE.MathUtils.clamp((p - a) / (b - a), 0, 1);

// ---------------------------------------------------------------------------
// Shared per-frame values, written once by <Driver>, read by every layer
// ---------------------------------------------------------------------------
const frame = {
  parallax: new THREE.Vector2(),
  heroZoom: 1,
  /** uv shift to the right while the conversation is open, so the bubbles don't sit on the guitar */
  shift: 0,
  /** the ink wipe actually drawn: the intro reveal, undone again as the section scrolls away */
  reveal: 0,
  flicker: 1,
  breath: 0,
  time: 0,
  pointer: new THREE.Vector2(0.5, 0.5),
};

/** Cover-fit plane size, plus a horizontal shift that keeps `centerX` (image uv) in view on narrow screens. */
function useCover(centerX = 0.5) {
  const { size } = useThree();
  const s = Math.max(size.width / IMG.w, size.height / IMG.h);
  const w = IMG.w * s;
  const h = IMG.h * s;
  const maxShift = Math.max(0, (w - size.width) / 2);
  const shift = THREE.MathUtils.clamp((0.5 - centerX) * w, -maxShift, maxShift);
  return { w, h, s, shift };
}
const HERO_CENTER_X = HERO_CENTER_X_SHARED;

// ---------------------------------------------------------------------------
// Plate shader
// ---------------------------------------------------------------------------
const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uMap, uDepth, uMaskRed, uMaskLamp;
  uniform float uHasAlpha, uHasMasks, uSketch;
  uniform vec2 uParallax, uFocus, uChest, uPhone, uPointer;
  uniform float uZoom, uParallaxScale, uDepthZoom, uBreath, uDepthFlat, uDepthMix, uShift;
  uniform vec3 uLights;      // red, lamp, ambient
  uniform float uAudio, uFlicker, uTime, uGrain, uVignette, uFade, uPhoneGlow, uReveal, uBloom;
  varying vec2 vUv;

  const vec2 TEXEL = vec2(1.0 / 1536.0, 1.0 / 1024.0);
  const vec2 ASPECT = vec2(1.5, 1.0);

  float hashn(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hashn(i), hashn(i + vec2(1, 0)), f.x), mix(hashn(i + vec2(0, 1)), hashn(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int k = 0; k < 4; k++) { v += a * vnoise(p); p = p * 2.03 + 11.3; a *= 0.5; }
    return v;
  }
  float lumOf(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
  float lumAt(vec2 uv) { return lumOf(texture2D(uMap, uv).rgb); }
  // a thin dark line through the middle of each unit cell
  float hatch(float v) { return 1.0 - smoothstep(0.0, 0.24, abs(fract(v) - 0.5) * 2.0); }

  // The studio as a white-line etching on dark space (the un-painted world): Sobel edges, inverted,
  // with a faint ghost of the tones, and a galaxy of particles floating over it.
  vec3 etching(vec2 uv, vec3 base, vec2 scr) {
    float tl = lumAt(uv + TEXEL * vec2(-1.0,  1.0)), tc = lumAt(uv + TEXEL * vec2(0.0,  1.0)), tr = lumAt(uv + TEXEL * vec2(1.0,  1.0));
    float ml = lumAt(uv + TEXEL * vec2(-1.0,  0.0)),                                              mr = lumAt(uv + TEXEL * vec2(1.0,  0.0));
    float bl = lumAt(uv + TEXEL * vec2(-1.0, -1.0)), bc = lumAt(uv + TEXEL * vec2(0.0, -1.0)), br = lumAt(uv + TEXEL * vec2(1.0, -1.0));
    float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
    float gy = (bl + 2.0 * bc + br) - (tl + 2.0 * tc + tr);
    float edge = smoothstep(0.04, 0.30, length(vec2(gx, gy)));
    float lum = lumOf(base);
    // a trace of the tones, like a plate that was only lightly inked
    vec3 ghost = base * 0.16 + vec3(0.03, 0.035, 0.05);
    vec3 line = vec3(0.92, 0.93, 0.96);
    vec3 col = mix(ghost, line, edge * (0.55 + 0.45 * lum));
    // fine engraving texture along the strokes
    col -= (vnoise(scr * 700.0) - 0.5) * 0.06;
    return col;
  }

  // Galaxy: the photo itself as a field of dots — denser and brighter where the picture is light —
  // plus a few twinkling 4-point stars. Reads as a star cloud that still holds the room's shapes.
  vec3 galaxy(vec2 scr, vec2 uv, float amount) {
    vec3 g = vec3(0.0);
    for (int k = 0; k < 3; k++) {
      float scale = (k == 0) ? 60.0 : (k == 1) ? 120.0 : 240.0;
      vec2 gp = scr * scale + float(k) * 7.3;
      vec2 cell = floor(gp);
      vec2 jitter = (vec2(hashn(cell + 1.3), hashn(cell + 5.1)) - 0.5) * 0.7;
      vec2 cuv = fract(gp) - 0.5 + jitter;
      vec2 cellUv = uv + (cell + 0.5 + jitter - gp) / scale / ASPECT;
      float lum = lumAt(cellUv);
      float r = hashn(cell + float(k));
      float keep = step(1.0 - amount * (0.10 + 0.55 * lum), r);
      float rad = (k == 0) ? 0.10 : (k == 1) ? 0.075 : 0.055;
      float dotm = 1.0 - smoothstep(rad, rad + 0.06, length(cuv));
      float bright = ((k == 0) ? 0.35 : (k == 1) ? 0.7 : 1.0) * (0.35 + 0.65 * lum);
      g += dotm * keep * bright * (0.75 + 0.25 * sin(uTime * (1.5 + r * 3.0) + r * 40.0));
    }
    vec2 sp = scr * 26.0;
    vec2 cell = floor(sp);
    vec2 cuv = fract(sp) - 0.5 + (vec2(hashn(cell + 2.7), hashn(cell + 8.9)) - 0.5) * 0.7;
    float r = hashn(cell + 3.3);
    float star = (max(1.0 - abs(cuv.x) * 9.0, 0.0) * max(1.0 - abs(cuv.y) * 2.2, 0.0)
                + max(1.0 - abs(cuv.y) * 9.0, 0.0) * max(1.0 - abs(cuv.x) * 2.2, 0.0));
    float core = exp(-dot(cuv, cuv) * 60.0);
    float tw = 0.5 + 0.5 * sin(uTime * 2.2 + r * 60.0);
    g += (star * 0.9 + core) * step(0.985, r) * tw * amount;
    return g;
  }

  // Glitter: a band of bright specks, several sizes, each flickering at its own rate and drifting
  // outward from the portal. This is the rim and the "sparkle" that pours over the freshly painted edge.
  float glitter(vec2 scr, vec2 dir, float band) {
    float g = 0.0;
    for (int k = 0; k < 3; k++) {
      float scale = (k == 0) ? 140.0 : (k == 1) ? 260.0 : 420.0;
      vec2 gp = scr * scale + float(k) * 3.7;
      vec2 cell = floor(gp);
      float r = hashn(cell + float(k) * 1.1), r2 = hashn(cell + 7.7 + float(k));
      float life = fract(uTime * (0.8 + r2 * 0.8) + r * 9.0);
      vec2 cuv = fract(gp) - 0.5 - dir * (life - 0.5) * 0.8;
      float speck = exp(-dot(cuv, cuv) * ((k == 0) ? 22.0 : 40.0));
      float flicker = pow(0.5 + 0.5 * sin(uTime * (6.0 + r * 18.0) + r2 * 30.0), 3.0);
      float keep = step(1.0 - band * 0.55, r);
      g += speck * keep * (0.5 + 0.9 * flicker) * ((k == 0) ? 1.2 : (k == 1) ? 0.9 : 0.7);
    }
    return g;
  }

  void main() {
    // push-in: scale the image around the focus point
    vec2 uv = uFocus + (vUv - uFocus) / uZoom;
    // breathing: a tiny scale around the chest
    uv = uChest + (uv - uChest) / (1.0 + uBreath);
    uv.x -= uShift;
    float d = mix(uDepthFlat, texture2D(uDepth, uv).r, uDepthMix); // 1 = near
    // nearer pixels slide more with the pointer, and spread more as the camera pushes in
    vec2 off = uParallax * uParallaxScale * (d - 0.5)
             + (uv - uFocus) * (uZoom - 1.0) * uDepthZoom * (d - 0.5);
    uv += off;

    vec4 tex = texture2D(uMap, uv);
    float alpha = uHasAlpha > 0.5 ? tex.a : 1.0;
    vec3 base = tex.rgb;
    float red = uHasMasks > 0.5 ? texture2D(uMaskRed, uv).r : 0.0;
    float lamp = uHasMasks > 0.5 ? texture2D(uMaskLamp, uv).r : 0.0;

    // Dark room: almost nothing, except the phone lighting his face.
    float glow = exp(-distance(uv, uPhone) * 9.0) * uPhoneGlow;
    vec3 dark = base * 0.04 + base * glow * vec3(0.9, 0.95, 1.15) * 2.4;
    dark += base * red * uLights.x * 1.3;
    dark += base * lamp * uLights.y * uFlicker * 0.9;
    vec3 col = mix(dark, base, uLights.z);
    // the guitar makes the LED light pulse; the bloom is the wipe landing
    col += base * red * (uAudio * 0.5 + uBloom * 0.9);

    // The portal. A circle grows out of the phone; its rim is a wide band of white-hot glitter that
    // keeps pouring over the freshly painted edge; outside it the world is a white-line etching under
    // a galaxy made of the photo's own light. uReveal 0 = closed (a point on the phone), 1 = all painted.
    if (uSketch > 0.5) {
      vec2 scr = vUv * ASPECT;
      vec2 c = uPhone * ASPECT;
      float dist = distance(scr, c);
      float rr = 0.02 + pow(uReveal, 1.5) * 1.95;
      float n = (fbm(scr * 4.0 + uTime * 0.2) - 0.5) * 0.12 * (0.4 + 0.6 * uReveal)
              + exp(-distance(scr, uPointer * ASPECT) * 5.0) * 0.05 * uReveal;
      float d = dist - rr + n;             // < 0 inside
      float moving = step(0.001, uReveal) * step(uReveal, 0.999);

      vec3 etched = etching(uv, base, scr) + galaxy(scr, uv, 1.0) * 0.95;
      float inside = 1.0 - smoothstep(-0.006, 0.006, d);
      vec3 outc = mix(etched, col, inside);

      // soft bloom either side of the edge, warm just outside, white inside
      vec3 hot = vec3(1.0, 0.98, 0.94);
      vec3 warm = vec3(1.0, 0.78, 0.5);
      float bloomIn = exp(-max(-d, 0.0) * 9.0) * inside;
      float bloomOut = exp(-max(d, 0.0) * 22.0) * (1.0 - inside);
      outc += hot * bloomIn * 0.35 + warm * bloomOut * 0.45;
      // a thin hot seam right at the edge
      outc += hot * exp(-abs(d) * 260.0) * (0.9 + 0.8 * fbm(scr * 50.0 + uTime * 2.0));

      // the glitter: densest at the seam, trailing well inside the painted area
      vec2 dir = normalize(scr - c + 1e-4);
      float band = exp(-max(-d, 0.0) * 11.0) * inside + exp(-max(d, 0.0) * 30.0) * (1.0 - inside) * 0.6;
      float gl = glitter(scr, dir, band);
      outc += hot * gl * band * (1.6 * moving + 0.25);

      col = outc;
    }

    float n2 = fract(sin(dot(vUv * 913.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
    col += (n2 - 0.5) * uGrain;
    float v = smoothstep(1.25, 0.3, distance(vUv, vec2(0.5)) * 1.35);
    col *= mix(1.0, v, uVignette);

    gl_FragColor = vec4(col, alpha * uFade);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

type PlateTextures = { map: THREE.Texture; depth: THREE.Texture; red?: THREE.Texture; lamp?: THREE.Texture };

function makeUniforms(t: PlateTextures, focus: THREE.Vector2, hasAlpha: boolean) {
  return {
    uMap: { value: t.map },
    uDepth: { value: t.depth },
    uMaskRed: { value: t.red ?? t.depth },
    uMaskLamp: { value: t.lamp ?? t.depth },
    uHasAlpha: { value: hasAlpha ? 1 : 0 },
    uHasMasks: { value: t.red ? 1 : 0 },
    uParallax: { value: new THREE.Vector2() },
    uFocus: { value: focus },
    uChest: { value: uvOf(...HERO_CHEST) },
    uPhone: { value: uvOf(...HERO_PHONE) },
    uZoom: { value: 1 },
    uParallaxScale: { value: 0.01 },
    uDepthZoom: { value: 0.2 },
    uDepthFlat: { value: 0.5 },
    uDepthMix: { value: 1 },
    uBreath: { value: 0 },
    uLights: { value: new THREE.Vector3() },
    uAudio: { value: 0 },
    uFlicker: { value: 1 },
    uTime: { value: 0 },
    uGrain: { value: 0.018 },
    uVignette: { value: 0.0 },
    uFade: { value: 1 },
    uPhoneGlow: { value: 1 },
    uSketch: { value: 0 },
    uReveal: { value: 0 },
    uBloom: { value: 0 },
    uShift: { value: 0 },
    uPointer: { value: new THREE.Vector2(0.5, 0.5) },
  };
}

/** useTexture's onLoad gets the textures in key order (typed as an object, delivered as an array): the first is the colour map. */
function configure(loaded: unknown) {
  const list = Array.isArray(loaded) ? loaded : Object.values(loaded as Record<string, THREE.Texture>);
  (list as THREE.Texture[]).forEach((t, i) => {
    t.colorSpace = i === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
  });
}

type PlateProps = {
  textures: PlateTextures;
  focus: THREE.Vector2;
  centerX?: number;
  hasAlpha?: boolean;
  parallaxScale: number;
  depthZoom?: number;
  z: number;
  /** Called every frame with the material's uniforms so the plate can read the shared frame values */
  update: (u: ReturnType<typeof makeUniforms>) => void;
};

function Plate({ textures, focus, centerX = 0.5, hasAlpha = false, parallaxScale, depthZoom = 0.2, z, update }: PlateProps) {
  const { w, h, shift } = useCover(centerX);
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => makeUniforms(textures, focus, hasAlpha), [textures, focus, hasAlpha]);

  useFrame(() => {
    const m = material.current;
    if (!m) return;
    const u = m.uniforms as ReturnType<typeof makeUniforms>;
    u.uParallax.value.copy(frame.parallax);
    u.uParallaxScale.value = parallaxScale;
    u.uDepthZoom.value = depthZoom;
    u.uLights.value.set(session.lights.red, session.lights.lamp, session.lights.ambient);
    u.uAudio.value = session.audio.level;
    u.uFlicker.value = frame.flicker;
    u.uTime.value = frame.time;
    u.uShift.value = frame.shift;
    u.uReveal.value = frame.reveal;
    u.uBloom.value = session.bloom;
    u.uPointer.value.copy(frame.pointer);
    update(u);
  });

  return (
    <mesh position={[shift, 0, z]} renderOrder={z}>
      <planeGeometry args={[w, h]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------
function Studio() {
  const bg = useTexture(
    { map: "/scene/hero.jpg", depth: "/scene/hero-depth.jpg", red: "/scene/mask-red.jpg", lamp: "/scene/mask-lamp.jpg" },
    configure,
  ) as unknown as PlateTextures;

  const sign = useTexture({ map: "/scene/sign.webp", depth: "/scene/hero-depth.jpg" }, configure) as unknown as PlateTextures;

  const heroFocus = useMemo(() => uvOf(...HERO_PHONE), []);

  return (
    <>
      {/* the studio, wall left bare */}
      <Plate
        textures={bg}
        focus={heroFocus}
        centerX={HERO_CENTER_X}
        parallaxScale={PAN}
        depthZoom={0}
        z={0}
        update={(u) => {
          u.uZoom.value = frame.heroZoom;
          u.uPhoneGlow.value = 1 + session.phonePulse * 2.5;
          // one photo, moved as a whole: no depth warping, so nothing can double up
          u.uDepthFlat.value = PAN_DEPTH;
          u.uDepthMix.value = 0;
          u.uSketch.value = 1;
        }}
      />
      {/* the wall sign: the preloader's logo lands here and becomes it — red ink on the sketch, a lit sign once painted */}
      <Plate
        textures={sign}
        focus={heroFocus}
        centerX={HERO_CENTER_X}
        hasAlpha
        parallaxScale={PAN}
        depthZoom={0}
        z={0.5}
        update={(u) => {
          u.uZoom.value = frame.heroZoom;
          u.uDepthFlat.value = PAN_DEPTH;
          u.uDepthMix.value = 0;
          u.uLights.value.set(0, 0, 1);
          u.uPhoneGlow.value = 0;
          u.uFade.value = session.sign;
        }}
      />
      <Strings />
    </>
  );
}

// ---------------------------------------------------------------------------
// Playable strings drawn over the photo's strings: silver at rest, gold while ringing
// ---------------------------------------------------------------------------
const SEGMENTS = 40;
/** The whole plate pans as one: strings use the same flat depth so they stay glued to the photo */
const STRING_DEPTH = PAN_DEPTH;
const STRING_PARALLAX = PAN;

function Strings() {
  const { w, h, shift } = useCover(HERO_CENTER_X);
  const group = useRef<THREE.Group>(null);
  const lines = useRef<(Line2 | LineSegments2 | null)[]>([]);
  const energy = useRef(new Float32Array(6));
  const age = useRef(new Float32Array(6));
  const phase = useRef(new Float32Array(6));
  const scratch = useRef(new Float32Array((SEGMENTS + 1) * 3));
  const hintPoint = useRef(new THREE.Vector3());
  const par = useRef(new THREE.Vector2());

  const toWorld = (px: number, py: number): [number, number] => [(px / IMG.w - 0.5) * w, (0.5 - py / IMG.h) * h];
  const geometry = useMemo(
    () =>
      STRINGS.map((s) => {
        const a = toWorld(...s.a);
        const b = toWorld(...s.b);
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const points = Array.from({ length: SEGMENTS + 1 }, (_, k) => {
          const u = STRING_VISIBLE_FROM + (1 - STRING_VISIBLE_FROM) * (k / SEGMENTS);
          return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, 2] as [number, number, number];
        });
        return { a, b, len, angle, mid, points };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [w, h],
  );
  const focusWorld = useMemo(() => toWorld(...HERO_PHONE), [w, h]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () =>
      onPluck((i) => {
        energy.current[i] = 1;
        age.current[i] = 0;
        phase.current[i] = Math.random() * Math.PI * 2;
      }),
    [],
  );

  useFrame(({ size }, dt) => {
    const g = group.current;
    if (!g) return;
    // follow the hero layer: push-in scale around the phone + depth parallax
    const z = frame.heroZoom;
    const pv = par.current.copy(frame.parallax).multiplyScalar(STRING_PARALLAX * (STRING_DEPTH - 0.5));
    g.scale.set(z, z, 1);
    g.position.set(shift + frame.shift * w + focusWorld[0] * (1 - z) - pv.x * w, focusWorld[1] * (1 - z) - pv.y * h, 0);
    for (let i = 0; i < 6; i++) {
      const line = lines.current[i];
      if (!line) continue;
      const e = energy.current[i];
      const glow = Math.min(1, e * 2.5);
      const mat = line.material as THREE.Material & { opacity: number; color: THREE.Color; linewidth: number };
      mat.opacity = 0.55 + 0.45 * glow;
      mat.color.copy(STRING_REST).lerp(STRING_LIT, glow);
      mat.linewidth = (1.1 - i * 0.08) * (1 + glow * 0.8);
      if (e < 0.004) continue;
      age.current[i] += dt;
      energy.current[i] = e * Math.exp(-dt * 2.6);
      const { a, b, angle } = geometry[i];
      const t = age.current[i];
      const amp = 7 * e;
      const wv = 34 + i * 5;
      const nx = -Math.sin(angle);
      const ny = Math.cos(angle);
      for (let k = 0; k <= SEGMENTS; k++) {
        const u = STRING_VISIBLE_FROM + (1 - STRING_VISIBLE_FROM) * (k / SEGMENTS);
        const env = Math.sin(Math.PI * u);
        const s = amp * env * (Math.sin(t * wv + phase.current[i]) + 0.35 * Math.sin(2 * Math.PI * u) * Math.sin(t * wv * 2.1));
        scratch.current[k * 3] = a[0] + (b[0] - a[0]) * u + nx * s;
        scratch.current[k * 3 + 1] = a[1] + (b[1] - a[1]) * u + ny * s;
        scratch.current[k * 3 + 2] = 2;
      }
      line.geometry.setPositions(scratch.current);
    }

    // TAP hint anchored above the guitar body
    const [hx, hy] = toWorld(GUITAR_BODY.x + GUITAR_BODY.w * 0.45, GUITAR_BODY.y + 20);
    hintPoint.current.set(hx, hy, 0).applyMatrix4(g.matrixWorld);
    session.hintScreen.x = size.width / 2 + hintPoint.current.x;
    session.hintScreen.y = size.height / 2 - hintPoint.current.y;
    session.hintScreen.opacity = session.guitarHint * session.guitarHintIn * (1 - smooth(session.progress, 0, 0.12));
  });

  const strike = (i: number) => {
    dismissGuitarHint();
    pluck(i, 1);
  };
  const strum = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    dismissGuitarHint();
    playRiff();
  };
  const body = toWorld(GUITAR_BODY.x + GUITAR_BODY.w / 2, GUITAR_BODY.y + GUITAR_BODY.h / 2);

  return (
    <group ref={group}>
      {geometry.map((s, i) => (
        <Line
          key={i}
          ref={(el) => {
            lines.current[i] = el;
          }}
          points={s.points}
          color={STRING_REST}
          lineWidth={1.1 - i * 0.08}
          transparent
          opacity={0.55}
          frustumCulled={false}
          material-toneMapped={false}
          renderOrder={2}
        />
      ))}
      {/* hit zones along each string — crossing one plucks it, so a swipe is a strum */}
      {geometry.map((s, i) => (
        <mesh
          key={i}
          position={[s.mid[0], s.mid[1], 2]}
          rotation={[0, 0, s.angle]}
          onPointerEnter={() => strike(i)}
          onPointerOver={() => (document.body.style.cursor = PLUCK_CURSOR)}
          onPointerOut={() => (document.body.style.cursor = "")}
        >
          <planeGeometry args={[s.len, 9]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
      {/* guitar body: tap for the riff */}
      <mesh
        position={[body[0], body[1], 1.5]}
        onPointerDown={strum}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <planeGeometry args={[(GUITAR_BODY.w * w) / IMG.w, (GUITAR_BODY.h * h) / IMG.h]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Dust in the lamp light
// ---------------------------------------------------------------------------
const DUST_COUNT = 70;
const hash = (n: number) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

function Dust() {
  const { w, h } = useCover();
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const pos = new Float32Array(DUST_COUNT * 3);
    for (let i = 0; i < DUST_COUNT; i++) {
      // only where the LED strip and the spots actually light the air: the centre band of the room
      pos[i * 3] = (0.28 + hash(i * 3) * 0.5 - 0.5) * w;
      pos[i * 3 + 1] = (0.30 + hash(i * 3 + 1) * 0.5 - 0.5) * h;
      pos[i * 3 + 2] = 2.5;
    }
    return pos;
  }, [w, h]);
  useFrame(({ clock }, dt) => {
    const mesh = points.current;
    if (!mesh) return;
    const attr = mesh.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const t = clock.elapsedTime;
    const kick = session.audio.level * 40;
    for (let i = 0; i < DUST_COUNT; i++) {
      arr[i * 3] += Math.sin(t * 0.3 + i) * 2 * dt;
      arr[i * 3 + 1] += (6 + kick) * dt;
      if (arr[i * 3 + 1] > h * 0.3) arr[i * 3 + 1] = -h * 0.2;
    }
    attr.needsUpdate = true;
    (mesh.material as THREE.PointsMaterial).opacity = 0.3 * frame.reveal;
  });
  return (
    <points ref={points} renderOrder={2}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={TAN} size={2.2} transparent opacity={0} depthWrite={false} depthTest={false} sizeAttenuation={false} />
    </points>
  );
}

// ---------------------------------------------------------------------------
// Drives the shared frame values from scroll, pointer, lights and audio
// ---------------------------------------------------------------------------
function Driver() {
  const smoothMouse = useRef(new THREE.Vector2());
  useFrame(({ clock, size }, dt) => {
    sampleAudio(session.audio);
    const t = clock.elapsedTime;
    // critically-damped ease towards the pointer, plus a slow idle sway so the room never sits still
    const k = 1 - Math.exp(-dt * 2.2);
    const targetX = session.mouse.x + Math.sin(t * 0.23) * 0.12;
    const targetY = session.mouse.y + Math.cos(t * 0.19) * 0.08;
    smoothMouse.current.x += (targetX - smoothMouse.current.x) * k;
    smoothMouse.current.y += (targetY - smoothMouse.current.y) * k;

    // No scroll zoom: only the gentle lean towards the phone while the conversation is open.
    frame.parallax.copy(smoothMouse.current);
    frame.heroZoom = OVERSCAN + 0.12 * session.focus;
    frame.shift = 0.045 * session.focus;
    // the wipe paints the room in, and un-paints it again as the section leaves the screen
    frame.reveal = session.reveal * (1 - smooth(session.progress, 0.02, 0.6));
    frame.pointer.set(session.mouse.x * 0.5 + 0.5, session.mouse.y * 0.5 + 0.5);
    frame.time = clock.elapsedTime;
    session.phonePulse *= Math.exp(-dt * 4);
    // the zoom pivots on the phone, so its screen position only drifts with the parallax
    const { w, h, shift } = coverFit(size.width, size.height);
    // Where the sign's wordmark is on screen right now (plate px → shader uv → screen), for the preloader handoff.
    {
      const z = frame.heroZoom;
      const fx = HERO_PHONE[0] / IMG.w;
      const fy = 1 - HERO_PHONE[1] / IMG.h;
      const ox = frame.parallax.x * PAN * (PAN_DEPTH - 0.5) - frame.shift;
      const oy = frame.parallax.y * PAN * (PAN_DEPTH - 0.5);
      const toScreen = (px: number, py: number) => {
        const vx = fx + (px / IMG.w - ox - fx) * z;
        const vy = fy + (1 - py / IMG.h - oy - fy) * z;
        return [size.width / 2 + shift + (vx - 0.5) * w, size.height / 2 - (vy - 0.5) * h];
      };
      const [x0, y0] = toScreen(SIGN_WORDMARK.x, SIGN_WORDMARK.y);
      const [x1, y1] = toScreen(SIGN_WORDMARK.x + SIGN_WORDMARK.w, SIGN_WORDMARK.y + SIGN_WORDMARK.h);
      Object.assign(session.signScreen, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
    session.phoneScreen.x =
      size.width / 2 + shift + (HERO_PHONE[0] / IMG.w - 0.5 + frame.shift) * w - frame.parallax.x * PAN * (PAN_DEPTH - 0.5) * w;
    session.phoneScreen.y = size.height / 2 + (HERO_PHONE[1] / IMG.h - 0.5) * h + frame.parallax.y * PAN * (PAN_DEPTH - 0.5) * h;
    frame.breath = Math.sin(clock.elapsedTime * 1.1) * 0.004;
    const a = session.audio.level;
    frame.flicker = session.lights.lamp > 0.9 ? 1 + Math.sin(t * 37) * Math.sin(t * 11) * (0.015 + a * 0.25) : 1;
    session.frames += 1;
  });
  return null;
}

export default function PhotoStudio() {
  return (
    <Canvas
      className="absolute inset-0"
      style={{ touchAction: "pan-y" }}
      dpr={[1, 1.25]}
      orthographic
      camera={{ position: [0, 0, 100], zoom: 1, near: 0.1, far: 1000 }}
      gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping }}
      onPointerDown={unlockAudio}
    >
      <color attach="background" args={["#070606"]} />
      <Suspense fallback={null}>
        <Studio />
      </Suspense>
      <Dust />
      <Driver />
    </Canvas>
  );
}
