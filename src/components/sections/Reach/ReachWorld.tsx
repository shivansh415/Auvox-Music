"use client";

// The Reach's 3D layer: the AUVOX hand — a lacquered brand-red sculpture of Michelangelo's reaching
// hand, its forearm dissolving into the clouds — the guitar picks that drift round it, the spark that
// gathers between the fingertips, and dust in the light. The DOM decides where the fingertip goes
// (reach.tip, as a fraction of the stage); every frame the hand is placed so its fingertip lands
// exactly there, whatever the screen's shape. Demand loop: it only draws while the section is near.

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { gsap } from "@/lib/gsap";
import { sampleAudio } from "@/components/sections/Session/audio";
import { DUST_FRAG, DUST_VERT, SPARK_FRAG, SPARK_VERT, patchArm } from "./shaders";
import { reach, together } from "./state";

const FOV = 30;
const CAM_Z = 9;
const VIEW_H = 2 * CAM_Z * Math.tan(((FOV / 2) * Math.PI) / 180);
/** the model's wrist-to-fingertip length, in its own units */
const MODEL_LEN = 0.17;
/** screen direction from the AUVOX fingertip toward the student's (down-right), y up for 3D */
const DIR = new THREE.Vector2(0.82, -0.42).normalize();

const audio = { level: 0, bands: new Float32Array(12) };
const ease = (t: number) => t * t * (3 - 2 * t);
/** a fixed pseudo-random number per (i, n), 0-1 */
const rand = (i: number, n: number) => {
  const x = Math.sin((i + 1) * 91.7 + n * 13.3) * 43758.5453;
  return x - Math.floor(x);
};
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** a point on the z = 0 plane under a stage fraction (x right, y down) */
function onPlane(camera: THREE.Camera, fx: number, fy: number, out: THREE.Vector3) {
  out.set(fx * 2 - 1, -(fy * 2 - 1), 0.5).unproject(camera);
  const d = out.sub(camera.position).normalize();
  const t = -camera.position.z / d.z;
  return out.copy(camera.position).addScaledVector(d, t);
}

// ---------------------------------------------------------------------------------------------
// The AUVOX hand
// ---------------------------------------------------------------------------------------------

const Q = new THREE.Quaternion();
const E = new THREE.Euler();
const P = new THREE.Vector3();
const T = new THREE.Vector3();
const TIP = new THREE.Vector3();

