"use client";

// The hero's 3D layer, composited over the room photo: a real acoustic guitar and a keyboard float
// above the photo's stone plinth, sway slowly, and cast a soft shadow onto it. The whole cluster is
// placed and scaled from where the plinth lands on screen, so it stays on the stone at any aspect.
// Hovering an instrument plays it, clicking it opens its verse.

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Float, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { playChord, playRiff, unlockAudio } from "../Session/audio";
import { hero, plinthOnScreen, type Verse } from "./state";

const RED = "#850909";
const TAN = "#e7b47e";
const FOV = 30;
const CAM_Z = 9;
/** the plinth's width in the cluster's own units — everything below is laid out against it */
const PLINTH_UNITS = 3.2;

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
      mesh.castShadow = true;
      mesh.receiveShadow = true;
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

function Model({ url, size, rotation }: { url: string; size: number; rotation: [number, number, number] }) {
  const model = useNormalized(url, size);
  return (
    <group rotation={rotation}>
      <primitive object={model} />
    </group>
  );
}

function Rock({ position, scale, speed = 1 }: { position: [number, number, number]; scale: number; speed?: number }) {
  const model = useNormalized("/world/moon_rock_04/moon_rock_04_1k.gltf", 1);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime * speed;
    g.position.y = position[1] + Math.sin(t * 0.7) * 0.08 + (1 - hero.enter) * -0.6;
    g.rotation.set(Math.sin(t * 0.3) * 0.2, t * 0.15, 0);
    g.scale.setScalar(scale * hero.enter);
  });
  return (
    <group ref={ref} position={position}>
      <primitive object={model} />
    </group>
  );
}

const ANCHOR_LOCAL = new THREE.Vector3();

function Instrument({
  kind,
  children,
  position,
  sway,
  phase,
  tilt,
  anchor,
  hover,
  setHover,
}: {
  kind: Verse;
  children: React.ReactNode;
  position: [number, number, number];
  sway: number;
  phase: number;
  tilt: [number, number, number];
  /** local point the callout line points at */
  anchor: [number, number, number];
  hover: Verse | null;
  setHover: (h: Verse | null) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const lift = useRef(0);
  const hovered = hover === kind;

  useFrame(({ clock, camera, size }, dt) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const e = hero.enter;
    lift.current += ((hovered ? 1 : 0) - lift.current) * Math.min(1, dt * 5);
    // rises off the plinth on entrance, then floats and sways
    g.position.set(
      position[0] + Math.sin(t * 0.21 + phase) * 0.06,
      position[1] + Math.sin(t * 0.6 + phase) * 0.07 + lift.current * 0.12 - (1 - e) * 1.2,
      position[2],
    );
    g.rotation.set(
      tilt[0] + Math.sin(t * 0.37 + phase) * 0.04,
      tilt[1] + Math.sin(t * 0.16 + phase) * sway + (1 - e) * 1.4 + lift.current * 0.12,
      tilt[2] + Math.sin(t * 0.29 + phase) * 0.03,
    );
    g.scale.setScalar((0.55 + 0.45 * e) * (1 + lift.current * 0.04));
    // where the callout line should end, in canvas pixels
    ANCHOR_LOCAL.set(...anchor);
    g.localToWorld(ANCHOR_LOCAL).project(camera);
    const a = hero.anchors[kind];
    a.x = (ANCHOR_LOCAL.x * 0.5 + 0.5) * size.width;
    a.y = (-ANCHOR_LOCAL.y * 0.5 + 0.5) * size.height;
    a.on = e > 0.6;
  });

  const over = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (hover === kind) return;
    setHover(kind);
    hero.hover = kind;
    document.body.style.cursor = "pointer";
    unlockAudio();
    if (kind === "guitar") playRiff();
    else playChord();
  };
  const out = () => {
    setHover(null);
    hero.hover = null;
    document.body.style.cursor = "";
  };

  return (
    <group ref={group} onPointerOver={over} onPointerOut={out} onClick={() => hero.navigate(kind)}>
      {children}
    </group>
  );
}

