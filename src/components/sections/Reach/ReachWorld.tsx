"use client";

// The Reach's 3D layer — the whole picture except the words and the ring:
//   · the fog we start in (a bright veil in front of everything, with the light below in it)
//   · the sky with the sun, its rays, clouds at three depths
//   · the AUVOX hand — lacquered brand red — coming down out of the light and turning to reach
//     across, its forearm fading into the cloud; the picks that gather round it
//   · red petals drifting down once the sky is clear; motes in the light
//   · the student's hand (a real one), the spark between the fingertips
//   · bloom, vignette and the crimson grade that runs out from the touch
// The DOM decides where the fingertips go (reach.tip, reach.studentTip, as fractions of the stage);
// every frame the hands are placed so the fingertips land exactly there, whatever the screen's shape.
// Demand loop: it only draws while the section is near.

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, useGLTF, useTexture } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, ToneMapping } from "@react-three/postprocessing";
import { BlendFunction, Effect, ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { gsap } from "@/lib/gsap";
import { sampleAudio } from "@/components/sections/Session/audio";
import { GRADE_FRAG, MOTE_FRAG, MOTE_VERT, RAYS_FRAG, RAYS_VERT, SCREEN_VERT, SPARK_FRAG, SPARK_VERT, VEIL_FRAG, VEIL_WORLD_VERT, patchArm } from "./shaders";
import { reach, together } from "./state";

const FOV = 30;
const CAM_Z = 9;
const VIEW_H = 2 * CAM_Z * Math.tan(((FOV / 2) * Math.PI) / 180);
/** the model's wrist-to-index-fingertip length, in its own units (scripts/reach-hand.py) */
const MODEL_LEN = 0.164;
/** screen direction from the AUVOX fingertip toward the student's (right and down), y up for 3D */
const DIR = new THREE.Vector2(0.82, -0.42).normalize();
/** the sun in the sky image, as a fraction of it (x right, y down) */
const SUN_UV = { x: 0.499, y: 0.235 };
const SKY_ASPECT = 1536 / 1024;
/** the student's photo: its aspect and where the fingertip is, as fractions (x right, y down) */
const HAND_PHOTO = { aspect: 1024 / 1536, tipX: 154 / 1024, tipY: 405 / 1536 };

const CREAM = new THREE.Color("#fdf2e3");
const CREAM_LIT = new THREE.Color("#fff3e4");
const PEACH = new THREE.Color("#d1945c");

const audio = { level: 0, bands: new Float32Array(12) };
const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
/** a fixed pseudo-random number per (i, n), 0-1 */
const rand = (i: number, n: number) => {
  const x = Math.sin((i + 1) * 91.7 + n * 13.3) * 43758.5453;
  return x - Math.floor(x);
};

/** the pixel ratio: a laptop with few cores or little memory gets a lighter one */
function pickDpr(): [number, number] {
  if (typeof navigator === "undefined") return [1, 1.5];
  const nav = navigator as Navigator & { deviceMemory?: number };
  const low = (nav.hardwareConcurrency ?? 8) <= 8 || (nav.deviceMemory ?? 8) <= 8;
  return low ? [1, 1.2] : [1, 1.5];
}

/** what the 3D pieces tell each other, frame to frame */
const shared = {
  /** the middle of the AUVOX palm, world */
  palm: new THREE.Vector3(0, 4, 0),
  /** the sun, world */
  sun: new THREE.Vector3(0, 5, -30),
  /** the sun on screen, uv (y up) */
  sunUv: new THREE.Vector2(0.5, 0.75),
  /** the palm on screen, uv (y up) */
  palmUv: new THREE.Vector2(0.5, 0.6),
};

/** the view's size in world units at depth z */
function viewAt(z: number, aspect: number) {
  const h = VIEW_H * ((CAM_Z - z) / CAM_Z);
  return { w: h * aspect, h };
}

/** a point on the plane z = `z` under a stage fraction (x right, y down) */
const RAY = new THREE.Vector3();
function onPlane(camera: THREE.Camera, fx: number, fy: number, out: THREE.Vector3, z = 0) {
  out.set(fx * 2 - 1, -(fy * 2 - 1), 0.5).unproject(camera);
  RAY.copy(out).sub(camera.position).normalize();
  const t = (z - camera.position.z) / RAY.z;
  return out.copy(camera.position).addScaledVector(RAY, t);
}

function srgb<T extends THREE.Texture | THREE.Texture[]>(t: T): T {
  (Array.isArray(t) ? t : [t]).forEach((x) => {
    x.colorSpace = THREE.SRGBColorSpace;
    x.anisotropy = 4;
    x.needsUpdate = true;
  });
  return t;
}

// ---------------------------------------------------------------------------------------------
// The sky, the sun and its rays, the clouds
// ---------------------------------------------------------------------------------------------

const PROJ = new THREE.Vector3();

function Sky() {
  const tex = srgb(useTexture("/reach/sky.webp"));
  const mesh = useRef<THREE.Mesh>(null);
  const aspect = useThree((s) => s.size.width / s.size.height);
  const smooth = useRef({ px: 0, py: 0 });
  useFrame(({ camera }, dt) => {
    const m = mesh.current;
    if (!m) return;
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 3);
    const s = smooth.current;
    s.px += ((reach.still ? 0 : reach.pointer.x) - s.px) * k;
    s.py += ((reach.still ? 0 : reach.pointer.y) - s.py) * k;
    const z = -30;
    const v = viewAt(z, aspect);
    // cover, with room to breathe; the reveal pushes slowly out
    const zoom = 1.24 - 0.16 * ease(clamp01(reach.open));
    let w = v.w * zoom;
    let h = w / SKY_ASPECT;
    if (h < v.h * zoom) {
      h = v.h * zoom;
      w = h * SKY_ASPECT;
    }
    m.scale.set(w, h, 1);
    m.position.set(-s.px * 0.5, s.py * 0.35 - (1 - ease(clamp01(reach.open))) * 0.8, z);
    shared.sun.set(m.position.x + (SUN_UV.x - 0.5) * w, m.position.y + (0.5 - SUN_UV.y) * h, z);
    PROJ.copy(shared.sun).project(camera);
    shared.sunUv.set(PROJ.x * 0.5 + 0.5, PROJ.y * 0.5 + 0.5);
  });
  return (
    <mesh ref={mesh} renderOrder={-10}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} fog />
    </mesh>
  );
}

