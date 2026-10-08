"use client";

// The studio as a "living photograph": the generated plates are layered in an orthographic scene
// (1 world unit = 1 px). Each layer is a plane with a depth map, so the pointer and the scroll push
// move the room with real parallax. Lights, grain and the audio reaction happen in the shader.

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { Line2, LineSegments2 } from "three-stdlib";
import { onPluck, playRiff, pluck, sampleAudio, unlockAudio } from "./audio";
import { coverFit, dismissGuitarHint, session, SIGN_WORDMARK } from "./state";

const TAN = "#e7b47e";
const IMG = { w: 1536, h: 1024 };

// ---------------------------------------------------------------------------
// Calibration (pixels in the 1536×1024 plates)
// ---------------------------------------------------------------------------
/** Six strings on 03-A-hero.png, low E (top) → high E, bridge → nut */
const STRINGS = Array.from({ length: 6 }, (_, i) => ({
  a: [700, 716 + i * 9.2] as [number, number],
  b: [1290, 789 + i * 9.6] as [number, number],
}));
const GUITAR_BODY = { x: 560, y: 640, w: 360, h: 250 };
const HERO_PHONE = [1080, 515] as const;
const HERO_CHEST = [900, 560] as const;

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
  flicker: 1,
  breath: 0,
  time: 0,
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
const HERO_CENTER_X = 0.6;

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
  uniform float uHasAlpha, uHasMasks;
  uniform vec2 uParallax, uFocus, uChest, uPhone;
  uniform float uZoom, uParallaxScale, uDepthZoom, uBreath, uDepthFlat, uDepthMix;
  uniform vec3 uLights;      // red, lamp, ambient
  uniform float uAudio, uFlicker, uTime, uGrain, uVignette, uFade, uPhoneGlow;
  varying vec2 vUv;

  void main() {
    // push-in: scale the image around the focus point
    vec2 uv = uFocus + (vUv - uFocus) / uZoom;
    // breathing: a tiny scale around the chest
    uv = uChest + (uv - uChest) / (1.0 + uBreath);
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
    // The beats: red wall light flickers on, then the lamp. Once the ambient is up, the photo is itself.
    dark += base * red * uLights.x * 1.3;
    dark += base * lamp * uLights.y * uFlicker * 0.9;
    vec3 col = mix(dark, base, uLights.z);
    // the guitar makes the red light pulse
    col += base * red * uAudio * 0.5;

    float n = fract(sin(dot(vUv * 913.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
    col += (n - 0.5) * uGrain;
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
        }}
      />
      {/* the wall sign: the preloader's logo lands here and becomes it; already lit while the room is dark */}
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
// Playable strings drawn over the photo's strings (invisible at rest)
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
          const u = k / SEGMENTS;
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
    g.position.set(shift + focusWorld[0] * (1 - z) - pv.x * w, focusWorld[1] * (1 - z) - pv.y * h, 0);
    const visible = 1;

    for (let i = 0; i < 6; i++) {
      const line = lines.current[i];
      if (!line) continue;
      const e = energy.current[i];
      const mat = line.material as THREE.Material & { opacity: number };
      mat.opacity = Math.min(1, e * 2.5) * visible;
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
        const u = k / SEGMENTS;
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
    session.hintScreen.opacity = session.guitarHint * session.lights.lamp * (1 - smooth(session.progress, 0, 0.12));
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
          color={new THREE.Color(TAN).multiplyScalar(1.6)}
          lineWidth={1.6 - i * 0.12}
          transparent
          opacity={0}
          frustumCulled={false}
          material-toneMapped={false}
          renderOrder={2}
        />
      ))}
      {/* hit zones along each string — crossing one plucks it, so a swipe is a strum */}
      {geometry.map((s, i) => (
        <mesh key={i} position={[s.mid[0], s.mid[1], 2]} rotation={[0, 0, s.angle]} onPointerEnter={() => strike(i)}>
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
const DUST_COUNT = 110;
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
      pos[i * 3] = (hash(i * 3) - 0.5) * w;
      pos[i * 3 + 1] = (hash(i * 3 + 1) - 0.5) * h;
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
      if (arr[i * 3 + 1] > h / 2) arr[i * 3 + 1] = -h / 2;
    }
    attr.needsUpdate = true;
    (mesh.material as THREE.PointsMaterial).opacity = 0.35 * session.lights.lamp;
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
    frame.time = clock.elapsedTime;
    session.phonePulse *= Math.exp(-dt * 4);
    // the zoom pivots on the phone, so its screen position only drifts with the parallax
    const { w, h, shift } = coverFit(size.width, size.height);
    // Where the sign's wordmark is on screen right now (plate px → shader uv → screen), for the preloader handoff.
    {
      const z = frame.heroZoom;
      const fx = HERO_PHONE[0] / IMG.w;
      const fy = 1 - HERO_PHONE[1] / IMG.h;
      const ox = frame.parallax.x * PAN * (PAN_DEPTH - 0.5);
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
    session.phoneScreen.x = size.width / 2 + shift + (HERO_PHONE[0] / IMG.w - 0.5) * w - frame.parallax.x * PAN * (PAN_DEPTH - 0.5) * w;
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
