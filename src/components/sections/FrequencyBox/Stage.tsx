"use client";

// The Frequency Box, photographed. One scrubbed value (fbox.progress, 0–1 through the pinned
// section) drives everything, as pure keyframes, so it plays the same in either direction.
// The box is the client's: a rigid mailer standing upright, 15 wide × 10 tall × 5 deep, sand board
// with gold-foil ink, on the floor of a warm studio sweep (the floor curves up into the wall, as a
// cyclorama does, so there is no horizon). One big soft key from the upper right throws the
// shadow left, as in the reference; a large softbox fills from above.
//
//   0.00–0.13  macro: the gold hairline and waveform on the front, the camera drifting across
//              the lockup — paper grain and foil in focus, everything else soft
//   0.13–0.30  the camera pulls back and rises; the whole box, turned three-quarter
//   0.30–0.56  it moves round to the right side and scans down the four pillars (callouts land)
//   0.56–0.86  back round to the front, wider; the headline arrives
//   0.86–1.00  the showcase holds: box on the right (centred on phones), words on the left
//
// The box never opens. A drag turns it on top of the film; the edition switches its print.

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, RoundedBox, SoftShadows } from "@react-three/drei";
import { Bloom, DepthOfField, EffectComposer, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode, type DepthOfFieldEffect } from "postprocessing";
import * as THREE from "three";
import { gsap } from "@/lib/gsap";
import Prewarm from "@/lib/r3f/Prewarm";
import { easeInOut, fbox, kf } from "./state";
import { makePaperTexture, makePrintTextures, type Edition, type PrintTextures } from "./textures";

// ---------------------------------------------------------------------------------------------
// the box: 15 × 10 × 5 in, standing: 3 wide, 2 high, 1 deep, on the floor
// ---------------------------------------------------------------------------------------------
const W = 3;
const H = 2;
const D = 1;
const FLOOR_Y = -H / 2;
const BOARD = "#ecdcc2";
const SEAM = "#cdb998";
const RADIUS = 0.022;
const PRINT_W = W * 0.9;
const PRINT_H = H * 0.9;
const SIDE_W = D * 0.84;
const SIDE_H = H * 0.9;
const TOP_W = W * 0.5;
const TOP_H = D * 0.5;
const RATIOS = { front: PRINT_H / PRINT_W, side: SIDE_H / SIDE_W, top: TOP_H / TOP_W };
const LIFT = 0.0035;

const FOV = 26;
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const TWO_PI = Math.PI * 2;

/** where the camera looks; the depth of field focuses here */
const LOOK = new THREE.Vector3();

/** Renders only while the canvas is on screen: a ticker invalidates the demand frameloop. */
function Driver() {
  const { gl, invalidate } = useThree();
  useEffect(() => {
    let on = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        on = entry.isIntersecting;
        if (on) invalidate();
      },
      { rootMargin: "-2px" },
    );
    io.observe(gl.domElement);
    const tick = () => {
      if (on) invalidate();
    };
    gsap.ticker.add(tick);
    return () => {
      io.disconnect();
      gsap.ticker.remove(tick);
    };
  }, [gl, invalidate]);
  return null;
}

type V3 = readonly [number, number, number];
/** a point along keyframes of points */
function kf3(p: number, keys: readonly (readonly [number, V3])[], out: THREE.Vector3) {
  out.set(
    kf(p, keys.map(([t, v]) => [t, v[0]] as const), easeInOut),
    kf(p, keys.map(([t, v]) => [t, v[1]] as const), easeInOut),
    kf(p, keys.map(([t, v]) => [t, v[2]] as const), easeInOut),
  );
  return out;
}

