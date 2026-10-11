"use client";

// The disc's 3D layer: a live guitar and keyboard ride the two active verse nodes as the disc turns.
// One canvas covers the disc box. Every frame it places both models on their orbit points and
// projects every node's orbit point into disc-box pixels (disc.anchors) so the DOM pucks and labels
// stay glued to them. The loop is on demand: a ticker invalidates it only while the section is near.

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { gsap } from "@/lib/gsap";
import { CAM_Z, DEG, FOV, NODES, NODE_BY_KEY, ORBIT, VIEW_H, disc, discAngle, type NodeKey } from "./state";

const ORBIT_R = ORBIT * VIEW_H;
const V = new THREE.Vector3();

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
      // the guitar's lacquer gets a clearcoat so the brand red reads as a glossy finish
      if (mat.name === "lambert4SG") {
        const phys = new THREE.MeshPhysicalMaterial();
        phys.copy(mat as THREE.MeshPhysicalMaterial);
        phys.clearcoat = 1;
        phys.clearcoatRoughness = 0.12;
        phys.roughness = Math.min(mat.roughness, 0.55);
        mesh.material = phys;
      }
    });
    const holder = new THREE.Group();
    holder.add(obj);
    return holder;
  }, [scene, size]);
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

/** Projects every node's orbit point into disc-box pixels for the DOM layer. */
function Orbit() {
  useFrame(({ camera, size }) => {
    const a = discAngle() * DEG;
    for (const n of NODES) {
      const t = a + n.angle * DEG;
      // y is flipped so a positive angle runs clockwise, like the CSS rotation of the disc
      V.set(Math.cos(t) * ORBIT_R, -Math.sin(t) * ORBIT_R, 0).project(camera);
      const p = disc.anchors[n.key];
      p.x = (V.x * 0.5 + 0.5) * size.width;
      p.y = (-V.y * 0.5 + 0.5) * size.height;
      p.on = true;
    }
  });
  return null;
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
  size: number;
  /** the model's own orientation (the guitar needs [-PI/2, 0, PI] to face the camera) */
  rotation: [number, number, number];
  /** how it sits on the disc */
  tilt: [number, number, number];
  phase: number;
}) {
  const model = useNormalized(url, size);
  const group = useRef<THREE.Group>(null);
  const lift = useRef(0);
  const base = NODE_BY_KEY[kind].angle;

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    const t = disc.still ? 0 : clock.elapsedTime;
    const a = (discAngle() + base) * DEG;
    const hovered = disc.hover === kind ? 1 : 0;
    lift.current += (hovered - lift.current) * Math.min(1, dt * 6);
    const l = lift.current;
    g.position.set(Math.cos(a) * ORBIT_R, -Math.sin(a) * ORBIT_R + Math.sin(t * 0.9 + phase) * 0.025 + l * 0.06, l * 0.3);
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

export default function DiscWorld() {
  return (
    <div className="absolute inset-0 z-10" aria-hidden>
      <Canvas
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        dpr={[1, 2]}
        frameloop="demand"
        camera={{ fov: FOV, near: 0.1, far: 40, position: [0, 0, CAM_Z] }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
      >
        <Pulse />
        <Orbit />
        <Suspense fallback={null}>
          <Environment files="/world/studio_1k.hdr" environmentIntensity={0.45} />
          <Instrument kind="guitar" url="/models/guitar-red.glb" size={1.0} rotation={[-Math.PI / 2, 0, Math.PI]} tilt={[0.12, 0, 0.58]} phase={0} />
          <Instrument kind="piano" url="/models/casio.glb" size={0.92} rotation={[0, 0, 0]} tilt={[0.72, -0.38, 0.3]} phase={2.1} />
        </Suspense>
        {/* warm key from the upper left, a cool-ish rim from the right, hemisphere fill */}
        <directionalLight position={[-6, 7, 5]} intensity={2.1} color="#ffe2bd" />
        <directionalLight position={[5, 2, 4]} intensity={0.45} color="#f3e7da" />
        <hemisphereLight args={["#fff7ec", "#5a4634", 0.6]} />
      </Canvas>
    </div>
  );
}

useGLTF.preload("/models/guitar-red.glb");
useGLTF.preload("/models/casio.glb");
