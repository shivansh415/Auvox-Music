"use client";

// The Frequency Box in 3D, after the client's reference box (shown closed: it stays a surprise): a wide,
// low sand-coloured box under a thin taupe lid, its print painted at runtime onto transparent planes:
// the brown AUVOX MUSIC lockup with "FORGED IN FREQUENCY" and a waveform hairline on the front, the
// edition on the side, the logomark tone on tone on the lid. It floats, turns on its own, picks up
// rotation from the page scroll, and can be dragged with inertia. A new edition turns it once.

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { gsap } from "@/lib/gsap";
import Prewarm from "@/lib/r3f/Prewarm";
import { fbox } from "./state";
import { makePrintTextures, type Edition, type PrintTextures } from "./textures";

// 15 × 10 × 5 in, lying flat: 3 wide, 1 high, 2 deep
const W = 3;
const H = 1;
const D = 2;
/** colours sampled from the reference */
const SAND = "#bcb19f";
const LID = "#948c7e";
const SEAM = "#8a7f6e";
const RADIUS = 0.03;

// the lid: a thin panel over the whole top, a hair wider than the box
const LID_T = 0.07;
const LID_Y = H / 2 + LID_T / 2 - 0.012;
const OVER = 0.012;

// printed areas, inset from the edges
const INSET = 0.1;
const FRONT_W = W - INSET * 2;
const FRONT_H = H - INSET * 2;
const SIDE_W = D - INSET * 2;
const SIDE_H = H - INSET * 2;
const TOP_W = W * 0.6;
const TOP_H = D * 0.6;
const RATIOS = { front: FRONT_H / FRONT_W, side: SIDE_H / SIDE_W, top: TOP_H / TOP_W };
/** lifts the print off the card so it never z-fights */
const LIFT = 0.003;

const FOV = 26;
const CAM = new THREE.Vector3(0, 2.6, 9.2);
const LOOK = new THREE.Vector3(0, -0.1, 0);
const REST_Y = -0.5;
const REST_X = 0.04;
const TWO_PI = Math.PI * 2;

/** Renders only while the canvas is on screen: a ticker invalidates the demand frameloop. */
function Driver() {
  const { gl, invalidate, camera } = useThree();
  useEffect(() => {
    camera.lookAt(LOOK);
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
  }, [gl, invalidate, camera]);
  return null;
}

/** Scale so the box sits comfortably in the canvas at any aspect (narrow phones included). */
function useFit() {
  const { size } = useThree();
  return useMemo(() => {
    const dist = CAM.distanceTo(LOOK);
    const visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const visW = visH * (size.width / size.height);
    return Math.min((visW * 0.82) / 3.7, (visH * 0.62) / 2.3);
  }, [size.width, size.height]);
}

const printMat = { transparent: true, metalness: 0, roughness: 0.85, envMapIntensity: 0.5, polygonOffset: true, polygonOffsetFactor: -2 } as const;

