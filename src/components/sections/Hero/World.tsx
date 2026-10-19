"use client";

// The hero's 3D layer, composited over the room photo: the guitar and the keyboard float above the
// photo's stone plinth and slowly circle it, casting a soft shadow onto it. The whole cluster is placed
// and scaled from where the plinth lands on screen, so it stays on the stone at any aspect.
// Hovering an instrument stops the orbit and lifts it; clicking it opens its verse.

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, events as createEvents, useFrame, useThree, type RootState } from "@react-three/fiber";
import { ContactShadows, Environment, Float, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { GUITAR_BODY, lacquer } from "@/lib/r3f/lacquer";
import PauseOffscreen from "@/lib/r3f/PauseOffscreen";
import Prewarm from "@/lib/r3f/Prewarm";
import { hero, plinthOnScreen, type Verse } from "./state";

/** the page's own controls (never a 3D target) */
const INTERACTIVE = "a, button, input, textarea, select, label, [role='button']";
/** a pointer event that really happened over the hero (not on its links or buttons): the canvas
 * listens on the whole page, so without this any click lined up with an instrument opened a verse */
function onHero(e: Event) {
  const t = e.target instanceof Element ? e.target : null;
  return !!t && !!t.closest(".hero") && !t.closest(INTERACTIVE);
}

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
      // pointer hits go to a simple box (see Model) — ray-testing ~150k vertices on every mouse move
      // was what made the hero stutter while the pointer moved over it
      mesh.raycast = () => {};
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat.map) mat.map.anisotropy = 8;
      mat.envMapIntensity = 0.9;
      // the guitar's body: an even gloss lacquer (see lib/r3f/lacquer)
      if (mat.name === GUITAR_BODY) mesh.material = lacquer(mat);
    });
    const holder = new THREE.Group();
    holder.add(obj);
    return { holder, dims: [dims.x * k, dims.y * k, dims.z * k] as [number, number, number] };
  }, [scene, size]);
}

function Model({ url, size, rotation }: { url: string; size: number; rotation: [number, number, number] }) {
  const { holder, dims } = useNormalized(url, size);
  return (
    <group rotation={rotation}>
      <primitive object={holder} />
      {/* invisible hit box: raycasts against 12 triangles instead of the whole model */}
      <mesh visible={false}>
        <boxGeometry args={dims} />
      </mesh>
    </group>
  );
}


const ANCHOR_LOCAL = new THREE.Vector3();

/** The pair circles the plinth on a slow ellipse; hovering either instrument brings it to rest. */
const ORBIT = { cx: 0.8, cz: 0, rx: 0.55, rz: 0.9, speed: 0.12 };
const orbit = { angle: 0, speed: ORBIT.speed, time: 0 };

/** Advances the shared orbit (eases to a stop while an instrument is hovered). Runs before the instruments. */
function Orbiter() {
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const target = hero.hover ? 0 : ORBIT.speed;
    orbit.speed += (target - orbit.speed) * Math.min(1, dt * 3);
    orbit.angle += orbit.speed * dt * hero.enter;
    // our own clock: R3F's resets whenever the canvas pauses off-screen, which made the pair jump
    orbit.time += dt;
  });
  return null;
}