// the camera's path (desktop); the phone keeps the box centred at the end
const CAM: readonly (readonly [number, V3])[] = [
  [0.0, [0.85, -0.42, 1.95]],
  [0.13, [-0.55, -0.08, 2.05]],
  [0.3, [3.6, 1.1, 7.6]],
  [0.42, [3.3, 0.55, 1.45]],
  [0.56, [3.2, -0.4, 1.3]],
  [0.72, [2.8, 1.2, 8.6]],
  [0.86, [1.2, 0.8, 9.2]],
];
const AIM: readonly (readonly [number, V3])[] = [
  [0.0, [0.15, -0.5, 0.5]],
  [0.13, [-0.1, -0.18, 0.5]],
  [0.3, [0.1, -0.05, 0]],
  [0.42, [1.15, 0.45, 0.62]],
  [0.56, [1.15, -0.45, 0.62]],
  [0.72, [0.3, -0.1, 0]],
  [0.86, [-1.15, -0.15, 0]],
];
const CAM_PHONE: readonly (readonly [number, V3])[] = [...CAM.slice(0, 6), [0.86, [1.0, 1.4, 14]]];
const AIM_PHONE: readonly (readonly [number, V3])[] = [...AIM.slice(0, 6), [0.86, [0, 0.6, 0]]];

/** The camera: macro on the front, a pull back, round to the side, back to a wide three-quarter. */
function Rig({ phone }: { phone: boolean }) {
  const { camera, size } = useThree();
  useFrame(() => {
    const p = fbox.progress;
    const pos = kf3(p, phone ? CAM_PHONE : CAM, camera.position);
    kf3(p, phone ? AIM_PHONE : AIM, LOOK);
    // the wide shots must fit the box (3 wide) on narrow screens: push the camera back there
    const aspect = size.width / size.height;
    const minZ = (W * 0.62) / (TAN * aspect);
    const wide = kf(p, [[0.13, 0], [0.3, 1], [0.42, 0], [0.56, 0], [0.72, 1]], easeInOut);
    if (wide > 0 && pos.z < minZ) pos.setZ(THREE.MathUtils.lerp(pos.z, minZ, wide));
    camera.lookAt(LOOK);
  });
  return null;
}

