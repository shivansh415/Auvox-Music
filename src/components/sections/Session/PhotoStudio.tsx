"use client";

// The studio as a "living photograph" in 3D: the plates are planes displaced by their depth maps
// (1 world unit = 1 CSS px on the plane at z = 0) in front of a perspective camera that trucks with the
// pointer, so the room has real parallax. The hero plate sits over the empty room; where the hero's
// depth jumps (his silhouette) the stretched skirts are discarded and the room behind shows through.
// The shader also draws the un-painted world as an etching under a galaxy and paints the photo in
// through the portal (the intro, and in reverse as the section scrolls away).

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { Line2, LineSegments2 } from "three-stdlib";
import { onPluck, playRiff, pluck, sampleAudio, unlockAudio } from "./audio";
import {
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
/** Where each string comes out from under his picking hand (fraction of its length, measured from the plate) */
const STRING_VISIBLE_FROM = [0.3, 0.31, 0.3, 0.3, 0.28, 0.26];
const PLUCK_CURSOR =
  'url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2722%27 height=%2722%27><circle cx=%2711%27 cy=%2711%27 r=%274.5%27 fill=%27%23e7b47e%27/><circle cx=%2711%27 cy=%2711%27 r=%279.5%27 fill=%27none%27 stroke=%27%23e7b47e%27 stroke-opacity=%27.5%27/></svg>") 11 11, pointer';
const HERO_PHONE = [HERO_PHONE_PX.x, HERO_PHONE_PX.y] as const;
const HERO_CHEST = [680, 560] as const;
/** Strings at rest read as bright silver; each plucked string flares in its own colour */
const STRING_REST = new THREE.Color("#e9e6df");
const STRING_LIT = ["#ff3b3b", "#ff8c2a", "#ffd43b", "#3ddc84", "#3fa9ff", "#b56cff"].map((c) =>
  new THREE.Color(c).multiplyScalar(1.5),
);

/** How far near pixels pop toward the camera, as a fraction of the plane height */
const DEPTH_SCALE = 0.45;
/** Camera field of view; the distance is derived so the plane fills the viewport at z = 0 */
const FOV = 30;
/** The planes are a little larger than the viewport so the camera's truck never shows their edge */
const PLANE_OVERSCAN = 1.12;
/** Camera truck with the pointer, as fractions of the plane size */
const TRUCK_X = 0.08;
const TRUCK_Y = 0.05;
/** Depth of the back wall (depth-map value), used as the camera's pivot */
const WALL_DEPTH = 0.3;

const uvOf = (px: number, py: number) => new THREE.Vector2(px / IMG.w, 1 - py / IMG.h);
const smooth = (p: number, a: number, b: number) => THREE.MathUtils.clamp((p - a) / (b - a), 0, 1);

// ---------------------------------------------------------------------------
// Shared per-frame values, written once by <Driver>, read by every layer
// ---------------------------------------------------------------------------
const frame = {
  parallax: new THREE.Vector2(),
  heroZoom: 1,
  /** uv shift (unused in 3D — the camera trucks instead) */
  shift: 0,
  /** the ink wipe actually drawn: the intro reveal, undone again as the section scrolls away */
  reveal: 0,
  flicker: 1,
  breath: 0,
  time: 0,
  pointer: new THREE.Vector2(0.5, 0.5),
  /** smoothed pointer the camera follows */
  cam: new THREE.Vector2(),
};

/** Cover-fit plane size (px), the horizontal shift that keeps `centerX` in view, and the camera distance. */
function useFit(centerX = 0.5) {
  const { size } = useThree();
  const s = Math.max(size.width / IMG.w, size.height / IMG.h);
  const w = IMG.w * s;
  const h = IMG.h * s;
  const maxShift = Math.max(0, (w - size.width) / 2);
  const shift = THREE.MathUtils.clamp((0.5 - centerX) * w, -maxShift, maxShift);
  const dist = size.height / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  return { w, h, s, shift, dist };
}

// ---------------------------------------------------------------------------
// CPU-side depth sampling, so strings, hints and the sign can sit on the displaced surface
// ---------------------------------------------------------------------------
type DepthFn = (u: number, v: number) => number;
const depthLoads = new Map<string, Promise<DepthFn>>();
function loadDepth(url: string): Promise<DepthFn> {
  let p = depthLoads.get(url);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const W = 768;
        const H = 512;
        const c = document.createElement("canvas");
        c.width = W;
        c.height = H;
        const g = c.getContext("2d")!;
        g.drawImage(img, 0, 0, W, H);
        const data = g.getImageData(0, 0, W, H).data;
        const at = (x: number, y: number) =>
          data[(THREE.MathUtils.clamp(y, 0, H - 1) * W + THREE.MathUtils.clamp(x, 0, W - 1)) * 4] / 255;
        // bilinear, over a small box — the GPU samples the same map with linear filtering, so this keeps
        // things placed on the surface (strings, hints) from stepping where the mesh does not
        resolve((u, v) => {
          const fx = u * (W - 1);
          const fy = (1 - v) * (H - 1);
          const x0 = Math.floor(fx);
          const y0 = Math.floor(fy);
          const tx = fx - x0;
          const ty = fy - y0;
          let sum = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const a = at(x0 + dx, y0 + dy) * (1 - tx) + at(x0 + dx + 1, y0 + dy) * tx;
              const b = at(x0 + dx, y0 + dy + 1) * (1 - tx) + at(x0 + dx + 1, y0 + dy + 1) * tx;
              sum += a * (1 - ty) + b * ty;
            }
          return sum / 9;
        });
      };
      img.src = url;
    });
    depthLoads.set(url, p);
  }
  return p;
}
function useDepth(url: string) {
  const [fn, setFn] = useState<DepthFn | null>(null);
  useEffect(() => {
    let live = true;
    loadDepth(url).then((f) => live && setFn(() => f));
    return () => {
      live = false;
    };
  }, [url]);
  return fn;
}

