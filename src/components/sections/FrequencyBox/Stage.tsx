"use client";

// The Frequency Box in 3D: a cream rigid box (base + lid with a real seam) in the client's 15 × 10 × 5 in
// proportions, its tan foil print painted at runtime onto two transparent planes that sit on the front and
// the spine with a more metallic finish than the card. It floats, turns on its own, picks up rotation from
// the page scroll, and can be dragged with inertia. It never opens.

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { gsap } from "@/lib/gsap";
import Prewarm from "@/lib/r3f/Prewarm";
import { fbox } from "./state";
import { makePrintTextures, type PrintTextures } from "./textures";

// 15 × 10 × 5 in → 3 × 2 × 1 units
const W = 3;
const H = 2;
const D = 1;
const CREAM = "#f1e6d2";
const SEAM = "#cbb89c";
const TAN = "#e7b47e";
const RADIUS = 0.035;

// the lid is a shallow tray over the top of the base; where its lip ends is the seam
const LID_H = H * 0.17;
const LID_Y = H / 2 - LID_H / 2;
const SEAM_Y = H / 2 - LID_H;
const BASE_H = H * 0.86;
const BASE_Y = -H / 2 + BASE_H / 2;
const LIP = 0.015;

// printed areas: the visible part of the base's front and spine, inset from the edges
const INSET = 0.12;
const PRINT_H = SEAM_Y + H / 2 - INSET;
const PRINT_Y = (SEAM_Y + -H / 2) / 2;
const FRONT_W = W - INSET - 0.02;
const SPINE_W = D - INSET;
const FRONT_RATIO = PRINT_H / FRONT_W;
const SPINE_RATIO = PRINT_H / SPINE_W;
/** lifts the print off the card so it never z-fights */
const LIFT = 0.003;

const FOV = 26;
const CAM = new THREE.Vector3(0, 1.3, 9.5);
const LOOK = new THREE.Vector3(0, -0.05, 0);
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
    return Math.min((visW * 0.8) / 3.5, (visH * 0.6) / 2.6);
  }, [size.width, size.height]);
}

function Print({ textures }: { textures: PrintTextures }) {
  return (
    <>
      <mesh position={[0, PRINT_Y, D / 2 + LIFT]}>
        <planeGeometry args={[FRONT_W, PRINT_H]} />
        <meshStandardMaterial map={textures.front} transparent metalness={0.6} roughness={0.3} envMapIntensity={1.1} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      <mesh position={[W / 2 + LIFT, PRINT_Y, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[SPINE_W, PRINT_H]} />
        <meshStandardMaterial map={textures.spine} transparent metalness={0.6} roughness={0.3} envMapIntensity={1.1} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
    </>
  );
}

function Box() {
  const rig = useRef<THREE.Group>(null);
  const box = useRef<THREE.Group>(null);
  const sweep = useRef<THREE.DirectionalLight>(null);
  const [textures, setTextures] = useState<PrintTextures | null>(null);

  // paint the print once; dispose with the scene
  useEffect(() => {
    let live = true;
    let made: PrintTextures | null = null;
    makePrintTextures(FRONT_RATIO, SPINE_RATIO).then((t) => {
      if (!live) {
        t.dispose();
        return;
      }
      made = t;
      setTextures(t);
    });
    return () => {
      live = false;
      made?.dispose();
    };
  }, []);

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
        <RoundedBox args={[W, BASE_H, D]} radius={RADIUS} smoothness={4} position={[0, BASE_Y, 0]}>
          <meshStandardMaterial color={CREAM} roughness={0.78} metalness={0} envMapIntensity={0.6} />
        </RoundedBox>
        <RoundedBox args={[W + LIP * 2, LID_H, D + LIP * 2]} radius={RADIUS} smoothness={4} position={[0, LID_Y, 0]}>
          <meshStandardMaterial color={CREAM} roughness={0.76} metalness={0} envMapIntensity={0.6} />
        </RoundedBox>
        {/* the seam: a hair of shadow where the lid's lip ends */}
        <mesh position={[0, SEAM_Y - 0.008, 0]}>
          <boxGeometry args={[W + 0.004, 0.016, D + 0.004]} />
          <meshStandardMaterial color={SEAM} roughness={0.9} />
        </mesh>
        {textures && <Print textures={textures} />}
      </group>
    </group>
  );
}

/** Three tan beads drifting around the box, like the hero's. */
function Beads() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const e = fbox.enter;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const a = t * 0.3 + (i * TWO_PI) / 3;
      m.position.set(Math.cos(a) * 2.3, Math.sin(a * 1.4 + i * 1.7) * 0.5 + 0.15, Math.sin(a) * 1.5);
      m.scale.setScalar(Math.max(0.001, e));
    });
  });
  return (
    <>
      {[0.065, 0.045, 0.055].map((r, i) => (
        <mesh
          key={i}
          ref={(m) => {
            refs.current[i] = m;
          }}
        >
          <sphereGeometry args={[r, 24, 24]} />
          <meshStandardMaterial color={TAN} roughness={0.35} metalness={0.2} />
        </mesh>
      ))}
    </>
  );
}

function Scene() {
  const fit = useFit();
  return (
    <>
      <Driver />
      <group scale={fit}>
        <Suspense fallback={null}>
          <Environment files="/world/studio_1k.hdr" environmentIntensity={0.35} />
          <ContactShadows position={[0, -H / 2 - 0.32, 0]} scale={[5, 2.6]} opacity={0.42} blur={2.4} far={2.8} resolution={512} color="#5a3f26" />
          <Prewarm name="fbox" />
        </Suspense>
        <Box />
        <Beads />
      </group>
      {/* warm key from the upper left, a soft fill from the right, sky/ground fill */}
      <directionalLight position={[-6, 7, 5]} intensity={2.0} color="#ffe2bd" />
      <directionalLight position={[5, 2, 4]} intensity={0.5} color="#f3e7da" />
      <hemisphereLight args={["#fff7ec", "#d9c7b1", 0.55]} />
    </>
  );
}

const clamp = THREE.MathUtils.clamp;

export default function Stage() {
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
        <Scene />
      </Canvas>
    </div>
  );
}
