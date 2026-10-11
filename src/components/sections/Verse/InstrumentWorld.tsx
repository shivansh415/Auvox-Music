"use client";

// The verse page's 3D layer: one instrument (the brand-red guitar or the keyboard), lit like the
// home hero, floating in a transparent canvas. It rises and turns in on load, sways slowly, leans
// toward the pointer, and plays when hovered. The DOM layer scales the canvas wrapper on scroll.

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { Verse } from "@/content/packages";
import { playChord, playRiff, unlockAudio } from "../Session/audio";
import { verseState } from "./state";

const FOV = 30;
const CAM_Z = 9;

type Triple = [number, number, number];

const MODELS: Record<Verse, { url: string; size: number; rotation: Triple; tilt: Triple; sway: number }> = {
  // the guitar faces the camera with its neck along +X; the tilt stands it up diagonally
  guitar: { url: "/models/guitar-red.glb", size: 3.4, rotation: [-Math.PI / 2, 0, Math.PI], tilt: [0.1, -0.22, 0.95], sway: 0.32 },
  // the keyboard is pitched toward the camera so the keys read
  piano: { url: "/models/casio.glb", size: 3.4, rotation: [0, 0, 0], tilt: [0.95, -0.5, 0.3], sway: 0.26 },
};

/** A GLB scene centred on its own bounds and scaled so its longest side is `size` units. */
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
        phys.userData.owned = true; // ours to dispose; the rest belong to the GLTF cache
        mesh.material = phys;
      }
    });
    const holder = new THREE.Group();
    holder.add(obj);
    return holder;
  }, [scene, size]);
}

function Instrument({ verse }: { verse: Verse }) {
  const cfg = MODELS[verse];
  const model = useNormalized(cfg.url, cfg.size);
  const group = useRef<THREE.Group>(null);
  const lift = useRef(0);
  const size = useThree((s) => s.size);

  // scale so the instrument fills ~90% of the canvas's shorter side at any aspect
  const fit = useMemo(() => {
    const visH = 2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const visW = (visH * size.width) / Math.max(1, size.height);
    return (Math.min(visW, visH) * 0.9) / cfg.size;
  }, [size.width, size.height, cfg.size]);

  // dispose the materials we created (the GLTF cache keeps the shared ones)
  useEffect(() => {
    return () => {
      model.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = mesh.material as THREE.Material;
        if (mat.userData.owned) mat.dispose();
      });
    };
  }, [model]);

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const e = verseState.enter;
    const m = verseState.mouse;
    lift.current += ((verseState.hovered ? 1 : 0) - lift.current) * Math.min(1, dt * 5);
    const [tx, ty, tz] = cfg.tilt;
    // rises in from below, turns in from the side, then floats, sways and leans toward the pointer
    g.position.set(Math.sin(t * 0.21) * 0.04, Math.sin(t * 0.6) * 0.06 + lift.current * 0.1 - (1 - e) * 1.8, 0);
    g.rotation.set(
      tx + Math.sin(t * 0.37) * 0.03 - m.y * 0.1,
      ty + Math.sin(t * 0.18) * cfg.sway + m.x * 0.2 + (1 - e) * 1.6 + lift.current * 0.1,
      tz + Math.sin(t * 0.29) * 0.02,
    );
    g.scale.setScalar(fit * (0.55 + 0.45 * e) * (1 + lift.current * 0.04));
  });

  const over = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (verseState.hovered) return;
    verseState.hovered = true;
    unlockAudio();
    if (verse === "guitar") playRiff();
    else playChord();
  };
  const out = () => {
    verseState.hovered = false;
  };

  return (
    <group ref={group} onPointerOver={over} onPointerOut={out}>
      <group rotation={cfg.rotation}>
        <primitive object={model} />
      </group>
    </group>
  );
}

/** Pointer events come from the whole document; map them into the canvas's own rect. */
function Pointer() {
  const { gl, setEvents } = useThree();
  useEffect(() => {
    setEvents({
      compute: (event, state) => {
        const r = gl.domElement.getBoundingClientRect();
        state.pointer.set(((event.clientX - r.left) / r.width) * 2 - 1, -((event.clientY - r.top) / r.height) * 2 + 1);
        state.raycaster.setFromCamera(state.pointer, state.camera);
      },
    });
  }, [gl, setEvents]);
  return null;
}

function Rig() {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3());
  useFrame((_, dt) => {
    target.current.set(verseState.mouse.x * 0.2, verseState.mouse.y * 0.12, CAM_Z);
    camera.position.lerp(target.current, Math.min(1, dt * 2.5));
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function InstrumentWorld({ verse }: { verse: Verse }) {
  return (
    <Canvas
      className="absolute inset-0"
      style={{ pointerEvents: "none" }}
      dpr={[1, 2]}
      camera={{ fov: FOV, near: 0.1, far: 60, position: [0, 0, CAM_Z] }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
      eventSource={typeof document !== "undefined" ? document.body : undefined}
      eventPrefix="client"
    >
      <Rig />
      <Pointer />
      <Suspense fallback={null}>
        <Environment files="/world/studio_1k.hdr" environmentIntensity={0.5} />
        <Instrument verse={verse} />
      </Suspense>
      {/* warm key light from the upper left, a cool-ish fill, and a soft sky/ground fill */}
      <directionalLight position={[-6, 7, 5]} intensity={2.1} color="#ffe2bd" />
      <directionalLight position={[5, 2, 4]} intensity={0.45} color="#f3e7da" />
      <hemisphereLight args={["#fff7ec", "#d9c7b1", 0.55]} />
    </Canvas>
  );
}

useGLTF.preload("/models/guitar-red.glb");
useGLTF.preload("/models/casio.glb");