function Guide() {
  const { scene } = useGLTF("/reach/guide.glb");
  const group = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const smooth = useRef({ morph: 0, px: 0, py: 0 });
  const uniforms = useMemo(
    () => ({
      uFadeA: { value: -0.29 },
      uFadeB: { value: -0.13 },
      uRim: { value: 0.15 },
      uRimColor: { value: new THREE.Color("#f3c48f") },
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
    const find = (name: string) => root.getObjectByName(name)?.position.clone() ?? new THREE.Vector3(MODEL_LEN, 0, 0);
    const mat = new THREE.MeshPhysicalMaterial({
      color: "#9a0f0c",
      roughness: 0.3,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      sheen: 0.5,
      sheenColor: new THREE.Color("#ff9a78"),
      sheenRoughness: 0.5,
      envMapIntensity: 1.15,
    });
    mat.onBeforeCompile = (shader) => patchArm(shader, uniforms);
    mat.customProgramCacheKey = () => "reach-arm";
    mat.userData.u = uniforms;
    m.material = mat;
    m.position.set(0, 0, 0);
    m.rotation.set(0, 0, 0);
    m.scale.set(1, 1, 1);
    m.frustumCulled = false;
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

    // orientation: fingers along DIR, the back of the hand toward us with a slight roll, a slow sway
    const angle = Math.atan2(DIR.y, DIR.x);
    s.px += (reach.pointer.x - s.px) * k * 0.5;
    s.py += (reach.pointer.y - s.py) * k * 0.5;
    const enter = ease(clamp01(reach.guideIn));
    E.set(0.55 + Math.sin(t * 0.4) * 0.04 + s.py * 0.05, -0.32 + Math.sin(t * 0.31) * 0.05 + s.px * 0.08, angle + Math.sin(t * 0.27) * 0.025 + (1 - enter) * 0.5, "ZYX");
    Q.setFromEuler(E);
    g.quaternion.copy(Q);

    // size: wrist to fingertip is reach.handLen of the stage height
    const scale = (reach.handLen * VIEW_H) / MODEL_LEN;
    g.scale.setScalar(scale);

    // place it so the fingertip lands on reach.tip; before it arrives it waits back in the cloud
    onPlane(camera, reach.tip.x, reach.tip.y, T);
    const back = (1 - enter) * VIEW_H * 0.75;
    T.x -= DIR.x * back + s.px * 0.04;
    T.y -= DIR.y * back - s.py * 0.04;
    T.z = -(1 - enter) * 1.5 + Math.sin(t * 0.6) * 0.03;
    P.copy(TIP).multiplyScalar(scale).applyQuaternion(Q);
    g.position.copy(T).sub(P);

    // the rim warms when the red comes
    u.uRim.value = 0.18 + reach.touch * 0.7 + Math.min(1, reach.flood) * 0.35;
  });

  return (
    <group ref={group}>
      <primitive ref={meshRef} object={mesh} />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Guitar picks: they gather round the hand, scatter as the clouds part, and burst from the touch
// ---------------------------------------------------------------------------------------------

const PICK_COUNT = 9;
const PICK_COLORS = ["#fdf2e3", "#e7b47e", "#1e1e1e", "#850909", "#fdf2e3", "#deb886", "#e7b47e", "#fdf2e3", "#1e1e1e"];

function pickShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.quadraticCurveTo(0.46, -0.08, 0.42, 0.26);
  s.quadraticCurveTo(0.36, 0.56, 0, 0.56);
  s.quadraticCurveTo(-0.36, 0.56, -0.42, 0.26);
  s.quadraticCurveTo(-0.46, -0.08, 0, -0.5);
  return s;
}

function Picks() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const geo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(pickShape(), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.03, bevelSegments: 4, curveSegments: 24 });
    g.center();
    return g;
  }, []);
  const mats = useMemo(
    () => PICK_COLORS.map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1 })),
    [],
  );
  const seeds = useMemo(
    () =>
      Array.from({ length: PICK_COUNT }, (_, i) => {
        const r = (n: number) => {
          const x = Math.sin((i + 1) * 91.7 + n * 13.3) * 43758.5453;
          return x - Math.floor(x);
        };
        return { a: (i / PICK_COUNT) * Math.PI * 2 + r(1) * 0.5, r: 0.9 + r(2) * 0.9, y: (r(3) - 0.5) * 0.9, z: (r(4) - 0.5) * 1.4, spin: 0.3 + r(5) * 0.7, size: 0.16 + r(6) * 0.1, bx: r(7) * 2 - 1, by: r(8) * 2 - 1 };
      }),
    [],
  );
  useEffect(
    () => () => {
      geo.dispose();
      mats.forEach((m) => m.dispose());
    },
    [geo, mats],
  );
  const centre = useRef(new THREE.Vector3());
  const gap = useRef(new THREE.Vector3());

  useFrame(({ camera, clock }) => {
    const t = reach.still ? 0 : clock.elapsedTime;
    // they circle the middle of the AUVOX hand
    onPlane(camera, reach.tip.x, reach.tip.y, centre.current);
    const len = reach.handLen * VIEW_H;
    centre.current.x -= DIR.x * len * 0.45;
    centre.current.y -= DIR.y * len * 0.45;
    onPlane(camera, reach.gap.x, reach.gap.y, gap.current);
    const gather = ease(clamp01(reach.tokens));
    const scatter = ease(clamp01(reach.open * 1.25));
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
        const d = ease(burst) * (3.2 + s.r);
        x = gap.current.x + Math.cos(s.a) * d;
        y = gap.current.y + Math.sin(s.a) * d * 0.8;
        z = s.z * 0.6 + burst * 1.2;
        vis = Math.sin(Math.PI * Math.min(1, burst * 1.15));
      } else {
        const a = s.a + t * 0.12 * s.spin;
        const rad = s.r * len * 0.75 * (1 + (1 - gather) * 2.2 + scatter * 1.8);
        x = centre.current.x + Math.cos(a) * rad;
        y = centre.current.y + Math.sin(a) * rad * 0.55 + s.y * len * 0.5 + Math.sin(t * 0.8 + i) * 0.04;
        z = s.z + (1 - gather) * -2.5 + scatter * 1.5;
        vis = gather * (1 - scatter);
      }
      m.position.set(x, y, z);
      m.rotation.set(t * s.spin * 0.6 + i, t * s.spin + i * 2.1, Math.sin(t * 0.5 + i) * 0.6);
      m.scale.setScalar(Math.max(0.0001, s.size * len * 0.9 * vis));
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
        />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// The spark between the fingertips, and dust in the light
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
    onPlane(camera, reach.gap.x, reach.gap.y, p.current);
    m.position.set(p.current.x, p.current.y, 0.3);
    const tg = together();
    const flicker = reach.still ? 1 : 0.9 + Math.sin(clock.elapsedTime * 9) * 0.06 + Math.sin(clock.elapsedTime * 23) * 0.04;
    u.uPower.value = (ease(tg) * 0.75 * (reach.armed ? 1 : 0) + reach.touch * 1.6 + audio.level * 0.4) * flicker;
    m.scale.setScalar(reach.handLen * VIEW_H * (0.55 + tg * 0.5 + reach.touch * 1.2));
    u.uColor.value.set(reach.flood > 0.2 ? "#ffd1a8" : "#fff1d6");
  });
  return (
    <mesh ref={mesh} renderOrder={10}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={SPARK_VERT} fragmentShader={SPARK_FRAG} transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}

