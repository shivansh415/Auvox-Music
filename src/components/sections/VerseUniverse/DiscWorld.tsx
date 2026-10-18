"use client";

// The disc's 3D layer — the whole turntable in one canvas: the record (one shader, see vinyl.ts) with
// its rim and contact shadow, the printed ring of type and the logomark, a tonearm, and the live
// guitar and keyboard riding their pucks. Everything sits in one group so the scroll-in tilt and the
// pointer tilt move it as one object. Every frame it projects the nodes and the centre into disc-box
// pixels (disc.anchors) so the DOM hit areas and labels stay glued to them. The canvas bleeds past
// the box (BLEED) so nothing clips while it tilts. The loop is on demand and only runs while near.

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { GUITAR_BODY, lacquer } from "@/lib/r3f/lacquer";
import { gsap } from "@/lib/gsap";
import Prewarm from "@/lib/r3f/Prewarm";
import { sampleAudio } from "@/components/sections/Session/audio";
import { SHADOW_FRAG, VINYL_FRAG, VINYL_VERT } from "./vinyl";
import {
  ARM_LEN,
  ARM_PIVOT,
  ARM_PLAY,
  ARM_REST,
  BLEED,
  CAM_Z,
  DEG,
  FOV,
  LABEL_R,
  NODES,
  NODE_BY_KEY,
  ORBIT,
  PLATE_R,
  PUCK_R,
  TEXT_R,
  U,
  disc,
  discAngle,
  nodePoint,
  stylusPoint,
  type NodeKey,
} from "./state";

/** the record's radius in world units */
const R = PLATE_R * U;
const V = new THREE.Vector3();
const audio = { level: 0, bands: new Float32Array(12) };

/** the printed layer (ring of type + notes) reaches out past the orbit, in record radii */
const PRINT_R = (ORBIT + 0.05) / PLATE_R;
/** the logomark's height, in box sides, and the padding around it in its texture (for the shadow) */
const LOGO_H = 0.096;
const LOGO_PAD = 1.4;

const RING_TEXT = "AUVOX MUSIC · THE VERSE UNIVERSE · ONE STANDARD OF MASTERY · ";
/** small notes printed on the orbit between the verses: local angle (degrees clockwise from 3 o'clock) */
const NOTES: [number, string][] = [
  [-19, "♪"],
  [71, "♫"],
  [161, "♪"],
  [251, "♫"],
];

// ---------------------------------------------------------------------------------------------
// Textures drawn once on a 2D canvas: the ring of type and the logomark
// ---------------------------------------------------------------------------------------------