function Rays() {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const aspect = useThree((s) => s.size.width / s.size.height);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uAspect: { value: 1.6 }, uSun: { value: new THREE.Vector2(0.5, 0.75) }, uPower: { value: 0 }, uColor: { value: new THREE.Color("#fff1d8") } }), []);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m || !mat.current) return;
    const z = -6;
    const v = viewAt(z, aspect);
    m.scale.set(v.w * 1.02, v.h * 1.02, 1);
    m.position.set(0, 0, z);
    const u = mat.current.uniforms as typeof uniforms;
    u.uTime.value = reach.still ? 20 : clock.elapsedTime;
    u.uAspect.value = aspect;
    u.uSun.value.copy(shared.sunUv);
    u.uPower.value = ease(clamp01(reach.open)) * (0.62 + audio.level * 0.25);
  });
  return (
    <mesh ref={mesh} renderOrder={2} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={RAYS_VERT} fragmentShader={RAYS_FRAG} transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function Sun() {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uPower: { value: 0 }, uColor: { value: new THREE.Color("#fff6e4") } }), []);
  const aspect = useThree((s) => s.size.width / s.size.height);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m || !mat.current) return;
    m.position.copy(shared.sun);
    m.position.z += 0.5;
    const v = viewAt(m.position.z, aspect);
    m.scale.setScalar(v.h * 0.42);
    const flicker = reach.still ? 1 : 0.94 + Math.sin(clock.elapsedTime * 1.3) * 0.04 + Math.sin(clock.elapsedTime * 3.1) * 0.02;
    (mat.current.uniforms as typeof uniforms).uPower.value = ease(clamp01(reach.open)) * 0.45 * flicker;
  });
  return (
    <mesh ref={mesh} renderOrder={1}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={SPARK_VERT} fragmentShader={SPARK_FRAG} transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

/** three cloud plates at three depths: far and wide, mid (mirrored), and a bank in front, low */
function Clouds() {
  const [far, near] = srgb(useTexture(["/reach/clouds.webp", "/reach/clouds-near.webp"]));
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const aspect = useThree((s) => s.size.width / s.size.height);
  const layers = useMemo(
    () => [
      { z: -22, cover: 1.7, y: -0.1, drift: 0.012, flip: false, tex: far, opacity: 0.92 },
      { z: -10, cover: 1.35, y: -0.32, drift: -0.02, flip: true, tex: far, opacity: 0.85 },
      { z: 2.6, cover: 1.3, y: -0.62, drift: 0.03, flip: false, tex: near, opacity: 0.96 },
    ],
    [far, near],
  );
  const smooth = useRef({ px: 0, py: 0 });
  useFrame(({ clock }, dt) => {
    const t = reach.still ? 0 : clock.elapsedTime;
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 3);
    const s = smooth.current;
    s.px += ((reach.still ? 0 : reach.pointer.x) - s.px) * k;
    s.py += ((reach.still ? 0 : reach.pointer.y) - s.py) * k;
    const open = ease(clamp01(reach.open));
    layers.forEach((L, i) => {
      const m = refs.current[i];
      if (!m) return;
      const v = viewAt(L.z, aspect);
      let w = v.w * L.cover;
      let h = w / 1.5;
      if (h < v.h * L.cover) {
        h = v.h * L.cover;
        w = h * 1.5;
      }
      m.scale.set(L.flip ? -w : w, h, 1);
      const depth = (CAM_Z - L.z) / CAM_Z;
      // the near bank sinks as the scene opens; the far ones barely move
      const sink = i === 2 ? (0.25 + open * 0.55) * v.h : (1 - open) * 0.15 * v.h;
      m.position.set(Math.sin(t * L.drift * 3.0 + i) * 0.25 * v.w * 0.08 - (s.px * 0.9) / depth, L.y * v.h - sink + (s.py * 0.5) / depth, L.z);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = L.opacity * (i === 2 ? 1 - 0.55 * open : 1);
    });
  });
  return (
    <group>
      {layers.map((L, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          renderOrder={i === 2 ? 8 : 0}
          frustumCulled={false}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={L.tex} transparent depthWrite={false} color="#fff4e6" fog />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// The AUVOX hand
// ---------------------------------------------------------------------------------------------

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const Q = new THREE.Quaternion();
const QA = new THREE.Quaternion();
const QB = new THREE.Quaternion();
const QS = new THREE.Quaternion();
const E = new THREE.Euler();
const P = new THREE.Vector3();
const T = new THREE.Vector3();
const TIP = new THREE.Vector3();

/** the fog pose: fingers down, the palm toward the light below, the tips coming toward us, a 3/4 turn */
const FOG_POSE = new THREE.Quaternion()
  .setFromAxisAngle(Y, 0.42)
  .multiply(new THREE.Quaternion().setFromAxisAngle(X, -0.72))
  .multiply(new THREE.Quaternion().setFromAxisAngle(Y, Math.PI))
  .multiply(new THREE.Quaternion().setFromAxisAngle(Z, -Math.PI / 2));

function Guide() {
  const { scene } = useGLTF("/reach/guide-hd.glb");
  const group = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const smooth = useRef({ morph: 0, px: 0, py: 0 });
  const uniforms = useMemo(
    () => ({
      uFadeA: { value: -0.3 },
      uFadeB: { value: -0.13 },
      uRim: { value: 0.16 },
      uRimColor: { value: new THREE.Color("#ffd0a4") },
      uSss: { value: 0.3 },
      uSssColor: { value: new THREE.Color("#ff6d3e") },
    }),
    [],
  );

  const { mesh, tip, tipReach } = useMemo(() => {
    const root = scene.clone(true);
    let mesh: THREE.Mesh | null = null;
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).morphTargetDictionary) mesh = o as THREE.Mesh;
    });
    if (!mesh) throw new Error("guide.glb: no morphing mesh");
    const m = mesh as THREE.Mesh;
    // the index fingertip in each pose: empties the export writes next to the mesh
    const find = (name: string) => root.getObjectByName(name)?.position.clone() ?? new THREE.Vector3(MODEL_LEN, 0, 0);
    const mat = new THREE.MeshPhysicalMaterial({
      color: "#a01212",
      roughness: 0.4,
      metalness: 0,
      clearcoat: 0.55,
      clearcoatRoughness: 0.2,
      sheen: 0.7,
      sheenColor: new THREE.Color("#ff8d6e"),
      sheenRoughness: 0.5,
      specularIntensity: 0.8,
      envMapIntensity: 0.85,
      transparent: true,
    });
    mat.onBeforeCompile = (shader) => patchArm(shader, uniforms);
    mat.customProgramCacheKey = () => "reach-arm-v7";
    mat.userData.u = uniforms;
    m.material = mat;
    m.position.set(0, 0, 0);
    m.rotation.set(0, 0, 0);
    m.scale.set(1, 1, 1);
    m.frustumCulled = false;
    m.renderOrder = 4;
    m.castShadow = true;
    m.receiveShadow = true;
    return { mesh: m, tip: find("tip"), tipReach: find("tipReach") };
  }, [scene, uniforms]);

  useEffect(
    () => () => {
      (mesh.material as THREE.Material).dispose();
    },
    [mesh],
  );

  useFrame(({ camera, clock }, dt) => {
    const g = group.current;
    const hm = meshRef.current;
    if (!g || !hm) return;
    const u = (hm.material as THREE.MeshPhysicalMaterial).userData.u as typeof uniforms;
    const s = smooth.current;
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 5);
    const t = reach.still ? 0 : clock.elapsedTime;

    // the pose: the index straightens as the fingertips come together
    const target = Math.max(ease(together()) * 0.9, reach.touch);
    s.morph += (target - s.morph) * k;
    const idx = hm.morphTargetDictionary?.reach ?? 0;
    if (hm.morphTargetInfluences) hm.morphTargetInfluences[idx] = s.morph;
    TIP.copy(tip).lerp(tipReach, s.morph);

    // orientation: from the fog pose to the reach (fingers along DIR, the back of the hand toward us)
    s.px += (reach.pointer.x - s.px) * k * 0.5;
    s.py += (reach.pointer.y - s.py) * k * 0.5;
    const angle = Math.atan2(DIR.y, DIR.x);
    E.set(0.55 + Math.sin(t * 0.4) * 0.04 + s.py * 0.05, -0.32 + Math.sin(t * 0.31) * 0.05 + s.px * 0.08, angle + Math.sin(t * 0.27) * 0.025, "ZYX");
    QB.setFromEuler(E);
    E.set(Math.sin(t * 0.33) * 0.05 + s.py * 0.04, Math.sin(t * 0.21) * 0.06 + s.px * 0.08, Math.sin(t * 0.4) * 0.03, "XYZ");
    QS.setFromEuler(E);
    QA.copy(QS).multiply(FOG_POSE);
    const turn = ease(clamp01(reach.turn));
    Q.copy(QA).slerp(QB, turn);
    g.quaternion.copy(Q);

    // size: wrist to fingertip is reach.handLen of the stage height
    // bigger while it comes down out of the light, foreshortened toward us
    const scale = ((reach.handLen * VIEW_H) / MODEL_LEN) * (1 + 0.32 * (1 - turn));
    g.scale.setScalar(scale);

    // place it so the fingertip lands on reach.tip
    onPlane(camera, reach.tip.x, reach.tip.y, T);
    T.x -= s.px * 0.05;
    T.y += s.py * 0.05;
    T.z = Math.sin(t * 0.6) * 0.03 - (1 - turn) * 0.6;
    P.copy(TIP).multiplyScalar(scale).applyQuaternion(Q);
    g.position.copy(T).sub(P);

    // where the palm is, for the picks and the fog
    shared.palm.set(MODEL_LEN * 0.35, 0, 0).multiplyScalar(scale).applyQuaternion(Q).add(g.position);
    PROJ.copy(shared.palm).project(camera);
    shared.palmUv.set(PROJ.x * 0.5 + 0.5, PROJ.y * 0.5 + 0.5);

    // the rim warms when the red comes
    u.uRim.value = 0.16 + reach.touch * 0.8 + reach.red * 0.5;
    u.uSss.value = 0.3 + (1 - turn) * 0.12 + reach.touch * 0.5;
    u.uRimColor.value.set(reach.red > 0.3 ? "#ff8a6a" : "#ffd0a4");
  });

  return (
    <group ref={group}>
      <primitive ref={meshRef} object={mesh} />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Guitar picks, with the AUVOX mark: they gather round the hand in the fog, scatter as it turns
// to reach across, and burst from the touch
// ---------------------------------------------------------------------------------------------

const PICK_COUNT = 8;
const PICK_FACES = [0, 1, 0, 2, 0, 1, 2, 0];
const PICK_SIDES = ["#f6e7d0", "#7e0a0a", "#2a2a2a"];

function pickShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.quadraticCurveTo(0.46, -0.1, 0.42, 0.22);
  s.quadraticCurveTo(0.36, 0.5, 0, 0.5);
  s.quadraticCurveTo(-0.36, 0.5, -0.42, 0.22);
  s.quadraticCurveTo(-0.46, -0.1, 0, -0.5);
  return s;
}

/** canvas textures of the logomark on a pick face, in three colourways */
function useLogoFaces() {
  const [faces, setFaces] = useState<THREE.CanvasTexture[] | null>(null);
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      const make = (bg: string, fg: string) => {
        const c = document.createElement("canvas");
        c.width = c.height = 512;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, 512, 512);
        // a soft ring, like a pressed edge
        ctx.strokeStyle = fg;
        ctx.globalAlpha = 0.18;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(256, 256, 206, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        const o = document.createElement("canvas");
        o.width = o.height = 512;
        const oc = o.getContext("2d")!;
        const sz = 250;
        const w = sz;
        const h = (sz * 78.2) / 87.3;
        oc.drawImage(img, 256 - w / 2, 256 - h / 2, w, h);
        oc.globalCompositeOperation = "source-in";
        oc.fillStyle = fg;
        oc.fillRect(0, 0, 512, 512);
        ctx.drawImage(o, 0, 0);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        return tex;
      };
      setFaces([make("#fdf2e3", "#850909"), make("#8a0b0b", "#fdf2e3"), make("#1e1e1e", "#e7b47e")]);
    };
    img.src = "/svg/auvox-logomark.svg";
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => () => faces?.forEach((t) => t.dispose()), [faces]);
  return faces;
}