function Dust() {
  const { geo, uniforms } = useMemo(() => {
    const n = 260;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rand(i, 1) - 0.5) * 11;
      pos[i * 3 + 1] = (rand(i, 2) - 0.5) * 6;
      pos[i * 3 + 2] = (rand(i, 3) - 0.5) * 4;
      seed[i] = rand(i, 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    return { geo: g, uniforms: { uTime: { value: 0 }, uSpan: { value: 6 }, uPx: { value: 60 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color("#fff3df") } } };
  }, []);
  const mat = useRef<THREE.ShaderMaterial>(null);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame(({ clock, gl }) => {
    if (!mat.current) return;
    const u = mat.current.uniforms as typeof uniforms;
    u.uTime.value = reach.still ? 0 : clock.elapsedTime;
    u.uPx.value = 62 * gl.getPixelRatio();
    u.uOpacity.value = 0.25 + reach.open * 0.45 + reach.touch * 0.3;
    u.uColor.value.set(reach.flood > 0.3 ? "#f3c48f" : "#fff3df");
  });
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={DUST_VERT} fragmentShader={DUST_FRAG} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

/** Keeps the demand loop ticking while the section is on screen; off screen it renders nothing. */
function Pulse() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const tick = () => {
      if (reach.inView) invalidate();
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [invalidate]);
  return null;
}

export default function ReachWorld() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[3]" aria-hidden>
      <Canvas
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        dpr={[1, 1.5]}
        frameloop="demand"
        camera={{ fov: FOV, near: 0.1, far: 40, position: [0, 0, CAM_Z] }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      >
        <Pulse />
        <Suspense fallback={null}>
          <Environment files="/world/studio_1k.hdr" environmentIntensity={0.55} />
          <Guide />
          <Picks />
        </Suspense>
        <Spark />
        <Dust />
        {/* the sun is up and to the left of centre: warm key from there, a soft rim from the right */}
        <directionalLight position={[-3, 6, 6]} intensity={2.4} color="#ffe6c4" />
        <directionalLight position={[6, -1, 3]} intensity={0.7} color="#ffd9b3" />
        <hemisphereLight args={["#fff4e6", "#6b3a2a", 0.55]} />
      </Canvas>
    </div>
  );
}

useGLTF.preload("/reach/guide.glb");
