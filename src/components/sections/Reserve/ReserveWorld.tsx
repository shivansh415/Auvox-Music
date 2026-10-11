"use client";

// The reserve page's 3D layer: one low-opacity instrument (guitar, or the keyboard once it is
// picked in the form) floating over the red, leaning gently toward the pointer.

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { reserve, type DemoInstrument } from "./state";

const FOV = 30;
const CAM_Z = 9;
const OPACITY = 0.35;

const MODELS: Record<DemoInstrument, { url: string; size: number; rotation: [number, number, number]; tilt: [number, number, number] }> = {
  guitar: { url: "/models/guitar-red.glb", size: 3.6, rotation: [-Math.PI / 2, 0, Math.PI], tilt: [0.05, 0, 0.62] },
  keyboard: { url: "/models/casio.glb", size: 3.1, rotation: [0, 0, 0], tilt: [0.75, -0.35, 0.38] },
};

/** A GLB scene centred and scaled to `size`, every material cloned and made translucent. */
function useGhost(url: string, size: number) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const obj = scene.clone(true);
    const box = new THREE.Box3().setFromObject(obj);
    const dims = box.getSize(new THREE.Vector3());
    const k = size / Math.max(dims.x, dims.y, dims.z);
    const c = box.getCenter(new THREE.Vector3());
    obj.position.set(-c.x * k, -c.y * k, -c.z * k);
    obj.scale.multiplyScalar(k);
    const mats: THREE.MeshStandardMaterial[] = [];
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material as THREE.MeshStandardMaterial;
      const mat = src.clone();
      mat.transparent = true;
      mat.opacity = 0;
      mat.depthWrite = false;
      mat.envMapIntensity = 0.8;
      mesh.material = mat;
      mats.push(mat);
    });
    const holder = new THREE.Group();
    holder.add(obj);
    return { holder, mats };
  }, [scene, size]);
}

function Ghost({ kind }: { kind: DemoInstrument }) {
  const spec = MODELS[kind];
  const { holder, mats } = useGhost(spec.url, spec.size);
  const group = useRef<THREE.Group>(null);
  const fade = useRef(0);

  useEffect(() => {
    return () => mats.forEach((m) => m.dispose());
  }, [mats]);

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    // fades up from below on mount (and after a swap), then floats
    fade.current += (1 - fade.current) * Math.min(1, dt * 2.4);
    const f = fade.current;
    g.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (mat && (o as THREE.Mesh).isMesh) mat.opacity = OPACITY * f;
    });
    g.position.set(Math.sin(t * 0.21) * 0.06, Math.sin(t * 0.6) * 0.1 - (1 - f) * 0.5, 0);
    g.rotation.set(spec.tilt[0] + Math.sin(t * 0.37) * 0.04, spec.tilt[1] + Math.sin(t * 0.16) * 0.12 + (1 - f) * 0.6, spec.tilt[2] + Math.sin(t * 0.29) * 0.03);
    g.scale.setScalar(0.9 + 0.1 * f);
  });

  return (
    <group ref={group}>
      <group rotation={spec.rotation}>
        <primitive object={holder} />
      </group>
    </group>
  );
}

/** The whole scene leans toward the pointer. */
function Rig({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const k = Math.min(1, dt * 2.5);
    g.rotation.y += (reserve.mouse.x * 0.35 - g.rotation.y) * k;
    g.rotation.x += (-reserve.mouse.y * 0.18 - g.rotation.x) * k;
  });
  return <group ref={ref}>{children}</group>;
}

export default function ReserveWorld({ instrument }: { instrument: DemoInstrument }) {
  return (
    <Canvas
      className="absolute inset-0"
      style={{ pointerEvents: "none" }}
      dpr={[1, 2]}
      camera={{ fov: FOV, near: 0.1, far: 60, position: [0, 0, CAM_Z] }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }}
    >
      <Rig>
        <Suspense fallback={null}>
          <Environment files="/world/studio_1k.hdr" environmentIntensity={0.45} />
          <Ghost key={instrument} kind={instrument} />
        </Suspense>
      </Rig>
      <directionalLight position={[-6, 7, 5]} intensity={2.2} color="#ffe2bd" />
      <directionalLight position={[5, 2, 4]} intensity={0.5} color="#f3e7da" />
      <hemisphereLight args={["#fff1dc", "#5a0a0a", 0.6]} />
    </Canvas>
  );
}

useGLTF.preload("/models/guitar-red.glb");
useGLTF.preload("/models/casio.glb");