/**
 * Plate pixel → world position on the displaced plane (z from the depth map). `probe` samples a
 * vertical window and keeps the nearest value, for things that sit on a thin near surface (the
 * strings on the fretboard) where the depth map's soft edge would otherwise pull them back.
 */
function plateToWorld(px: number, py: number, fit: { w: number; h: number; shift: number }, depth: DepthFn | null, probe = 0) {
  const u = px / IMG.w;
  const v = 1 - py / IMG.h;
  let d = depth ? depth(u, v) : 0.5;
  if (depth && probe > 0) for (let k = -probe; k <= probe; k += 4) d = Math.max(d, depth(u, v - k / IMG.h));
  return new THREE.Vector3(
    (u - 0.5) * fit.w * PLANE_OVERSCAN + fit.shift,
    (v - 0.5) * fit.h * PLANE_OVERSCAN,
    (d - WALL_DEPTH) * DEPTH_SCALE * fit.h,
  );
}

const HERO_CENTER_X = HERO_CENTER_X_SHARED;

// ---------------------------------------------------------------------------
// Plate shader
// ---------------------------------------------------------------------------
const VERT = /* glsl */ `
  uniform sampler2D uDepth;
  uniform float uDepthScale, uZOffset;
  varying vec2 vUv;
  varying float vStretch;
  const float WALL = 0.3;
  void main() {
    vUv = uv;
    float d = texture2D(uDepth, uv).r;
    // a far-side vertex next to a near object: the triangle between them is the stretched skirt.
    // Flag only this side, so the near object keeps its own edge and just the smear behind it is dropped.
    vec2 e = vec2(2.0 / 384.0, 2.0 / 256.0);
    float dmax = max(max(texture2D(uDepth, uv + vec2(e.x, 0.0)).r, texture2D(uDepth, uv - vec2(e.x, 0.0)).r),
                     max(texture2D(uDepth, uv + vec2(0.0, e.y)).r, texture2D(uDepth, uv - vec2(0.0, e.y)).r));
    float dmin = min(min(texture2D(uDepth, uv + vec2(e.x, 0.0)).r, texture2D(uDepth, uv - vec2(e.x, 0.0)).r),
                     min(texture2D(uDepth, uv + vec2(0.0, e.y)).r, texture2D(uDepth, uv - vec2(0.0, e.y)).r));
    vStretch = max((dmax - d - 0.06) / 0.08, (d - dmin - 0.22) / 0.1);
    vec3 p = position;
    p.z += (d - WALL) * uDepthScale + uZOffset;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uMap, uDepth, uMaskRed, uMaskLamp, uMatte;
  uniform float uHasAlpha, uHasMasks, uSketch, uHasMatte;
  uniform vec2 uParallax, uFocus, uChest, uPhone, uPointer;
  uniform float uZoom, uParallaxScale, uDepthZoom, uBreath, uDepthFlat, uDepthMix, uShift;
  uniform vec3 uLights;      // red, lamp, ambient
  uniform float uAudio, uFlicker, uTime, uGrain, uVignette, uFade, uPhoneGlow, uReveal, uBloom, uShimmer, uSkirt;
  varying vec2 vUv;
  varying float vStretch;

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
      float rad = (k == 0) ? 0.11 : (k == 1) ? 0.08 : 0.055;
      float rd = length(cuv);
      // bokeh ring: bright rim, dim centre
      float dotm = smoothstep(rad - 0.05, rad, rd) * (1.0 - smoothstep(rad, rad + 0.04, rd)) + 0.3 * (1.0 - smoothstep(0.0, rad, rd));
      float bright = ((k == 0) ? 0.35 : (k == 1) ? 0.7 : 1.0) * (0.35 + 0.65 * lum);
      g += dotm * keep * bright * (0.75 + 0.25 * sin(uTime * (1.5 + r * 3.0) + r * 40.0));
    }
    vec2 sp = scr * 26.0;
    vec2 cell = floor(sp);
    vec2 cuv = fract(sp) - 0.5 + (vec2(hashn(cell + 2.7), hashn(cell + 8.9)) - 0.5) * 0.7;
    float r = hashn(cell + 3.3);
    float star = (pow(max(1.0 - abs(cuv.x) * 30.0, 0.0), 2.0) * max(1.0 - abs(cuv.y) * 1.6, 0.0)
                + pow(max(1.0 - abs(cuv.y) * 30.0, 0.0), 2.0) * max(1.0 - abs(cuv.x) * 1.6, 0.0));
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
    // the stretched skirt at a depth jump: drop it, the layer behind fills the gap
    if (uSkirt > 0.5 && vStretch > 1.0) discard;
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
    // a matte (the rembg cutout) gives the front layer its clean silhouette
    if (uHasMatte > 0.5) alpha *= texture2D(uMatte, uv).r;
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

    // The portal, after Shopify Editions. Two fronts grow out of the phone as ink blots (domain-warped
    // noise whose amplitude scales with the radius). The outer front turns the etching into a dark
    // galaxy — a dense field of bokeh dots following the photo — and its edge is a white-hot splash
    // while the blot is small. The inner front, a beat behind, paints the photo in over the galaxy.
    if (uSketch > 0.5) {
      vec2 scr = vUv * ASPECT;
      vec2 c = uPhone * ASPECT;
      vec2 rel = scr - c;
      float dist = length(rel);
      float ang = atan(rel.y, rel.x);
      float moving = step(0.001, uReveal) * step(uReveal, 0.999);

      vec2 q = vec2(fbm(scr * 3.0 + uTime * 0.05), fbm(scr * 3.0 + 7.1 - uTime * 0.04));
      float f1 = fbm(scr * 6.0 + q * 1.5 + uTime * 0.08);
      float f2 = fbm(scr * 18.0 + q * 3.0 - uTime * 0.12);
      float f3 = vnoise(scr * 60.0 + uTime * 0.5);
      float pointerBulge = exp(-distance(scr, uPointer * ASPECT) * 5.0) * 0.12 * uReveal;
      // radial streaks: noise stretched along the direction out of the phone, for the splash
      float streaks = fbm(vec2(dist * 14.0 - uTime * 0.6, ang * 5.0));

      // outer front: etching → galaxy
      float rr = 0.03 + pow(uReveal, 1.3) * 1.6;
      float amp = 0.06 + rr * 0.3;
      float wob = (f1 - 0.5) * 0.9 + (f2 - 0.5) * 0.4 + (f3 - 0.5) * 0.1 + (streaks - 0.5) * 0.35 + pointerBulge;
      float d = dist - rr - wob * amp;              // < 0 inside the galaxy
      // inner front: galaxy → painted, a beat behind
      float p2 = clamp((uReveal - 0.16) / 0.84, 0.0, 1.0);
      float rr2 = pow(p2, 1.25) * 1.75;
      float amp2 = 0.04 + rr2 * 0.26;
      float wob2 = (fbm(scr * 5.0 - q * 1.2 + uTime * 0.06) - 0.5) * 0.9 + (f2 - 0.5) * 0.3;
      float d2 = dist - rr2 - wob2 * amp2;          // < 0 inside the painted area

      // the three worlds
      vec3 etched = etching(uv, base, scr) + galaxy(scr, uv, 1.0) * 0.95;
      vec3 space = base * 0.04 + vec3(0.015, 0.02, 0.035) + galaxy(scr, uv, 2.2) * 1.15;
      float inGalaxy = 1.0 - smoothstep(-0.003, 0.003, d);
      float inPaint = 1.0 - smoothstep(-0.003, 0.003, d2) * step(0.0001, rr2);
      vec3 outc = mix(etched, space, inGalaxy);
      outc = mix(outc, col, inPaint * inGalaxy);

      vec3 hot = vec3(1.0, 0.985, 0.95);
      vec2 dir = normalize(rel + 1e-4);

      // outer edge: a white-hot splash while small (sparks and streaks flung outward), smoke feather once big
      float burn = 1.0 - smoothstep(0.08, 0.45, uReveal);
      float feather = exp(-abs(d) * 10.0) * (0.5 + 0.5 * f2) * moving;
      outc *= 1.0 - feather * 0.9 * (1.0 - burn * 0.7);
      float gband = exp(-abs(d) * 9.0) * (0.45 + 0.55 * f1);
      float splash = exp(-max(d, 0.0) * 6.0) * pow(streaks, 2.0) * (1.0 - inGalaxy) * 1.6;   // tongues of light outside
      float gl = glitter(scr, dir, gband + splash * 0.5);
      outc += hot * (gband * gband * (0.6 + 0.6 * f2) + splash * (0.6 + 0.4 * f3) + gl * (gband + splash) * 1.7) * burn;
      outc += hot * gl * gband * 0.12 * moving;
      outc += hot * exp(-abs(d) * 220.0) * (0.35 + 0.65 * f2) * (0.1 + 0.9 * burn) * moving;

      // inner edge: a soft glow where the paint meets the galaxy
      float g2 = exp(-abs(d2) * 14.0) * step(0.0001, rr2) * moving;
      outc += hot * (g2 * g2 * 0.5 + glitter(scr, dir, g2) * g2 * 0.6);
      outc *= 1.0 - g2 * 0.25 * (0.5 + 0.5 * f2);

      col = outc;
    }

    // a diagonal sweep of light with glitter, used once when the sign lands
    if (uShimmer > 0.001 && uShimmer < 0.999) {
      vec2 scr = vUv * ASPECT;
      float pos = vUv.x + vUv.y * 0.6 - (uShimmer * 2.2 - 0.4);
      float band = exp(-pos * pos * 60.0);
      float gl = glitter(scr, vec2(0.7, 0.7), band);
      col += vec3(1.0, 0.98, 0.95) * (band * 0.8 + gl * band * 2.0) * alpha;
    }

    float n2 = fract(sin(dot(vUv * 913.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
    col += (n2 - 0.5) * uGrain;
    float v = smoothstep(1.25, 0.3, distance(vUv, vec2(0.5)) * 1.35);
    col *= mix(1.0, v, uVignette);

    float skirtFade = uSkirt > 0.5 ? 1.0 - smoothstep(0.4, 1.0, vStretch) : 1.0;
    gl_FragColor = vec4(col, alpha * uFade * skirtFade);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

type PlateTextures = { map: THREE.Texture; depth: THREE.Texture; red?: THREE.Texture; lamp?: THREE.Texture; matte?: THREE.Texture };

function makeUniforms(t: PlateTextures, hasAlpha: boolean) {
  return {
    uMap: { value: t.map },
    uDepth: { value: t.depth },
    uMaskRed: { value: t.red ?? t.depth },
    uMaskLamp: { value: t.lamp ?? t.depth },
    uHasAlpha: { value: hasAlpha ? 1 : 0 },
    uHasMasks: { value: t.red ? 1 : 0 },
    uMatte: { value: t.matte ?? t.depth },
    uHasMatte: { value: t.matte ? 1 : 0 },
    uParallax: { value: new THREE.Vector2() },
    uFocus: { value: uvOf(...HERO_PHONE) },
    uChest: { value: uvOf(...HERO_CHEST) },
    uPhone: { value: uvOf(...HERO_PHONE) },
    uZoom: { value: 1 },
    uParallaxScale: { value: 0 },
    uDepthZoom: { value: 0 },
    uDepthFlat: { value: 0.5 },
    uDepthMix: { value: 0 },
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
    uShimmer: { value: 0 },
    uPointer: { value: new THREE.Vector2(0.5, 0.5) },
    uDepthScale: { value: 0 },
    uZOffset: { value: 0 },
    uSkirt: { value: 0 },
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
  hasAlpha?: boolean;
  /** drop the stretched skirts at depth jumps (the hero layer, which has the room behind it) */
  skirt?: boolean;
  /** world-z nudge, so stacked layers never fight for the same depth */
  zOffset?: number;
  order: number;
  update: (u: ReturnType<typeof makeUniforms>) => void;
};

const SEGS = { x: 480, y: 320 };

function Plate({ textures, hasAlpha = false, skirt = false, zOffset = 0, order, update }: PlateProps) {
  const { w, h, shift } = useFit(HERO_CENTER_X);
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => makeUniforms(textures, hasAlpha), [textures, hasAlpha]);

  useFrame(() => {
    const m = material.current;
    if (!m) return;
    const u = m.uniforms as ReturnType<typeof makeUniforms>;
    u.uDepthScale.value = DEPTH_SCALE * h;
    u.uZOffset.value = zOffset;
    u.uSkirt.value = skirt ? 1 : 0;
    u.uLights.value.set(session.lights.red, session.lights.lamp, session.lights.ambient);
    u.uAudio.value = session.audio.level;
    u.uFlicker.value = frame.flicker;
    u.uTime.value = frame.time;
    u.uReveal.value = frame.reveal;
    u.uBloom.value = session.bloom;
    u.uPointer.value.copy(frame.pointer);
    update(u);
  });

  return (
    <mesh position={[shift, 0, 0]} renderOrder={order}>
      <planeGeometry args={[w * PLANE_OVERSCAN, h * PLANE_OVERSCAN, SEGS.x, SEGS.y]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
        transparent={hasAlpha}
        depthWrite={!hasAlpha}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------
function Studio() {
  const room = useTexture(
    { map: "/scene/hero-back.jpg", depth: "/scene/hero-depth-back.jpg", red: "/scene/mask-red.jpg", lamp: "/scene/mask-lamp.jpg" },
    configure,
  ) as unknown as PlateTextures;
  const hero = useTexture(
    {
      map: "/scene/hero.jpg",
      depth: "/scene/hero-depth.jpg",
      red: "/scene/mask-red.jpg",
      lamp: "/scene/mask-lamp.jpg",
      matte: "/scene/hero-mask.jpg",
    },
    configure,
  ) as unknown as PlateTextures;
  const sign = useTexture({ map: "/scene/sign.webp", depth: "/scene/hero-depth.jpg" }, configure) as unknown as PlateTextures;

  const scene = (u: ReturnType<typeof makeUniforms>) => {
    u.uPhoneGlow.value = 1 + session.phonePulse * 2.5;
    u.uSketch.value = 1;
  };

  return (
    <>
      {/* the room without him (inpainted, eroded depth), a hair behind: shows through where his silhouette is cut away */}
      <Plate textures={room} zOffset={-3} order={0} update={scene} />
      {/* him (and the guitar, the phone): the cutout matte gives the layer a clean silhouette */}
      <Plate textures={hero} hasAlpha order={1} update={scene} />
      {/* the title on the wall: lands with the preloader, shimmers once */}
      <Plate
        textures={sign}
        hasAlpha
        zOffset={4}
        order={2}
        update={(u) => {
          u.uLights.value.set(0, 0, 1);
          u.uPhoneGlow.value = 0;
          u.uFade.value = session.sign;
          u.uShimmer.value = session.signShimmer;
        }}
      />
      <Strings />
    </>
  );
}

// ---------------------------------------------------------------------------
// Playable strings laid on the displaced guitar: silver at rest, each one its own colour when ringing
// ---------------------------------------------------------------------------
const SEGMENTS = 40;

function Strings() {
  const fit = useFit(HERO_CENTER_X);
  const depth = useDepth("/scene/hero-depth.jpg");
  const lines = useRef<(Line2 | LineSegments2 | null)[]>([]);
  const energy = useRef(new Float32Array(6));
  const age = useRef(new Float32Array(6));
  const phase = useRef(new Float32Array(6));
  const scratch = useRef(new Float32Array((SEGMENTS + 1) * 3));

  const geometry = useMemo(
    () =>
      STRINGS.map((s, i) => {
        const from = STRING_VISIBLE_FROM[i];
        const at = (u: number) =>
          plateToWorld(s.a[0] + (s.b[0] - s.a[0]) * u, s.a[1] + (s.b[1] - s.a[1]) * u, fit, depth, 16);
        const a = at(from);
        const b = at(1);
        // a string is straight: interpolate z between its ends rather than following every bump of the depth map
        const points = Array.from({ length: SEGMENTS + 1 }, (_, k) => {
          const t = k / SEGMENTS;
          const p = at(from + (1 - from) * t);
          return [p.x, p.y, a.z + (b.z - a.z) * t + 2] as [number, number, number];
        });
        const mid = at((from + 1) / 2);
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        return { points, mid, len, angle };
      }),
    [fit, depth],
  );

  useEffect(
    () =>
      onPluck((i) => {
        energy.current[i] = 1;
        age.current[i] = 0;
        phase.current[i] = Math.random() * Math.PI * 2;
      }),
    [],
  );

  useFrame((_, dt) => {
    for (let i = 0; i < 6; i++) {
      const line = lines.current[i];
      if (!line) continue;
      const e = energy.current[i];
      const glow = Math.min(1, e * 2.5);
      const mat = line.material as THREE.Material & { opacity: number; color: THREE.Color; linewidth: number };
      mat.opacity = 0.55 + 0.45 * glow;
      mat.color.copy(STRING_REST).lerp(STRING_LIT[i], glow);
      mat.linewidth = (1.1 - i * 0.08) * (1 + glow * 0.6);
      if (e < 0.004) continue;
      age.current[i] += dt;
      energy.current[i] = e * Math.exp(-dt * 3.0);
      const { points, angle } = geometry[i];
      const t = age.current[i];
      // a real string barely moves — a couple of pixels, fast, so it reads as a blur
      const amp = 2.2 * e;
      const wv = 46 + i * 6;
      const nx = -Math.sin(angle);
      const ny = Math.cos(angle);
      for (let k = 0; k <= SEGMENTS; k++) {
        const u = k / SEGMENTS;
        const env = Math.sin(Math.PI * u);
        const sw = amp * env * (Math.sin(t * wv + phase.current[i]) + 0.35 * Math.sin(2 * Math.PI * u) * Math.sin(t * wv * 2.1));
        scratch.current[k * 3] = points[k][0] + nx * sw;
        scratch.current[k * 3 + 1] = points[k][1] + ny * sw;
        scratch.current[k * 3 + 2] = points[k][2];
      }
      line.geometry.setPositions(scratch.current);
    }
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
  const body = plateToWorld(GUITAR_BODY.x + GUITAR_BODY.w / 2, GUITAR_BODY.y + GUITAR_BODY.h / 2, fit, depth);

  return (
    <group>
      {geometry.map((s, i) => (
        <Line
          key={`${i}-${depth ? 1 : 0}`}
          ref={(el) => {
            lines.current[i] = el;
          }}
          points={s.points}
          color={STRING_REST}
          lineWidth={1.1 - i * 0.08}
          transparent
          opacity={0.55}
          frustumCulled={false}
          depthTest={false}
          material-toneMapped={false}
          renderOrder={5}
        />
      ))}
      {/* hit zones along each string — crossing one plucks it, so a swipe is a strum */}
      {geometry.map((s, i) => (
        <mesh
          key={i}
          position={[s.mid.x, s.mid.y, s.mid.z + 3]}
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
        position={[body.x, body.y, body.z + 2]}
        onPointerDown={strum}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <planeGeometry args={[(GUITAR_BODY.w * fit.w) / IMG.w, (GUITAR_BODY.h * fit.h) / IMG.h]} />
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
  const { w, h } = useFit();
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const pos = new Float32Array(DUST_COUNT * 3);
    for (let i = 0; i < DUST_COUNT; i++) {
      // only where the LED strip and the spots actually light the air: the centre band of the room
      pos[i * 3] = (0.28 + hash(i * 3) * 0.5 - 0.5) * w;
      pos[i * 3 + 1] = (0.30 + hash(i * 3 + 1) * 0.5 - 0.5) * h;
      pos[i * 3 + 2] = (hash(i * 3 + 2) * 0.4 - 0.1) * DEPTH_SCALE * h;
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
    <points ref={points} renderOrder={6}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={TAN} size={2.2} transparent opacity={0} depthWrite={false} depthTest={false} sizeAttenuation={false} />
    </points>
  );
}

// ---------------------------------------------------------------------------
// Camera: trucks with the pointer around a pivot on the back wall, leans in to the phone for the chat
// ---------------------------------------------------------------------------
function Rig() {
  const fit = useFit(HERO_CENTER_X);
  const depth = useDepth("/scene/hero-depth.jpg");
  const { camera, size } = useThree();
  const scratch = useRef({ pos: new THREE.Vector3(), target: new THREE.Vector3(), phone: new THREE.Vector3() });

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    Object.assign(cam, { fov: FOV, near: 1, far: fit.dist * 4 });
    cam.updateProjectionMatrix();
  }, [camera, fit.dist, size.width, size.height]);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    // critically-damped ease towards the pointer, plus a slow idle sway so the room never sits still
    const k = 1 - Math.exp(-dt * 2.2);
    const tx = session.mouse.x + Math.sin(t * 0.23) * 0.12;
    const ty = session.mouse.y + Math.cos(t * 0.19) * 0.08;
    frame.cam.x += (tx - frame.cam.x) * k;
    frame.cam.y += (ty - frame.cam.y) * k;

    const { pos, target, phone } = scratch.current;
    phone.copy(plateToWorld(HERO_PHONE[0], HERO_PHONE[1], fit, depth));
    const focus = session.focus;
    // rest: look at the wall through the room's centre; chat: lean towards the phone and step left
    // chat: a small step left and a slight turn towards the phone — the title must stay in frame
    pos.set(frame.cam.x * TRUCK_X * fit.w - focus * 0.03 * fit.w, frame.cam.y * TRUCK_Y * fit.h, fit.dist);
    target.set(fit.shift, 0, 0);
    pos.lerp(phone, focus * 0.05);
    target.lerp(phone, focus * 0.18);
    camera.position.lerp(pos, Math.min(1, dt * 6));
    camera.lookAt(target);
  });
  return null;
}

// ---------------------------------------------------------------------------
// Drives the shared frame values and projects the hint anchors to the screen
// ---------------------------------------------------------------------------
function Driver() {
  const fit = useFit(HERO_CENTER_X);
  const depth = useDepth("/scene/hero-depth.jpg");
  const { camera, size, scene } = useThree();
  useEffect(() => {
    if (process.env.NODE_ENV === "development") (window as unknown as { __scene: THREE.Scene }).__scene = scene;
  }, [scene]);
  const v = useRef(new THREE.Vector3());

  const toScreen = (p: THREE.Vector3) => {
    v.current.copy(p).project(camera);
    return { x: (v.current.x * 0.5 + 0.5) * size.width, y: (-v.current.y * 0.5 + 0.5) * size.height };
  };

  useFrame(({ clock }, dt) => {
    sampleAudio(session.audio);
    const t = clock.elapsedTime;
    frame.pointer.set(session.mouse.x * 0.5 + 0.5, session.mouse.y * 0.5 + 0.5);
    // the wipe paints the room in, and un-paints it again as the section leaves the screen
    frame.reveal = session.reveal * (1 - smooth(session.progress, 0.02, 0.6));
    frame.time = t;
    session.phonePulse *= Math.exp(-dt * 4);
    const a = session.audio.level;
    frame.flicker = session.lights.lamp > 0.9 ? 1 + Math.sin(t * 37) * Math.sin(t * 11) * (0.015 + a * 0.25) : 1;

    // hint anchors
    const ph = toScreen(plateToWorld(HERO_PHONE[0], HERO_PHONE[1], fit, depth));
    session.phoneScreen.x = ph.x;
    session.phoneScreen.y = ph.y;
    const gh = toScreen(plateToWorld(GUITAR_BODY.x + GUITAR_BODY.w * 0.45, GUITAR_BODY.y + 20, fit, depth));
    session.hintScreen.x = gh.x;
    session.hintScreen.y = gh.y;
    session.hintScreen.opacity = session.guitarHint * session.guitarHintIn * (1 - smooth(session.progress, 0, 0.12));
    // the sign's wordmark box on screen, for the preloader's flight
    const tl = toScreen(plateToWorld(SIGN_WORDMARK.x, SIGN_WORDMARK.y, fit, depth));
    const br = toScreen(plateToWorld(SIGN_WORDMARK.x + SIGN_WORDMARK.w, SIGN_WORDMARK.y + SIGN_WORDMARK.h, fit, depth));
    Object.assign(session.signScreen, { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y });
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
      camera={{ fov: FOV, near: 1, far: 10000, position: [0, 0, 1500] }}
      gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping }}
      onPointerDown={unlockAudio}
    >
      <color attach="background" args={["#070606"]} />
      <Suspense fallback={null}>
        <Studio />
      </Suspense>
      <Dust />
      <Rig />
      <Driver />
    </Canvas>
  );
}
