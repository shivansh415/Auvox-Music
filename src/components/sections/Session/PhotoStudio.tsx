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
import { dismissGuitarHint, session } from "./state";

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
/** Screen corners on 04-D-phone-closeup.png: TL, TR, BR, BL */
const SCREEN_QUAD: [number, number][] = [
  [478, 250],
  [716, 268],
  [622, 778],
  [380, 738],
];
const CLOSEUP_FOCUS = [560, 500] as const;
/** Scroll progress at which the push-in has fully arrived on the close-up */
const PUSH_END = 0.76;

const uvOf = (px: number, py: number) => new THREE.Vector2(px / IMG.w, 1 - py / IMG.h);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (p: number, a: number, b: number) => THREE.MathUtils.clamp((p - a) / (b - a), 0, 1);

// ---------------------------------------------------------------------------
// Shared per-frame values, written once by <Driver>, read by every layer
// ---------------------------------------------------------------------------
const frame = {
  parallax: new THREE.Vector2(),
  heroZoom: 1,
  heroFade: 1,
  closeupFade: 0,
  closeupZoom: 1,
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
const CLOSEUP_CENTER_X = 0.36;

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
  uniform float uZoom, uParallaxScale, uDepthZoom, uBreath;
  uniform vec3 uLights;      // red, lamp, ambient
  uniform float uAudio, uFlicker, uTime, uGrain, uVignette, uFade, uPhoneGlow;
  varying vec2 vUv;

  void main() {
    // push-in: scale the image around the focus point
    vec2 uv = uFocus + (vUv - uFocus) / uZoom;
    // breathing: a tiny scale around the chest
    uv = uChest + (uv - uChest) / (1.0 + uBreath);
    float d = texture2D(uDepth, uv).r;                     // 1 = near
    // nearer pixels slide more with the pointer, and spread more as the camera pushes in
    vec2 off = uParallax * uParallaxScale * (d - 0.5)
             + (uv - uFocus) * (uZoom - 1.0) * uDepthZoom * (d - 0.5);
    uv += off;

    vec4 tex = texture2D(uMap, uv);
    float alpha = uHasAlpha > 0.5 ? tex.a : 1.0;
    vec3 base = tex.rgb;
    float red = uHasMasks > 0.5 ? texture2D(uMaskRed, uv).r : 0.0;
    float lamp = uHasMasks > 0.5 ? texture2D(uMaskLamp, uv).r : 0.0;

    float amb = uLights.z;
    vec3 col = base * (0.035 + 0.80 * amb);
    col += base * red * uLights.x * (0.9 + uAudio * 0.9);
    col += base * lamp * uLights.y * uFlicker * 0.9;
    // the phone lights his face while the room is still dark
    float glow = exp(-distance(uv, uPhone) * 9.0) * uPhoneGlow;
    col += base * glow * vec3(0.9, 0.95, 1.15) * 2.4 * (1.0 - amb * 0.75);

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
    uBreath: { value: 0 },
    uLights: { value: new THREE.Vector3() },
    uAudio: { value: 0 },
    uFlicker: { value: 1 },
    uTime: { value: 0 },
    uGrain: { value: 0.035 },
    uVignette: { value: 0.85 },
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
    { map: "/scene/clean.jpg", depth: "/scene/clean-depth.jpg", red: "/scene/mask-red.jpg", lamp: "/scene/mask-lamp.jpg" },
    configure,
  ) as unknown as PlateTextures;
  const fg = useTexture({ map: "/scene/hero-cutout.webp", depth: "/scene/hero-depth.jpg" }, configure) as unknown as PlateTextures;
  const closeup = useTexture({ map: "/scene/closeup.jpg", depth: "/scene/closeup-depth.jpg" }, configure) as unknown as PlateTextures;

  const heroFocus = useMemo(() => uvOf(...HERO_PHONE), []);
  const closeupFocus = useMemo(() => uvOf(...CLOSEUP_FOCUS), []);
  const fgTextures = useMemo(() => ({ ...fg, red: bg.red, lamp: bg.lamp }), [fg, bg]);

  return (
    <>
      {/* empty studio */}
      <Plate
        textures={bg}
        focus={heroFocus}
        centerX={HERO_CENTER_X}
        parallaxScale={0.008}
        depthZoom={0.18}
        z={0}
        update={(u) => {
          u.uZoom.value = frame.heroZoom;
          u.uFade.value = frame.heroFade;
          u.uPhoneGlow.value = 0.35;
        }}
      />
      {/* the man, cut out, in front */}
      <Plate
        textures={fgTextures}
        focus={heroFocus}
        centerX={HERO_CENTER_X}
        hasAlpha
        parallaxScale={0.014}
        depthZoom={0.28}
        z={1}
        update={(u) => {
          u.uZoom.value = frame.heroZoom;
          u.uFade.value = frame.heroFade;
          u.uBreath.value = frame.breath;
          u.uPhoneGlow.value = 1;
        }}
      />
      <Strings />
      {/* close-up plate for the end of the push */}
      <Plate
        textures={closeup}
        focus={closeupFocus}
        centerX={CLOSEUP_CENTER_X}
        parallaxScale={0.004}
        depthZoom={0.1}
        z={3}
        update={(u) => {
          u.uZoom.value = frame.closeupZoom;
          u.uFade.value = frame.closeupFade;
          u.uPhoneGlow.value = 0;
          u.uVignette.value = 0.6;
        }}
      />
      <LockScreen />
    </>
  );
}

// ---------------------------------------------------------------------------
// Playable strings drawn over the photo's strings (invisible at rest)
// ---------------------------------------------------------------------------
const SEGMENTS = 40;
/** Depth-map value of the guitar, so the strings slide with the layer they sit on */
const STRING_DEPTH = 0.72;
const STRING_PARALLAX = 0.014;