function Rings() {
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (a.current) a.current.rotation.set(1.2 + Math.sin(t * 0.2) * 0.06, 0.35, t * 0.04);
    if (b.current) b.current.rotation.set(1.42 + Math.cos(t * 0.17) * 0.06, -0.3, -t * 0.03);
    root.current?.scale.setScalar(Math.max(0.001, hero.enter));
  });
  return (
    <group ref={root} position={[-0.2, 1.9, 0]}>
      <mesh ref={a}>
        <torusGeometry args={[1.75, 0.0045, 6, 200]} />
        <meshBasicMaterial color={RED} transparent opacity={0.4} />
      </mesh>
      <mesh ref={b}>
        <torusGeometry args={[1.35, 0.004, 6, 200]} />
        <meshBasicMaterial color={RED} transparent opacity={0.3} />
      </mesh>
      {[
        [-1.62, -0.45, 0.4],
        [1.55, 1.1, -0.2],
      ].map((p, i) => (
        <Float key={i} speed={1.6} floatIntensity={0.5}>
          <mesh position={p as [number, number, number]}>
            <sphereGeometry args={[0.055, 24, 24]} />
            <meshStandardMaterial color={TAN} roughness={0.35} metalness={0.2} />
          </mesh>
        </Float>
      ))}
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
    // a small camera truck with the pointer — the photo moves the other way (see Hero.tsx)
    target.current.set(hero.mouse.x * 0.25, hero.mouse.y * 0.15, CAM_Z);
    camera.position.lerp(target.current, Math.min(1, dt * 2.5));
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/** Puts the cluster's origin on the plinth's top-centre and scales it to the plinth's width. */
function useOnPlinth() {
  const { size } = useThree();
  return useMemo(() => {
    const p = plinthOnScreen(size.width, size.height);
    const perPx = (2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2))) / size.height;
    // phones: the plinth is cropped wide, so pull the pair in and left to keep the keyboard in frame
    const narrow = size.width < 640;
    const scale = ((p.w * perPx) / PLINTH_UNITS) * (narrow ? 0.82 : 1);
    return {
      position: [(p.x - size.width / 2) * perPx - (narrow ? 0.55 * scale : 0), -(p.y - size.height / 2) * perPx, 0] as [number, number, number],
      scale,
    };
  }, [size.width, size.height]);
}

function Scene() {
  const [hover, setHover] = useState<Verse | null>(null);
  const place = useOnPlinth();
  return (
    <>
      <Rig />
      <Pointer />
      <group position={place.position} scale={place.scale}>
        <Suspense fallback={null}>
          <Environment files="/world/studio_1k.hdr" environmentIntensity={0.5} />
          <Instrument
            kind="guitar"
            position={[0.3, 1.95, 0.3]}
            sway={0.4}
            phase={0}
            tilt={[0, 0, 0.62]}
            anchor={[0.75, 0.05, 0]}
            hover={hover}
            setHover={setHover}
          >
            <Model url="/models/guitar-red.glb" size={3.0} rotation={[-Math.PI / 2, 0, Math.PI]} />
          </Instrument>
          <Instrument
            kind="keyboard"
            position={[1.35, 1.0, -0.3]}
            sway={0.2}
            phase={2.1}
            tilt={[0.75, -0.35, 0.38]}
            anchor={[1.0, 0.1, 0]}
            hover={hover}
            setHover={setHover}
          >
            <Model url="/models/casio.glb" size={2.5} rotation={[0, 0, 0]} />
          </Instrument>
          <Rock position={[-1.75, 0.9, 0.8]} scale={0.32} />
          <Rock position={[-1.05, 0.45, 1.2]} scale={0.14} speed={1.3} />
          <Rock position={[1.9, 0.35, 0.6]} scale={0.2} speed={0.8} />
          <Rock position={[0.7, 0.55, 1.1]} scale={0.12} speed={1.1} />
          {/* soft shadow on the stone; fades as things rise */}
          <ContactShadows position={[0, 0.01, 0]} scale={[3.6, 1.6]} opacity={0.5} blur={2.6} far={3.5} resolution={512} color="#4a3626" />
        </Suspense>
        <Rings />
      </group>
      {/* sunlight from the upper left, like the light streaks on the wall */}
      <directionalLight position={[-6, 7, 5]} intensity={2.1} color="#ffe2bd" />
      <directionalLight position={[5, 2, 4]} intensity={0.45} color="#f3e7da" />
      <hemisphereLight args={["#fff7ec", "#d9c7b1", 0.55]} />
    </>
  );
}

export default function World() {
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
      <Scene />
    </Canvas>
  );
}

useGLTF.preload("/models/guitar-red.glb");
useGLTF.preload("/models/casio.glb");
useGLTF.preload("/world/moon_rock_04/moon_rock_04_1k.gltf");