function fontVar(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function drawPrint() {
  const S = 2048;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const ctx = cv.getContext("2d")!;
  const px = S / 2 / PRINT_R; // pixels per record radius
  ctx.translate(S / 2, S / 2);

  // the ring of type, fitted exactly around the label (like an SVG textPath with textLength)
  const sans = fontVar("--font-afacad-flux", "sans-serif");
  const radius = (TEXT_R / PLATE_R) * px;
  const circ = 2 * Math.PI * radius;
  let fs = 0.041 * px;
  ctx.font = `600 ${fs}px ${sans}`;
  let widths = [...RING_TEXT].map((ch) => ctx.measureText(ch).width);
  let total = widths.reduce((a, b) => a + b, 0);
  if (total > circ * 0.9) {
    fs *= (circ * 0.9) / total;
    ctx.font = `600 ${fs}px ${sans}`;
    widths = [...RING_TEXT].map((ch) => ctx.measureText(ch).width);
    total = widths.reduce((a, b) => a + b, 0);
  }
  const gap = (circ - total) / widths.length;
  ctx.fillStyle = "rgba(253, 242, 227, 0.58)";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  let along = 0;
  [...RING_TEXT].forEach((ch, i) => {
    const w = widths[i];
    const a = Math.PI + ((along + w / 2) / circ) * Math.PI * 2;
    along += w + gap;
    ctx.save();
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(ch, 0, -radius);
    ctx.restore();
  });

  // notes on the orbit, upright toward the rim
  const serif = fontVar("--font-dm-serif", "serif");
  ctx.font = `${0.05 * px}px ${serif}`;
  ctx.fillStyle = "rgba(231, 180, 126, 0.85)";
  ctx.textBaseline = "middle";
  const orbit = (ORBIT / PLATE_R) * px;
  for (const [deg, glyph] of NOTES) {
    const a = deg * DEG;
    ctx.save();
    ctx.rotate(a);
    ctx.translate(orbit, 0);
    ctx.rotate(Math.PI / 2);
    ctx.fillText(glyph, 0, 0);
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function drawLogo(img: HTMLImageElement) {
  const h = 512;
  const w = Math.round((h * 87.3) / 78.2);
  const cv = document.createElement("canvas");
  cv.width = Math.round(w * LOGO_PAD);
  cv.height = Math.round(h * LOGO_PAD);
  const ctx = cv.getContext("2d")!;
  ctx.shadowColor = "rgba(133, 9, 9, 0.3)";
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 14;
  ctx.drawImage(img, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { tex, aspect: cv.width / cv.height };
}

type Prints = { print: THREE.CanvasTexture; logo: THREE.CanvasTexture; logoAspect: number };

/** draws the textures once the fonts and the logo are in */
function usePrints() {
  const [prints, setPrints] = useState<Prints | null>(null);
  useEffect(() => {
    let alive = true;
    let made: Prints | null = null;
    const img = new Image();
    img.src = "/svg/auvox-logomark.svg";
    Promise.all([document.fonts.ready, img.decode().catch(() => undefined)]).then(() => {
      if (!alive) return;
      const logo = drawLogo(img);
      made = { print: drawPrint(), logo: logo.tex, logoAspect: logo.aspect };
      setPrints(made);
    });
    return () => {
      alive = false;
      made?.print.dispose();
      made?.logo.dispose();
    };
  }, []);
  return prints;
}

// ---------------------------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------------------------

/** A GLB scene centred on its own bounds and scaled so its longest side is `size` units (as in Hero/World). */
function useNormalized(url: string, size: number) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const obj = scene.clone(true);
    const box = new THREE.Box3().setFromObject(obj);
    const dims = box.getSize(new THREE.Vector3());
    const k = size / Math.max(dims.x, dims.y, dims.z);
    const c = box.getCenter(new THREE.Vector3());
    obj.position.set(-c.x * k, -c.y * k, -c.z * k);
    obj.scale.multiplyScalar(k);
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat.map) mat.map.anisotropy = 8;
      mat.envMapIntensity = 0.9;
      // the guitar's body: an even gloss lacquer (see lib/r3f/lacquer)
      if (mat.name === GUITAR_BODY) mesh.material = lacquer(mat);
    });
    const holder = new THREE.Group();
    holder.add(obj);
    return holder;
  }, [scene, size]);
}