function Strings() {
  const { w, h, shift } = useCover(HERO_CENTER_X);
  const group = useRef<THREE.Group>(null);
  const lines = useRef<(Line2 | LineSegments2 | null)[]>([]);
  const energy = useRef(new Float32Array(6));
  const age = useRef(new Float32Array(6));
  const phase = useRef(new Float32Array(6));
  const scratch = useRef(new Float32Array((SEGMENTS + 1) * 3));
  const hintPoint = useRef(new THREE.Vector3());

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
    const par = frame.parallax.clone().multiplyScalar(STRING_PARALLAX * (STRING_DEPTH - 0.5));
    g.scale.set(z, z, 1);
    g.position.set(shift + focusWorld[0] * (1 - z) - par.x * w, focusWorld[1] * (1 - z) - par.y * h, 0);
    const visible = frame.heroFade * (1 - smooth(z, 1.05, 1.4));

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
// Lock screen mapped onto the close-up's phone
// ---------------------------------------------------------------------------
function useLockScreenTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 544;
    c.height = 1160;
    const g = c.getContext("2d")!;
    g.scale(2, 2);
    const grad = g.createLinearGradient(0, 0, 0, 580);
    grad.addColorStop(0, "#3a0a0a");
    grad.addColorStop(1, "#120808");
    g.fillStyle = grad;
    g.fillRect(0, 0, 272, 580);
    g.fillStyle = "#f1ede9";
    g.textAlign = "center";
    g.font = "600 76px Afacad Flux, system-ui, sans-serif";
    g.fillText("11:50", 136, 190);
    g.font = "500 18px Afacad Flux, system-ui, sans-serif";
    g.globalAlpha = 0.7;
    g.fillText("Tuesday, 7 October", 136, 220);
    g.globalAlpha = 1;
    g.fillStyle = "rgba(241,237,233,0.12)";
    g.beginPath();
    g.roundRect(18, 290, 236, 92, 18);
    g.fill();
    g.fillStyle = TAN;
    g.beginPath();
    g.arc(48, 336, 18, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#850909";
    g.font = "700 20px Afacad Flux, system-ui, sans-serif";
    g.fillText("α", 48, 343);
    g.fillStyle = "#f1ede9";
    g.textAlign = "left";
    g.font = "600 17px Afacad Flux, system-ui, sans-serif";
    g.fillText("AUVOX Music", 78, 328);
    g.font = "400 15px Afacad Flux, system-ui, sans-serif";
    g.globalAlpha = 0.8;
    g.fillText("Hey… have you heard about", 78, 350);
    g.fillText("AUVOX Music?", 78, 368);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

function LockScreen() {
  const { w, h, shift } = useCover(CLOSEUP_CENTER_X);
  const tex = useLockScreenTexture();
  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const geometry = useMemo(() => {
    const pts = SCREEN_QUAD.map(([px, py]) => [(px / IMG.w - 0.5) * w, (0.5 - py / IMG.h) * h]);
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array([...pts[0], 0, ...pts[1], 0, ...pts[2], 0, ...pts[3], 0]);
    const uv = new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]);
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    return g;
  }, [w, h]);
  const focusWorld = useMemo(() => [(CLOSEUP_FOCUS[0] / IMG.w - 0.5) * w, (0.5 - CLOSEUP_FOCUS[1] / IMG.h) * h], [w, h]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const z = frame.closeupZoom;
    g.scale.set(z, z, 1);
    g.position.set(shift + focusWorld[0] * (1 - z), focusWorld[1] * (1 - z), 0);
    if (material.current) material.current.opacity = frame.closeupFade;
  });

  return (
    <group ref={group} position={[0, 0, 4]}>
      <mesh geometry={geometry} renderOrder={4}>
        <meshBasicMaterial
          ref={material}
          map={tex}
          transparent
          opacity={0}
          depthTest={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Dust in the lamp light
// ---------------------------------------------------------------------------
const DUST_COUNT = 160;
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
    (mesh.material as THREE.PointsMaterial).opacity = 0.35 * session.lights.lamp * frame.heroFade;
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
  useFrame(({ clock }, dt) => {
    sampleAudio(session.audio);
    const p = session.progress;
    const k = Math.min(1, dt * 3);
    smoothMouse.current.x += (session.mouse.x - smoothMouse.current.x) * k;
    smoothMouse.current.y += (session.mouse.y - smoothMouse.current.y) * k;

    const push = easeInOut(smooth(p, 0, PUSH_END));
    frame.parallax.copy(smoothMouse.current).multiplyScalar(1 - push);
    frame.heroZoom = 1 + 1.6 * push;
    frame.closeupFade = smooth(p, 0.5, 0.58);
    frame.closeupZoom = 1 + 0.45 * smooth(p, 0.5, PUSH_END);
    frame.heroFade = 1 - smooth(p, 0.52, 0.6);
    frame.time = clock.elapsedTime;
    frame.breath = Math.sin(clock.elapsedTime * 1.1) * 0.004;
    const a = session.audio.level;
    frame.flicker = session.lights.lamp > 0.9 ? 1 + (Math.random() - 0.5) * (0.05 + a * 0.5) : 1;
    session.frames += 1;
  });
  return null;
}

export default function PhotoStudio() {
  return (
    <Canvas
      className="absolute inset-0"
      style={{ touchAction: "pan-y" }}
      dpr={[1, 2]}
      orthographic
      camera={{ position: [0, 0, 100], zoom: 1, near: 0.1, far: 1000 }}
      gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
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