function Print({ textures }: { textures: PrintTextures }) {
  return (
    <>
      <mesh position={[0, 0, D / 2 + LIFT]}>
        <planeGeometry args={[FRONT_W, FRONT_H]} />
        <meshStandardMaterial map={textures.front} {...printMat} />
      </mesh>
      <mesh position={[W / 2 + LIFT, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[SIDE_W, SIDE_H]} />
        <meshStandardMaterial map={textures.side} {...printMat} />
      </mesh>
      <mesh position={[-W / 2 - LIFT, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[SIDE_W, SIDE_H]} />
        <meshStandardMaterial map={textures.side} {...printMat} />
      </mesh>
      <mesh position={[0, LID_Y + LID_T / 2 + LIFT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TOP_W, TOP_H]} />
        <meshStandardMaterial map={textures.top} {...printMat} />
      </mesh>
    </>
  );
}

function Box({ edition }: { edition: Edition }) {
  const rig = useRef<THREE.Group>(null);
  const box = useRef<THREE.Group>(null);
  const sweep = useRef<THREE.DirectionalLight>(null);
  const [textures, setTextures] = useState<PrintTextures | null>(null);

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
      // keep the old print on screen until the new one is ready, then let it go
      const old = made;
      if (old) window.setTimeout(() => old.dispose(), 1500);
    };
  }, [edition]);

  useFrame(({ clock }, delta) => {
    const g = rig.current;
    const b = box.current;
    if (!g || !b) return;
    const s = fbox;
    const dt = Math.min(delta, 0.05); // the demand loop can pause for a while off-screen
    const t = clock.elapsedTime;
    const e = s.enter;

    // idle spin fades out while the user is dragging and back in afterwards; inertia after release
    if (!s.dragging) {
      s.spin += s.vel * dt;
      s.vel *= Math.exp(-dt * 2.4);
      if (Math.abs(s.vel) < 0.002) s.vel = 0;
      s.idleGain += (1 - s.idleGain) * Math.min(1, dt * 1.5);
    } else {
      s.idleGain += (0 - s.idleGain) * Math.min(1, dt * 8);
    }
    s.idle += dt * s.idleSpeed * s.idleGain;
    s.tilt += (s.tiltTarget - s.tilt) * Math.min(1, dt * (s.dragging ? 10 : 4));

    b.rotation.set(
      REST_X + s.tilt + Math.sin(t * 0.5) * 0.03,
      REST_Y + s.idle + s.spin + s.scroll * Math.PI * 0.8 + (1 - e) * TWO_PI * s.turnIn,
      Math.sin(t * 0.37) * 0.015,
    );
    // floats; rises from below on entrance
    g.position.y = Math.sin(t * 0.8) * 0.05 + (1 - e) * -2.6;
    g.scale.setScalar(Math.max(0.001, 0.55 + 0.45 * e));

    // a warm light crossing the foil as the box lands
    const l = sweep.current;
    if (l) {
      const u = THREE.MathUtils.clamp(s.sweep, 0, 1);
      l.position.set(THREE.MathUtils.lerp(-8, 8, u), 4.5, 5);
      l.intensity = Math.sin(u * Math.PI) * 3.4;
    }
  });

  return (
    <group ref={rig}>
      <directionalLight ref={sweep} intensity={0} color="#fff1dc" />
      <group ref={box}>
        <RoundedBox args={[W, H, D]} radius={RADIUS} smoothness={4}>
          <meshStandardMaterial color={SAND} roughness={0.82} metalness={0} envMapIntensity={0.55} />
        </RoundedBox>
        <RoundedBox args={[W + OVER * 2, LID_T, D + OVER * 2]} radius={RADIUS} smoothness={4} position={[0, LID_Y, 0]}>
          <meshStandardMaterial color={LID} roughness={0.75} metalness={0} envMapIntensity={0.55} />
        </RoundedBox>
        {/* the seam: a hair of shadow where the lid meets the box */}
        <mesh position={[0, H / 2 - 0.016, 0]}>
          <boxGeometry args={[W + 0.004, 0.012, D + 0.004]} />
          <meshStandardMaterial color={SEAM} roughness={0.9} />
        </mesh>
        {textures && <Print textures={textures} />}
      </group>
    </group>
  );
}

function Scene({ edition }: { edition: Edition }) {
  const fit = useFit();
  return (
    <>
      <Driver />
      <group scale={fit}>
        <Suspense fallback={null}>
          <Environment files="/world/studio_1k.hdr" environmentIntensity={0.35} />
          <ContactShadows position={[0, -H / 2 - 0.32, 0]} scale={[5.5, 3.6]} opacity={0.38} blur={2.6} far={2.4} resolution={512} color="#4a3b2c" />
          <Prewarm name="fbox" />
        </Suspense>
        <Box edition={edition} />
      </group>
      {/* warm key from the upper left, a soft fill from the right, sky/ground fill */}
      <directionalLight position={[-6, 7, 5]} intensity={2.0} color="#ffe2bd" />
      <directionalLight position={[5, 2, 4]} intensity={0.5} color="#f3e7da" />
      <hemisphereLight args={["#fff7ec", "#d9c7b1", 0.55]} />
    </>
  );
}

const clamp = THREE.MathUtils.clamp;

export default function Stage({ edition }: { edition: Edition }) {
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
    const k = 0.011; // radians per pixel
    s.spin += dx * k;
    s.vel = clamp(s.vel * 0.4 + ((dx * k) / secs) * 0.6, -14, 14);
    s.tiltTarget = clamp(s.tiltTarget + dy * 0.004, -0.6, 0.6);
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    s.lastT = now;
  };
  const up = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = fbox;
    if (!s.dragging) return;
    s.dragging = false;
    s.tiltTarget = 0;
    // a still pointer at release means no throw
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
        camera={{ fov: FOV, near: 0.1, far: 40, position: [CAM.x, CAM.y, CAM.z] }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
        style={{ touchAction: "pan-y" }}
      >
        <Scene edition={edition} />
      </Canvas>
    </div>
  );
}