function Picks() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const faces = useLogoFaces();
  const geo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(pickShape(), { depth: 0.06, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 5, curveSegments: 28 });
    g.center();
    // the faces take the logo square-on; the back is mirrored so the mark reads the right way round
    const pos = g.attributes.position as THREE.BufferAttribute;
    const nor = g.attributes.normal as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const nz = nor.getZ(i);
      if (Math.abs(nz) > 0.5) uv.setXY(i, nz > 0 ? pos.getX(i) + 0.5 : 0.5 - pos.getX(i), pos.getY(i) + 0.5);
      else uv.setXY(i, 0.02, 0.02);
    }
    uv.needsUpdate = true;
    return g;
  }, []);
  const mats = useMemo(
    () =>
      PICK_FACES.map((f) => [
        new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.1 }),
        new THREE.MeshPhysicalMaterial({ color: PICK_SIDES[f], roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.2, envMapIntensity: 0.9 }),
      ]),
    [],
  );
  useEffect(() => {
    if (!faces) return;
    PICK_FACES.forEach((f, i) => {
      mats[i][0].map = faces[f];
      mats[i][0].needsUpdate = true;
    });
  }, [faces, mats]);
  const seeds = useMemo(
    () =>
      Array.from({ length: PICK_COUNT }, (_, i) => ({
        a: (i / PICK_COUNT) * Math.PI * 2 + rand(i, 1) * 0.6,
        r: 0.85 + rand(i, 2) * 0.7,
        y: (rand(i, 3) - 0.5) * 0.8,
        z: (rand(i, 4) - 0.5) * 1.6,
        spin: 0.35 + rand(i, 5) * 0.6,
        size: 0.26 + rand(i, 6) * 0.12,
        tilt: (rand(i, 7) - 0.5) * 1.2,
      })),
    [],
  );
  useEffect(
    () => () => {
      geo.dispose();
      mats.flat().forEach((m) => m.dispose());
    },
    [geo, mats],
  );
  const gap = useRef(new THREE.Vector3());

  useFrame(({ camera, clock }) => {
    const t = reach.still ? 0 : clock.elapsedTime;
    const len = reach.handLen * VIEW_H;
    onPlane(camera, reach.gap.x, reach.gap.y, gap.current);
    const gather = ease(clamp01(reach.tokens));
    const scatter = ease(clamp01(reach.turn * 1.25));
    const burst = reach.burst;
    seeds.forEach((s, i) => {
      const m = refs.current[i];
      if (!m) return;
      let x: number;
      let y: number;
      let z: number;
      let vis: number;
      if (burst > 0 && burst < 1) {
        // thrown out from the touch
        const d = ease(burst) * (3.4 + s.r);
        x = gap.current.x + Math.cos(s.a) * d;
        y = gap.current.y + Math.sin(s.a) * d * 0.8;
        z = s.z * 0.6 + burst * 1.4;
        vis = Math.sin(Math.PI * Math.min(1, burst * 1.15));
      } else {
        // circling the palm, in a loose ring that faces us
        const a = s.a + t * 0.14 * s.spin;
        const rad = s.r * len * 0.72 * (1 + (1 - gather) * 1.6 + scatter * 2.4);
        x = shared.palm.x + Math.cos(a) * rad;
        y = shared.palm.y + Math.sin(a) * rad * 0.62 + s.y * len * 0.35 + Math.sin(t * 0.7 + i) * 0.05;
        z = shared.palm.z + s.z * 0.5 + Math.sin(a) * 0.5 + (1 - gather) * -2.2 + scatter * 2.2;
        vis = gather * (1 - scatter);
      }
      m.position.set(x, y, z);
      m.rotation.set(s.tilt + Math.sin(t * 0.5 * s.spin + i) * 0.5, t * s.spin * 0.9 + i * 2.1, Math.sin(t * 0.4 + i) * 0.5);
      m.scale.setScalar(Math.max(0.0001, s.size * len * vis));
      m.visible = vis > 0.01;
    });
  });

  return (
    <group>
      {seeds.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          geometry={geo}
          material={mats[i]}
          renderOrder={5}
        />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Red petals drifting down through the open sky
// ---------------------------------------------------------------------------------------------

const PETAL_COUNT = 64;
const DUMMY = new THREE.Object3D();
const PETAL_COLORS = [new THREE.Color("#a3100e"), new THREE.Color("#850909"), new THREE.Color("#c1281c"), new THREE.Color("#e7b47e")];

function petalGeometry() {
  const g = new THREE.PlaneGeometry(1, 1.7, 6, 12);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const up = Math.max(0, y / 0.85);
    const down = Math.max(0, -y / 0.85);
    const nx = x * (1 - 0.72 * Math.pow(up, 1.5)) * (1 - 0.55 * Math.pow(down, 2.2));
    const z = 0.2 * Math.pow(nx / 0.5, 2) + 0.07 * Math.pow(y / 0.85, 2) - 0.05 + 0.06 * Math.sin(y * 3.0);
    pos.setXYZ(i, nx, y, z);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

function Petals() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => petalGeometry(), []);
  const mat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        roughness: 0.5,
        sheen: 0.9,
        sheenColor: new THREE.Color("#ff9b86"),
        sheenRoughness: 0.55,
        emissive: new THREE.Color("#3a0000"),
        emissiveIntensity: 0.3,
        envMapIntensity: 0.7,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const seeds = useMemo(
    () =>
      Array.from({ length: PETAL_COUNT }, (_, i) => ({
        x: (rand(i, 1) - 0.5) * 13,
        y0: rand(i, 2) * 9,
        z: -6.5 + rand(i, 3) * 8,
        speed: 0.22 + rand(i, 4) * 0.3,
        sway: 0.4 + rand(i, 5) * 0.7,
        swayF: 0.25 + rand(i, 6) * 0.4,
        ph: rand(i, 7) * Math.PI * 2,
        size: 0.14 + rand(i, 8) * 0.14,
        rx: (rand(i, 9) - 0.5) * 1.6,
        ry: (rand(i, 10) - 0.5) * 1.4,
        color: rand(i, 11) < 0.12 ? 3 : rand(i, 12) < 0.5 ? 0 : rand(i, 13) < 0.5 ? 1 : 2,
      })),
    [],
  );
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    seeds.forEach((s, i) => m.setColorAt(i, PETAL_COLORS[s.color]));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [seeds]);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const t = reach.still ? 0 : clock.elapsedTime;
    const vis = ease(clamp01(reach.open * 1.1 - 0.05));
    const gust = 1 + reach.burst * 2.5;
    const span = 9;
    seeds.forEach((s, i) => {
      const yy = (((s.y0 - t * s.speed * gust) % span) + span) % span - span * 0.5;
      const x = s.x + Math.sin(t * s.swayF + s.ph) * s.sway + Math.sin(t * 0.13 + s.ph) * 0.3;
      DUMMY.position.set(x, yy + 0.4, s.z + Math.sin(t * 0.2 + s.ph) * 0.3);
      DUMMY.rotation.set(s.rx + t * (0.5 + s.swayF) + s.ph, s.ry + Math.sin(t * s.swayF * 1.4 + s.ph) * 1.2, Math.sin(t * 0.6 + s.ph) * 0.8);
      DUMMY.scale.setScalar(Math.max(0.0001, s.size * vis));
      DUMMY.updateMatrix();
      m.setMatrixAt(i, DUMMY.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.visible = vis > 0.001;
  });
  return <instancedMesh ref={mesh} args={[geo, mat, PETAL_COUNT]} frustumCulled={false} renderOrder={6} />;
}

// ---------------------------------------------------------------------------------------------
// The student's hand — a real one — rising to meet the AUVOX hand
// ---------------------------------------------------------------------------------------------

const S = new THREE.Vector3();
const L = new THREE.Vector3();

function Student() {
  const tex = srgb(useTexture("/reach/hand.webp"));
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => {
    const m = mesh.current;
    if (!m) return;
    const z = 0.25;
    const sIn = ease(clamp01(reach.studentIn));
    const ph = VIEW_H * ((CAM_Z - z) / CAM_Z) * reach.handLen * 2.55;
    const pw = ph * HAND_PHOTO.aspect;
    m.scale.set(pw, ph, 1);
    m.rotation.set(0, 0, THREE.MathUtils.degToRad(12 + 10 * sIn));
    onPlane(camera, reach.studentTip.x, reach.studentTip.y, S, z);
    L.set((HAND_PHOTO.tipX - 0.5) * pw, (0.5 - HAND_PHOTO.tipY) * ph, 0).applyEuler(m.rotation);
    m.position.copy(S).sub(L);
    m.position.z = z;
    (m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, sIn * 1.5);
    m.visible = sIn > 0.001;
  });
  return (
    <mesh ref={mesh} renderOrder={7} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} alphaTest={0.01} fog />
    </mesh>
  );
}