/** The studio sweep: a floor that curves up into the wall, one piece, so there is no horizon. Wide and deep, so no shot sees past its edge. */
function sweepGeometry() {
  const R = 4;
  const cz = -6;
  const cy = FLOOR_Y + R;
  const prof: [number, number][] = [
    [80, FLOOR_Y],
    [cz, FLOOR_Y],
  ];
  for (let i = 1; i <= 14; i++) {
    const a = (i / 14) * (Math.PI / 2);
    prof.push([cz - Math.sin(a) * R, cy - Math.cos(a) * R]);
  }
  prof.push([cz - R, 120]);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  prof.forEach(([z, y], i) => {
    pos.push(-300, y, z, 300, y, z);
    const v = i / (prof.length - 1);
    uv.push(0, v, 1, v);
  });
  for (let i = 0; i < prof.length - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function Sweep() {
  const geo = useMemo(() => sweepGeometry(), []);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial color="#d6bf9f" roughness={0.96} metalness={0} envMapIntensity={0.55} />
    </mesh>
  );
}

/* the foil: a metal that takes the studio's reflections; the artwork doubles as a bump map so its edges catch the light */
const foilMat = { transparent: true, alphaTest: 0.08, metalness: 0.92, roughness: 0.3, envMapIntensity: 1.6, bumpScale: 0.6, polygonOffset: true, polygonOffsetFactor: -2 } as const;

function Print({ textures }: { textures: PrintTextures }) {
  return (
    <>
      <mesh position={[0, 0, D / 2 + LIFT * 2.5]}>
        <planeGeometry args={[PRINT_W, PRINT_H]} />
        <meshPhysicalMaterial map={textures.front} bumpMap={textures.front} color="#fff3dc" {...foilMat} />
      </mesh>
      <mesh position={[W / 2 + LIFT, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[SIDE_W, SIDE_H]} />
        <meshPhysicalMaterial map={textures.side} bumpMap={textures.side} color="#fff3dc" {...foilMat} />
      </mesh>
      <mesh position={[-W / 2 - LIFT, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[SIDE_W, SIDE_H]} />
        <meshPhysicalMaterial map={textures.side} bumpMap={textures.side} color="#fff3dc" {...foilMat} />
      </mesh>
      <mesh position={[0, H / 2 + LIFT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TOP_W, TOP_H]} />
        <meshPhysicalMaterial map={textures.top} bumpMap={textures.top} color="#fff3dc" {...foilMat} />
      </mesh>
    </>
  );
}

function Box({ edition }: { edition: Edition }) {
  const box = useRef<THREE.Group>(null);
  const [textures, setTextures] = useState<PrintTextures | null>(null);
  const paper = useMemo(() => makePaperTexture(), []);
  useEffect(() => () => paper.dispose(), [paper]);

  // paint the print for this edition; repaint (and swap) when it changes, dispose the old one
  useEffect(() => {
    let live = true;
    let made: PrintTextures | null = null;
    makePrintTextures(RATIOS, edition).then((t) => {
      if (!live) {
        t.dispose();
        return;
      }
      made = t;
      setTextures(t);
    });
    return () => {
      live = false;
      const old = made;
      if (old) window.setTimeout(() => old.dispose(), 1500);
    };
  }, [edition]);

  useFrame(({ clock }, delta) => {
    const b = box.current;
    if (!b) return;
    const s = fbox;
    const p = s.progress;
    const dt = Math.min(delta, 0.05);
    const t = clock.elapsedTime;

    // a drag turns the box on top of the film; inertia after release
    if (!s.dragging) {
      s.spin += s.vel * dt;
      s.vel *= Math.exp(-dt * 2.4);
      if (Math.abs(s.vel) < 0.002) s.vel = 0;
      // once the throw has died down, the box comes back round to its place
      if (Math.abs(s.vel) < 1.2) {
        const home = Math.round(s.spin / TWO_PI) * TWO_PI;
        s.spin += (home - s.spin) * Math.min(1, dt * 1.6);
      }
    }
    s.tilt += (s.tiltTarget - s.tilt) * Math.min(1, dt * (s.dragging ? 10 : 4));

    // the turn: near-frontal under the macro, three-quarter for the wide, side-on for the pillars
    const yaw = kf(p, [[0, 0.04], [0.13, -0.06], [0.3, -0.45], [0.42, -0.35], [0.56, -0.35], [0.72, -0.5], [0.86, -0.48]], easeInOut);
    const idle = s.still ? 0 : Math.sin(t * 0.3) * 0.004;
    b.rotation.set(s.tilt * 0.6, yaw + s.spin + idle, 0);
  });

  const board = (
    <meshPhysicalMaterial color={BOARD} roughness={0.88} metalness={0} bumpMap={paper} bumpScale={0.012} sheen={0.25} sheenRoughness={0.85} sheenColor="#ffffff" envMapIntensity={0.7} />
  );

  return (
    <group ref={box}>
      {/* the board */}
      <RoundedBox args={[W, H, D]} radius={RADIUS} smoothness={4} castShadow receiveShadow>
        {board}
      </RoundedBox>
      {/* the lid panel: the mailer's front is its lid, a hair proud of the body, so its edge catches the light */}
      <mesh position={[0, 0, D / 2 + LIFT]} receiveShadow>
        <planeGeometry args={[W - 0.03, H - 0.03]} />
        {board}
      </mesh>
      {/* the seams: where the lid wraps the right side, and the fold on the left of the front */}
      <mesh position={[W / 2 + LIFT * 0.6, 0, D / 2 - 0.09]}>
        <boxGeometry args={[LIFT, H - 0.05, 0.006]} />
        <meshStandardMaterial color={SEAM} roughness={0.9} />
      </mesh>
      <mesh position={[-W / 2 + 0.085, 0, D / 2 + LIFT * 1.5]}>
        <boxGeometry args={[0.004, H - 0.04, LIFT]} />
        <meshStandardMaterial color={SEAM} roughness={0.9} />
      </mesh>
      {textures && <Print textures={textures} />}
    </group>
  );
}

/** The lights: a big soft key from the upper right (the shadow falls left), a cool fill from the left. */
function Lights() {
  const target = useMemo(() => {
    const t = new THREE.Object3D();
    t.position.set(0, -0.2, 0);
    return t;
  }, []);
  return (
    <>
      <primitive object={target} />
      <spotLight position={[5.5, 7, 5]} target={target} angle={0.5} penumbra={1} intensity={120} decay={1.7} distance={0} color="#fff2e0" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.00015} shadow-normalBias={0.02} shadow-radius={4} />
      <directionalLight position={[-6, 3, 5]} intensity={0.4} color="#e8eefc" />
      <ambientLight intensity={0.08} color="#fff4e6" />
    </>
  );
}

/** The grade: the focus follows the camera's aim (tight under the macro, open on the wide), a touch of bloom on the foil, grain. */
function Grade() {
  const dof = useRef<DepthOfFieldEffect>(null);
  useFrame(() => {
    const e = dof.current;
    if (!e) return;
    const p = fbox.progress;
    if (e.target) e.target.copy(LOOK);
    e.cocMaterial.worldFocusRange = kf(p, [[0.13, 0.55], [0.3, 5], [0.42, 0.7], [0.56, 0.7], [0.72, 6], [0.86, 8]], easeInOut);
    e.bokehScale = kf(p, [[0.13, 3.2], [0.3, 1.6], [0.42, 3], [0.56, 3], [0.72, 1.4]], easeInOut);
  });
  return (
    <EffectComposer multisampling={4} frameBufferType={THREE.HalfFloatType}>
      <DepthOfField ref={dof} target={[0, 0, 0]} worldFocusRange={0.55} bokehScale={3.2} />
      <Bloom intensity={0.32} luminanceThreshold={0.9} luminanceSmoothing={0.25} mipmapBlur radius={0.5} />
      <Vignette eskil={false} offset={0.3} darkness={0.42} />
      <Noise opacity={0.05} blendFunction={BlendFunction.OVERLAY} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  );
}

function Scene({ edition, phone }: { edition: Edition; phone: boolean }) {
  return (
    <>
      <color attach="background" args={["#d6bf9f"]} />
      <Driver />
      <Rig phone={phone} />
      <SoftShadows size={14} samples={12} focus={0.4} />
      <Suspense fallback={null}>
        {/* a bright studio: a large softbox overhead, a wide fill from the front, a warm panel right */}
        <Environment resolution={256} frames={1}>
          <color attach="background" args={["#8f7d66"]} />
          <Lightformer form="rect" intensity={1.8} color="#fff7ec" position={[0, 9, 2]} rotation={[-Math.PI / 2, 0, 0]} scale={[14, 10, 1]} />
          <Lightformer form="rect" intensity={0.6} color="#ffffff" position={[-4, 2, 12]} scale={[10, 6, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={1.2} color="#ffe6c4" position={[9, 3, 3]} scale={[2, 8, 1]} target={[0, 0, 0]} />
        </Environment>
        <Prewarm name="fbox" />
      </Suspense>
      <Sweep />
      <ContactShadows position={[0, FLOOR_Y + 0.002, 0]} scale={[7, 4]} opacity={0.5} blur={1.8} far={1.4} resolution={512} color="#4a3a28" />
      <Box edition={edition} />
      <Lights />
      <Grade />
    </>
  );
}

const clamp = THREE.MathUtils.clamp;

export default function Stage({ edition, phone }: { edition: Edition; phone: boolean }) {
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const s = fbox;
    s.dragging = true;
    s.vel = 0;
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    s.lastT = performance.now();
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = fbox;
    if (!s.dragging) return;
    const now = performance.now();
    const dx = e.clientX - s.lastX;
    const dy = e.clientY - s.lastY;
    const secs = Math.max(0.004, (now - s.lastT) / 1000);
    const k = 0.011;
    s.spin += dx * k;
    s.vel = clamp(s.vel * 0.4 + ((dx * k) / secs) * 0.6, -14, 14);
    s.tiltTarget = clamp(s.tiltTarget + dy * 0.004, -0.5, 0.5);
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    s.lastT = now;
  };
  const up = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = fbox;
    if (!s.dragging) return;
    s.dragging = false;
    s.tiltTarget = 0;
    if (performance.now() - s.lastT > 80) s.vel = 0;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div
      className="fbox-canvas absolute inset-0 cursor-grab active:cursor-grabbing"
      data-cursor="Drag"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
    >
      <Canvas
        dpr={[1, 1.5]}
        frameloop="demand"
        shadows="soft"
        camera={{ fov: FOV, near: 0.05, far: 80, position: [0.85, -0.42, 1.95] }}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping }}
        style={{ touchAction: "pan-y" }}
      >
        <Scene edition={edition} phone={phone} />
      </Canvas>
    </div>
  );
}