function Instrument({
  kind,
  url,
  size,
  rotation,
  tilt,
  phase,
}: {
  kind: NodeKey;
  url: string;
  /** longest side, in box sides */
  size: number;
  /** the model's own orientation (the guitar needs [-PI/2, 0, PI] to face the camera) */
  rotation: [number, number, number];
  /** how it sits on the disc */
  tilt: [number, number, number];
  phase: number;
}) {
  const model = useNormalized(url, size * U);
  const group = useRef<THREE.Group>(null);
  const lift = useRef(0);
  const base = NODE_BY_KEY[kind].angle;

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    const t = disc.still ? 0 : clock.elapsedTime;
    const a = (discAngle() + base) * DEG;
    const up = disc.hover === kind || disc.focus === kind ? 1 : 0;
    lift.current += (up - lift.current) * Math.min(1, dt * 6);
    const l = lift.current;
    const r = ORBIT * U;
    g.position.set(Math.cos(a) * r, -Math.sin(a) * r + l * 0.012 * U, 0.04 * U + Math.sin(t * 0.9 + phase) * 0.006 * U + l * 0.075 * U);
    g.rotation.set(
      tilt[0] + Math.sin(t * 0.5 + phase) * 0.05,
      tilt[1] + Math.sin(t * 0.33 + phase) * 0.16 + l * 0.4,
      tilt[2] + Math.sin(t * 0.41 + phase) * 0.04,
    );
    g.scale.setScalar(Math.max(0.001, disc.enter) * (1 + l * 0.14));
  });

  return (
    <group ref={group} scale={0.001}>
      <group rotation={rotation}>
        <primitive object={model} />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// The tonearm: plinth, post, gimbal, counterweight, tube and headshell, all from primitives
// ---------------------------------------------------------------------------------------------

/** the arm's height at the pivot, and its pitch when the stylus sits in the groove */
const ARM_H = 0.06 * U;
const PITCH_DOWN = Math.asin((ARM_H - 0.023 * U) / (ARM_LEN * U));
const PITCH_UP = PITCH_DOWN - 0.13;

function Tonearm() {
  const swing = useRef<THREE.Group>(null);
  const pitch = useRef<THREE.Group>(null);
  const mats = useMemo(
    () => ({
      metal: new THREE.MeshStandardMaterial({ color: "#dcbb92", metalness: 1, roughness: 0.3, envMapIntensity: 1.15 }),
      ink: new THREE.MeshStandardMaterial({ color: "#1d1b1a", metalness: 0.55, roughness: 0.34, envMapIntensity: 1 }),
      red: new THREE.MeshStandardMaterial({ color: "#850909", metalness: 0.25, roughness: 0.38 }),
    }),
    [],
  );
  useEffect(
    () => () => {
      mats.metal.dispose();
      mats.ink.dispose();
      mats.red.dispose();
    },
    [mats],
  );

  useFrame(() => {
    if (swing.current) swing.current.rotation.z = ARM_REST + (ARM_PLAY - ARM_REST) * disc.arm.swing;
    if (pitch.current) pitch.current.rotation.y = PITCH_DOWN + (PITCH_UP - PITCH_DOWN) * disc.arm.lift;
  });

  const L = ARM_LEN * U;
  const u = U;
  return (
    <group position={[ARM_PIVOT.x * u, ARM_PIVOT.y * u, 0]}>
      {/* plinth and its brass collar */}
      <mesh material={mats.ink} rotation-x={Math.PI / 2} position-z={0.012 * u}>
        <cylinderGeometry args={[0.062 * u, 0.068 * u, 0.024 * u, 48]} />
      </mesh>
      <mesh material={mats.metal} rotation-x={Math.PI / 2} position-z={0.026 * u}>
        <cylinderGeometry args={[0.042 * u, 0.042 * u, 0.006 * u, 48]} />
      </mesh>
      {/* post */}
      <mesh material={mats.metal} rotation-x={Math.PI / 2} position-z={ARM_H / 2}>
        <cylinderGeometry args={[0.013 * u, 0.018 * u, ARM_H, 24]} />
      </mesh>
      <group ref={swing} position-z={ARM_H}>
        <group ref={pitch}>
          {/* gimbal */}
          <mesh material={mats.ink}>
            <sphereGeometry args={[0.022 * u, 24, 16]} />
          </mesh>
          {/* counterweight with a red band */}
          <mesh material={mats.metal} rotation-z={Math.PI / 2} position-x={-0.064 * u}>
            <cylinderGeometry args={[0.028 * u, 0.028 * u, 0.05 * u, 32]} />
          </mesh>
          <mesh material={mats.red} rotation-z={Math.PI / 2} position-x={-0.036 * u}>
            <cylinderGeometry args={[0.0295 * u, 0.0295 * u, 0.006 * u, 32]} />
          </mesh>
          {/* tube */}
          <mesh material={mats.metal} rotation-z={-Math.PI / 2} position-x={(L - 0.06 * u) / 2}>
            <cylinderGeometry args={[0.0062 * u, 0.0068 * u, L - 0.06 * u, 16]} />
          </mesh>
          {/* headshell, its red stripe, the finger lift, the cartridge */}
          <mesh material={mats.ink} position={[L - 0.032 * u, 0, 0]}>
            <boxGeometry args={[0.076 * u, 0.034 * u, 0.01 * u]} />
          </mesh>
          <mesh material={mats.red} position={[L - 0.036 * u, 0, 0.0062 * u]}>
            <boxGeometry args={[0.05 * u, 0.007 * u, 0.0025 * u]} />
          </mesh>
          <mesh material={mats.metal} position={[L - 0.05 * u, 0.028 * u, 0.002 * u]}>
            <boxGeometry args={[0.006 * u, 0.026 * u, 0.003 * u]} />
          </mesh>
          <mesh material={mats.ink} position={[L - 0.008 * u, 0, -0.013 * u]}>
            <boxGeometry args={[0.03 * u, 0.022 * u, 0.016 * u]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// The record
// ---------------------------------------------------------------------------------------------

function vinylUniforms() {
  return {
    uR: { value: R },
    uAngle: { value: 0 },
    uDrift: { value: 0 },
    uReveal: { value: 0 },
    uEnter: { value: 0 },
    uLevel: { value: 0 },
    uMotor: { value: 0 },
    uLight: { value: new THREE.Vector2(-0.7, 0.7) },
    uLabelR: { value: LABEL_R / PLATE_R },
    uOrbitR: { value: ORBIT / PLATE_R },
    uPuckR: { value: PUCK_R / PLATE_R },
    uNodes: { value: NODES.map(() => new THREE.Vector4()) },
    uRipples: { value: Array.from({ length: 6 }, () => new THREE.Vector4()) },
    uRippleTone: { value: Array.from({ length: 6 }, () => new THREE.Vector3()) },
    uStylus: { value: new THREE.Vector4(0, 0, 0, 1) },
    uPivot: { value: new THREE.Vector2(ARM_PIVOT.x / PLATE_R, ARM_PIVOT.y / PLATE_R) },
  };
}
type VinylUniforms = ReturnType<typeof vinylUniforms>;

function Record() {
  const group = useRef<THREE.Group>(null);
  const vinyl = useRef<THREE.ShaderMaterial>(null);
  const shadow = useRef<THREE.ShaderMaterial>(null);
  const print = useRef<THREE.Mesh>(null);
  const logo = useRef<THREE.Mesh>(null);
  const smooth = useRef({ rx: -1.05, ry: 0, rz: 0.35, z: -2.4, y: -0.25 * U, lx: -0.7, ly: 0.7, logo: 1, hover: [0, 0, 0, 0] });
  const uniforms = useMemo(() => vinylUniforms(), []);
  const shadowUniforms = useMemo(() => ({ uR: { value: R }, uStrength: { value: 1 } }), []);
  const prints = usePrints();

  useFrame(({ camera, size, clock }, dt) => {
    const g = group.current;
    const m = vinyl.current;
    if (!g || !m) return;
    const s = smooth.current;
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 6);

    // --- the tilt: from low and far (scroll-in) to face-on, then a few degrees toward the pointer
    const t = disc.still ? 1 : disc.tilt;
    const e = 1 - (1 - t) * (1 - t);
    const back = 1 - e;
    const pt = disc.pointer.on && !disc.still && !disc.dragging ? 1 : 0;
    const px = THREE.MathUtils.clamp(disc.pointer.x, -0.7, 0.7) * pt;
    const py = THREE.MathUtils.clamp(disc.pointer.y, -0.7, 0.7) * pt;
    s.rx += (-back * 1.05 + py * 0.2 * e - s.rx) * k;
    s.ry += (px * 0.24 * e - s.ry) * k;
    s.rz += (back * 0.35 - s.rz) * k;
    s.z += (-back * 2.4 - s.z) * k;
    s.y += (-back * 0.25 * U - s.y) * k;
    g.rotation.set(s.rx, s.ry, s.rz);
    g.position.set(0, s.y, s.z);
    g.updateMatrixWorld();

    // --- the light: drifts slowly on its own; with a mouse over the section it comes from the pointer
    const idle = 2.36 + Math.sin(clock.elapsedTime * 0.15) * 0.45;
    let tx = Math.cos(idle);
    let ty = Math.sin(idle);
    if (pt && Math.hypot(px, py) > 0.04) {
      const len = Math.hypot(px, py);
      tx = px / len;
      ty = -py / len;
    }
    s.lx += (tx - s.lx) * k * 0.6;
    s.ly += (ty - s.ly) * k * 0.6;

    sampleAudio(audio);
    disc.level = audio.level;

    // --- the record's uniforms
    const u = m.uniforms as VinylUniforms;
    const angle = discAngle() * DEG;
    u.uAngle.value = angle;
    u.uDrift.value = angle * 0.72;
    u.uReveal.value = disc.reveal;
    u.uEnter.value = disc.enter;
    u.uLevel.value = audio.level;
    u.uMotor.value = disc.motor;
    u.uLight.value.set(s.lx, s.ly).normalize();
    NODES.forEach((n, i) => {
      const h = disc.hover === n.key || disc.focus === n.key ? 1 : 0;
      s.hover[i] += (h - s.hover[i]) * k;
      const p = nodePoint(n.key);
      u.uNodes.value[i].set(p.x, p.y, s.hover[i], n.active ? 1 : 0);
    });
    const now = performance.now() / 1000;
    for (let i = 0; i < 6; i++) {
      const rp = disc.ripples[i];
      const v = u.uRipples.value[i];
      if (!rp) {
        v.w = 0;
        continue;
      }
      const age = now - rp.t0;
      v.set(rp.x, rp.y, age, age < 3.2 ? rp.strength : 0);
      u.uRippleTone.value[i].set(rp.tone[0], rp.tone[1], rp.tone[2]);
    }
    const sp = stylusPoint();
    u.uStylus.value.set(sp.x, sp.y, 1 - disc.arm.lift, 1);
    if (shadow.current) (shadow.current.uniforms as typeof shadowUniforms).uStrength.value = 0.55 + 0.45 * e;

    // --- the printed ring turns with the record; the logo stays upright and breathes with the music
    if (print.current) print.current.rotation.z = -angle;
    if (logo.current) {
      const target = (disc.hover === "core" ? 1.12 : 1) * (1 + audio.level * 0.05) * Math.max(0.001, disc.enter);
      s.logo += (target - s.logo) * k;
      logo.current.scale.setScalar(s.logo);
    }

    // --- glue the DOM to the record: nodes and centre, in disc-box pixels
    const offX = (size.width - size.width / BLEED) / 2;
    const offY = (size.height - size.height / BLEED) / 2;
    const project = (x: number, y: number, key: NodeKey | "core") => {
      V.set(x, y, 0).applyMatrix4(g.matrixWorld).project(camera);
      const a = disc.anchors[key];
      a.x = (V.x * 0.5 + 0.5) * size.width - offX;
      a.y = (-V.y * 0.5 + 0.5) * size.height - offY;
      a.on = true;
    };
    for (const n of NODES) {
      const p = nodePoint(n.key);
      project(p.x * R, p.y * R, n.key);
    }
    project(0, 0, "core");
    disc.gl = true;
  });

  const printSize = PRINT_R * 2 * R;
  const logoH = LOGO_H * U * LOGO_PAD;
  return (
    <group ref={group}>
      {/* contact shadow on the page */}
      <mesh position={[0.02 * U, -0.05 * U, -0.07 * U]} renderOrder={-1}>
        <planeGeometry args={[R * 2.8, R * 2.8]} />
        <shaderMaterial ref={shadow} uniforms={shadowUniforms} vertexShader={VINYL_VERT} fragmentShader={SHADOW_FRAG} transparent depthWrite={false} />
      </mesh>
      {/* the record's edge, seen while it tilts */}
      <mesh rotation-x={Math.PI / 2} position-z={-0.009 * U}>
        <cylinderGeometry args={[R * 0.998, R * 0.998, 0.018 * U, 128, 1, true]} />
        <meshStandardMaterial color="#151312" roughness={0.3} metalness={0.25} side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <circleGeometry args={[R, 192]} />
        <shaderMaterial ref={vinyl} uniforms={uniforms} vertexShader={VINYL_VERT} fragmentShader={VINYL_FRAG} transparent />
      </mesh>
      {prints && (
        <>
          <mesh ref={print} position-z={0.0015 * U} renderOrder={1}>
            <planeGeometry args={[printSize, printSize]} />
            <meshBasicMaterial map={prints.print} transparent depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh ref={logo} position-z={0.004 * U} renderOrder={2} scale={0.001}>
            <planeGeometry args={[logoH * prints.logoAspect, logoH]} />
            <meshBasicMaterial map={prints.logo} transparent depthWrite={false} toneMapped={false} />
          </mesh>
        </>
      )}
      <Tonearm />
      <Suspense fallback={null}>
        <Instrument kind="guitar" url="/models/guitar-red-sm.glb" size={0.24} rotation={[-Math.PI / 2, 0, Math.PI]} tilt={[0.12, 0, 0.58]} phase={0} />
        <Instrument kind="piano" url="/models/casio-sm.glb" size={0.215} rotation={[0, 0, 0]} tilt={[0.72, -0.38, 0.3]} phase={2.1} />
        <Prewarm name="disc" />
      </Suspense>
    </group>
  );
}

/** Keeps the demand loop ticking while the section is on screen; off screen it renders nothing. */
function Pulse() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const tick = () => {
      if (disc.inView) invalidate();
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [invalidate]);
  return null;
}

export default function DiscWorld() {
  const bleed = ((BLEED - 1) / 2) * 100;
  return (
    <div className="pointer-events-none absolute z-10" style={{ inset: `-${bleed}%` }} aria-hidden>
      <Canvas
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        dpr={[1, 1.5]}
        frameloop="demand"
        camera={{ fov: FOV, near: 0.1, far: 40, position: [0, 0, CAM_Z] }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
      >
        <Pulse />
        <Suspense fallback={null}>
          <Environment files="/world/studio_1k.hdr" environmentIntensity={0.45} />
        </Suspense>
        <Record />
        {/* warm key from the upper left, a soft rim from the right, hemisphere fill */}
        <directionalLight position={[-6, 7, 5]} intensity={2.1} color="#ffe2bd" />
        <directionalLight position={[5, 2, 4]} intensity={0.45} color="#f3e7da" />
        <hemisphereLight args={["#fff7ec", "#5a4634", 0.6]} />
      </Canvas>
    </div>
  );
}

useGLTF.preload("/models/guitar-red-sm.glb");
useGLTF.preload("/models/casio-sm.glb");