// ---------------------------------------------------------------------------------------------
// The spark between the fingertips, motes in the light, the fog
// ---------------------------------------------------------------------------------------------

function Spark() {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uPower: { value: 0 }, uColor: { value: new THREE.Color("#fff1d6") } }), []);
  const p = useRef(new THREE.Vector3());
  useFrame(({ camera, clock }) => {
    const m = mesh.current;
    if (!m || !mat.current) return;
    const u = mat.current.uniforms as typeof uniforms;
    sampleAudio(audio);
    onPlane(camera, reach.gap.x, reach.gap.y, p.current, 0.4);
    m.position.copy(p.current);
    const tg = together();
    const flicker = reach.still ? 1 : 0.9 + Math.sin(clock.elapsedTime * 9) * 0.06 + Math.sin(clock.elapsedTime * 23) * 0.04;
    u.uPower.value = (ease(tg) * 0.8 * (reach.armed ? 1 : 0) + reach.touch * 1.8 + audio.level * 0.4 * reach.red) * flicker;
    m.scale.setScalar(reach.handLen * VIEW_H * (0.5 + tg * 0.5 + reach.touch * 1.4));
    u.uColor.value.set(reach.red > 0.2 ? "#ffd1a8" : "#fff1d6");
  });
  return (
    <mesh ref={mesh} renderOrder={20}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={SPARK_VERT} fragmentShader={SPARK_FRAG} transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function Motes() {
  const { geo, uniforms } = useMemo(() => {
    const n = 220;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rand(i, 1) - 0.5) * 13;
      pos[i * 3 + 1] = (rand(i, 2) - 0.5) * 7;
      pos[i * 3 + 2] = -5 + rand(i, 3) * 8;
      seed[i] = rand(i, 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    return { geo: g, uniforms: { uTime: { value: 0 }, uSpan: { value: 7 }, uPx: { value: 60 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color("#fff3df") } } };
  }, []);
  const mat = useRef<THREE.ShaderMaterial>(null);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame(({ clock, gl }) => {
    if (!mat.current) return;
    const u = mat.current.uniforms as typeof uniforms;
    u.uTime.value = reach.still ? 0 : clock.elapsedTime;
    u.uPx.value = 70 * gl.getPixelRatio();
    u.uOpacity.value = 0.12 + ease(clamp01(reach.open)) * 0.55 + reach.touch * 0.3;
  });
  return (
    <points geometry={geo} frustumCulled={false} renderOrder={9}>
      <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={MOTE_VERT} fragmentShader={MOTE_FRAG} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

/**
 * The fog we start in. Most of it is a plane just behind the hand (so the hand stays crisp and
 * lacquered in front of it, with the light below glowing through); a thin veil in front of everything
 * softens the hand a little and parts around it.
 */
function Fog({ front }: { front: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const aspect = useThree((s) => s.size.width / s.size.height);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAspect: { value: 1.6 },
      uFog: { value: 1 },
      uLight: { value: 1 },
      uLightPos: { value: new THREE.Vector2(0.5, 0.1) },
      uClear: { value: new THREE.Vector2(0.5, 0.6) },
      uClearR: { value: 0.3 },
      uCream: { value: CREAM_LIT.clone() },
      uPeach: { value: PEACH.clone() },
    }),
    [],
  );
  useFrame(({ clock }) => {
    const m = mat.current;
    if (!m) return;
    const u = m.uniforms as typeof uniforms;
    u.uTime.value = (reach.still ? 0 : clock.elapsedTime) + (front ? 40 : 0);
    u.uAspect.value = aspect;
    if (front) {
      u.uFog.value = reach.fog * 0.26;
      u.uLight.value = 0;
      u.uClear.value.copy(shared.palmUv);
      u.uClearR.value = 0.34 + reach.descend * 0.14;
    } else {
      u.uFog.value = reach.fog;
      u.uLight.value = reach.light * (0.85 + audio.level * 0.3);
      u.uClearR.value = 0.0001;
      if (mesh.current) {
        const z = -2.6;
        const v = viewAt(z, aspect);
        mesh.current.scale.set(v.w * 1.02, v.h * 1.02, 1);
        mesh.current.position.set(0, 0, z);
      }
    }
    m.visible = u.uFog.value > 0.002 || u.uLight.value > 0.002;
  });
  if (front) {
    return (
      <mesh renderOrder={60} frustumCulled={false}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={SCREEN_VERT} fragmentShader={VEIL_FRAG} transparent depthWrite={false} depthTest={false} premultipliedAlpha blending={THREE.NormalBlending} />
      </mesh>
    );
  }
  return (
    <mesh ref={mesh} renderOrder={3} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={VEIL_WORLD_VERT} fragmentShader={VEIL_FRAG} transparent depthWrite={false} premultipliedAlpha blending={THREE.NormalBlending} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------------------------
// Light, air and the grade
// ---------------------------------------------------------------------------------------------

/** depth fog that lifts as the scene opens, and the lights that change with it */
function Atmosphere() {
  const fog = useRef<THREE.FogExp2>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const below = useRef<THREE.PointLight>(null);
  const bp = useRef(new THREE.Vector3());
  useFrame(({ camera }) => {
    if (fog.current) fog.current.density = 0.011 + 0.042 * reach.fog;
    if (key.current) key.current.intensity = 3.4 + 0.8 * ease(clamp01(reach.open)) + reach.touch * 1.5;
    if (below.current) {
      onPlane(camera, 0.5, 1.05, bp.current, 3.2);
      below.current.position.copy(bp.current);
      below.current.intensity = reach.light * 70;
    }
  });
  return (
    <>
      <fogExp2 ref={fog} attach="fog" args={[CREAM.getHex(), 0.05]} />
      <directionalLight ref={key} position={[-3, 6.5, 6]} intensity={2.4} color="#ffe6c4" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} shadow-camera-near={1} shadow-camera-far={30} />
      <directionalLight position={[6, -1, 3]} intensity={0.35} color="#ffd9b3" />
      <directionalLight position={[0, 1, 9]} intensity={0.3} color="#fff0e4" />
      <directionalLight position={[3, 4, -7]} intensity={3.0} color="#fff1e2" />
      <hemisphereLight args={["#fff4e6", "#5a3024", 0.4]} />
      <pointLight ref={below} position={[0, -4, 2]} intensity={0} color="#fff1dc" distance={14} decay={2} />
    </>
  );
}

class CrimsonGradeEffect extends Effect {
  constructor() {
    super("CrimsonGradeEffect", GRADE_FRAG, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ["uCenter", new THREE.Uniform(new THREE.Vector2(0.5, 0.5))],
        ["uRadius", new THREE.Uniform(0)],
        ["uRed", new THREE.Uniform(0)],
        ["uFlash", new THREE.Uniform(0)],
        ["uAspect", new THREE.Uniform(1.6)],
      ]),
    });
  }
}