function Instrument({
  kind,
  children,
  theta,
  height,
  sway,
  phase,
  tilt,
  anchor,
}: {
  kind: Verse;
  children: React.ReactNode;
  /** where on the orbit this instrument starts (radians) */
  theta: number;
  height: number;
  sway: number;
  phase: number;
  tilt: [number, number, number];
  /** local point the callout line points at */
  anchor: [number, number, number];
}) {
  const group = useRef<THREE.Group>(null);
  const lift = useRef(0);

  useFrame(({ camera, size }, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);
    const t = orbit.time;
    const e = hero.enter;
    const th = theta + orbit.angle;
    lift.current += ((hero.hover === kind ? 1 : 0) - lift.current) * Math.min(1, dt * 5);
    // rises off the plinth on entrance, then circles it with a slow float
    g.position.set(
      ORBIT.cx + Math.cos(th) * ORBIT.rx,
      height + Math.sin(t * 0.6 + phase) * 0.07 + lift.current * 0.12 - (1 - e) * 1.2,
      ORBIT.cz + Math.sin(th) * ORBIT.rz,
    );
    g.rotation.set(
      tilt[0] + Math.sin(t * 0.37 + phase) * 0.04,
      tilt[1] + Math.sin(t * 0.16 + phase) * sway + Math.sin(th) * 0.22 + (1 - e) * 1.4 + lift.current * 0.12,
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

  const over = (ev: { stopPropagation: () => void; nativeEvent: Event }) => {
    ev.stopPropagation();
    if (!onHero(ev.nativeEvent)) return;
    if (hero.hover === kind) return;
    hero.hover = kind;
    document.body.style.cursor = "pointer";
  };
  const out = () => {
    if (hero.hover === kind) hero.hover = null;
    document.body.style.cursor = "";
  };

  return (
    <group ref={group} onPointerOver={over} onPointerOut={out} onClick={(ev) => onHero(ev.nativeEvent) && hero.navigate(kind)}>
      {children}
    </group>
  );
}

function Rings() {
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  const root = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = orbit.time;
    if (a.current) a.current.rotation.set(1.2 + Math.sin(t * 0.2) * 0.06, 0.35, t * 0.04);
    if (b.current) b.current.rotation.set(1.42 + Math.cos(t * 0.17) * 0.06, -0.3, -t * 0.03);
    root.current?.scale.setScalar(Math.max(0.001, hero.enter));
  });
  return (
    <group ref={root} position={[0.55, 1.75, 0]}>
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

/** dev only: expose the renderer + scene for profiling from the console */
function DebugHandle() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    if (process.env.NODE_ENV === "development") (window as unknown as { __heroGL: unknown }).__heroGL = { gl, scene };
  }, [gl, scene]);
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
  const place = useOnPlinth();
  return (
    <>
      <Rig />
      <Pointer />
      <PauseOffscreen name="hero" />
      <DebugHandle />
      <Orbiter />
      <group position={place.position} scale={place.scale}>
        <Suspense fallback={null}>
          <Environment files="/world/studio_1k.hdr" environmentIntensity={0.5} />
          <Instrument
            kind="guitar"
            theta={2.6}
            height={1.95}
            sway={0.3}
            phase={0}
            tilt={[0, 0, 0.62]}
            anchor={[0.75, 0.05, 0]}
          >
            <Model url="/models/guitar-red.glb" size={3.0} rotation={[-Math.PI / 2, 0, Math.PI]} />
          </Instrument>
          <Instrument
            kind="keyboard"
            theta={2.6 + Math.PI}
            height={1.0}
            sway={0.16}
            phase={2.1}
            tilt={[0.75, -0.35, 0.38]}
            anchor={[1.0, 0.1, 0]}
          >
            <Model url="/models/casio.glb" size={2.5} rotation={[0, 0, 0]} />
          </Instrument>
          {/* soft shadow on the stone; follows the pair round the orbit and fades as they rise */}
          <ContactShadows position={[0.3, 0.01, 0]} scale={[4.2, 2.4]} opacity={0.5} blur={2.6} far={3.5} resolution={256} color="#4a3626" />
          <Prewarm name="hero" />
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

/**
 * The instruments listen to pointer events on the whole page (so the hero copy layered over the
 * canvas doesn't block them), which means every click anywhere reaches this scene: one that
 * happened to line up with the keyboard opened the Piano Verse from the disc section, or from the
 * Support page while Next kept the home page alive for Back. Only pointers over the hero itself
 * (and not on its links or buttons) count, measured against the canvas where it actually is.
 */
function compute(event: PointerEvent | MouseEvent, state: RootState) {
  const el = state.gl.domElement;
  const ok = onHero(event) && el.isConnected;
  if (!ok) {
    state.pointer.set(10, 10); // off the scene: nothing is hit
  } else {
    const r = el.getBoundingClientRect();
    state.pointer.set(((event.clientX - r.left) / r.width) * 2 - 1, -((event.clientY - r.top) / r.height) * 2 + 1);
  }
  state.raycaster.setFromCamera(state.pointer, state.camera);
}
/** R3F's pointer events with that compute. (No `eventPrefix` on the Canvas: it installs its own
 * compute when the canvas is created, replacing this one.) */
const heroEvents: typeof createEvents = (store) => ({ ...createEvents(store), compute });

export default function World() {
  return (
    <Canvas
      className="absolute inset-0"
      style={{ pointerEvents: "none" }}
      dpr={[1, 1.5]}
      camera={{ fov: FOV, near: 0.1, far: 60, position: [0, 0, CAM_Z] }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
      eventSource={typeof document !== "undefined" ? document.body : undefined}
      events={heroEvents}
    >
      <Scene />
    </Canvas>
  );
}

useGLTF.preload("/models/guitar-red.glb");
useGLTF.preload("/models/casio.glb");