function Post() {
  const grade = useMemo(() => new CrimsonGradeEffect(), []);
  const aspect = useThree((s) => s.size.width / s.size.height);
  useFrame(() => {
    const u = grade.uniforms;
    (u.get("uCenter")!.value as THREE.Vector2).set(reach.gap.x, 1 - reach.gap.y);
    u.get("uRadius")!.value = reach.flood;
    u.get("uRed")!.value = reach.red;
    u.get("uFlash")!.value = reach.touch * 0.9;
    u.get("uAspect")!.value = aspect;
  });
  return (
    <EffectComposer multisampling={0} frameBufferType={THREE.HalfFloatType}>
      <Bloom intensity={0.7} luminanceThreshold={0.78} luminanceSmoothing={0.25} mipmapBlur radius={0.7} />
      <primitive object={grade} />
      <Vignette eskil={false} offset={0.28} darkness={0.5} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  );
}

/**
 * Keeps the demand loop ticking while the section is on screen; off screen it renders nothing.
 * The first second after mount always draws, so shaders compile and textures upload before the
 * section is scrolled to; once a few frames are in, the picture fades up (`onReady`).
 */
function Pulse({ onReady }: { onReady: () => void }) {
  const invalidate = useThree((s) => s.invalidate);
  const frames = useRef(0);
  useFrame(() => {
    frames.current++;
    if (frames.current === 3) onReady();
  });
  useEffect(() => {
    const born = performance.now();
    const tick = () => {
      if (reach.inView || performance.now() - born < 1200) invalidate();
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [invalidate]);
  return null;
}

export default function ReachWorld() {
  const wrap = useRef<HTMLDivElement>(null);
  const dpr = useMemo(() => pickDpr(), []);
  return (
    <div ref={wrap} className="rch-world pointer-events-none absolute inset-0 z-[1]" aria-hidden>
      <Canvas
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        dpr={dpr}
        frameloop="demand"
        shadows="soft"
        camera={{ fov: FOV, near: 0.1, far: 60, position: [0, 0, CAM_Z] }}
        gl={{ antialias: false, alpha: false, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping }}
      >
        <color attach="background" args={["#fdf2e3"]} />
        <Pulse
          onReady={() => {
            if (wrap.current) wrap.current.dataset.ready = "1";
          }}
        />
        <Atmosphere />
        <Suspense fallback={null}>
          <Environment files="/world/studio_1k.hdr" environmentIntensity={0.45} />
          <Sky />
          <Clouds />
          <Guide />
          <Picks />
          <Student />
        </Suspense>
        <Sun />
        <Rays />
        <Petals />
        <Motes />
        <Spark />
        <Fog front={false} />
        <Fog front />
        <Post />
      </Canvas>
    </div>
  );
}

useGLTF.preload("/reach/guide-hd.glb");
useTexture.preload(["/reach/sky.webp", "/reach/clouds.webp", "/reach/clouds-near.webp", "/reach/hand.webp"]);
