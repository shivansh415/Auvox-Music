"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import type { Line2, LineSegments2 } from "three-stdlib";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { onPluck, playRiff, pluck, sampleAudio, unlockAudio } from "./audio";
import { dismissGuitarHint, session } from "./state";

// Brand palette only.
const RED = "#850909";
const TAN = "#e7b47e";
const PEARL = "#f1ede9";
const INK = "#1e1e1e";
const BLACK = "#070606";

// ---------------------------------------------------------------------------
// Camera path: wide studio → over the shoulder → into the phone screen
// ---------------------------------------------------------------------------
const PHONE_POS = new THREE.Vector3(0.42, 1.32, 0.52);
const PHONE_ROT = new THREE.Euler(-0.35, -0.55, 0.15);
const PHONE_NORMAL = new THREE.Vector3(0, 0, 1).applyEuler(PHONE_ROT);

const CAM_POS = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0.3, 1.42, 4.5),
  new THREE.Vector3(1.4, 1.6, 2.7),
  PHONE_POS.clone().addScaledVector(PHONE_NORMAL, 1.1).add(new THREE.Vector3(0.15, 0.2, 0)),
  PHONE_POS.clone().addScaledVector(PHONE_NORMAL, 0.19),
]);
const CAM_TARGET = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 1.1, 0.2),
  new THREE.Vector3(0.15, 1.2, 0.4),
  PHONE_POS.clone(),
  PHONE_POS.clone(),
]);
/** Scroll progress at which the camera has fully arrived at the phone screen */
const CAMERA_END = 0.75;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function CameraRig() {
  const smooth = useRef({ x: 0, y: 0 });
  const scratch = useRef({ pos: new THREE.Vector3(), target: new THREE.Vector3() });

  useFrame(({ clock, size, camera }, dt) => {
    const tmp = scratch.current;
    session.frames += 1;
    const p = THREE.MathUtils.clamp(session.progress / CAMERA_END, 0, 1);
    const t = easeInOut(p);
    const k = Math.min(1, dt * 3);
    smooth.current.x += (session.mouse.x - smooth.current.x) * k;
    smooth.current.y += (session.mouse.y - smooth.current.y) * k;

    const parallax = 1 - t;
    const breathe = Math.sin(clock.elapsedTime * 0.4) * 0.02 * parallax;
    CAM_POS.getPoint(t, tmp.pos);
    tmp.pos.x += smooth.current.x * 0.35 * parallax;
    tmp.pos.y += smooth.current.y * 0.18 * parallax + breathe;
    // Portrait screens see a narrower slice, so back the wide shot off a little.
    if (size.width < size.height) tmp.pos.z += 0.9 * parallax;
    camera.position.lerp(tmp.pos, Math.min(1, dt * 7));

    CAM_TARGET.getPoint(t, tmp.target);
    tmp.target.x += smooth.current.x * 0.08 * parallax;
    tmp.target.y += smooth.current.y * 0.04 * parallax;
    camera.lookAt(tmp.target);

    const cam = camera as THREE.PerspectiveCamera;
    const fov = 42 - 10 * t;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    return undefined;
  });
  return null;
}

// ---------------------------------------------------------------------------
// Lights — all driven by session.lights + the audio level
// ---------------------------------------------------------------------------
function Lights() {
  const red = useRef<THREE.SpotLight>(null);
  const lamp = useRef<THREE.SpotLight>(null);
  const lampFill = useRef<THREE.PointLight>(null);
  const ambient = useRef<THREE.AmbientLight>(null);
  const phone = useRef<THREE.PointLight>(null);
  const monitor = useRef<THREE.PointLight>(null);
  const lampTarget = useMemo(() => new THREE.Object3D(), []);
  const redTarget = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    sampleAudio(session.audio);
    const L = session.lights;
    const a = session.audio.level;
    const t = clock.elapsedTime;
    // The desk lamp flickers a touch, more when the guitar is loud.
    const flicker = L.lamp > 0.9 ? 1 + (Math.random() - 0.5) * (0.05 + a * 0.5) : 1;
    if (lamp.current) lamp.current.intensity = L.lamp * 55 * flicker;
    if (lampFill.current) lampFill.current.intensity = L.lamp * 4 * flicker;
    if (red.current) red.current.intensity = L.red * (28 + a * 50);
    if (ambient.current) ambient.current.intensity = 0.18 * L.ambient;
    if (phone.current) phone.current.intensity = 0.35 + Math.sin(t * 1.7) * 0.07;
    if (monitor.current) monitor.current.intensity = L.ambient * 1.6;
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={0} color={PEARL} />
      {/* red wash on the logo wall */}
      <spotLight
        ref={red}
        position={[0, 3.0, -0.3]}
        target={redTarget}
        color={RED}
        intensity={0}
        angle={1.05}
        penumbra={0.9}
        decay={2}
      />
      <primitive object={redTarget} position={[0, 1.9, -1.6]} />
      {/* warm desk lamp — the only shadow caster */}
      <spotLight
        ref={lamp}
        position={[1.3, 1.95, -0.55]}
        target={lampTarget}
        color={TAN}
        intensity={0}
        angle={0.8}
        penumbra={0.7}
        decay={2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      />
      <primitive object={lampTarget} position={[-0.1, 0.9, 0.35]} />
      <pointLight ref={lampFill} position={[1.3, 1.9, -0.55]} color={TAN} intensity={0} distance={5} decay={2} />
      {/* phone screen glow on the face */}
      <pointLight
        ref={phone}
        position={PHONE_POS.clone().addScaledVector(PHONE_NORMAL, 0.12)}
        color={PEARL}
        intensity={0.35}
        distance={0.6}
        decay={2}
      />
      {/* dim monitor spill from the desk */}
      <pointLight ref={monitor} position={[0.25, 1.15, -0.8]} color={PEARL} intensity={0} distance={2.5} decay={2} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Room + props
// ---------------------------------------------------------------------------
function Room() {
  return (
    <group>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color={BLACK} roughness={0.85} />
      </mesh>
      {/* rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0.35]} receiveShadow>
        <planeGeometry args={[2.6, 2.0]} />
        <meshStandardMaterial color="#3a0b0b" roughness={0.95} />
      </mesh>
      {/* back wall */}
      <mesh position={[0, 1.7, -1.6]} receiveShadow>
        <planeGeometry args={[9, 3.6]} />
        <meshStandardMaterial color={INK} roughness={0.95} />
      </mesh>
      {/* side walls */}
      <mesh position={[-3.2, 1.7, 0.5]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[6, 3.6]} />
        <meshStandardMaterial color={INK} roughness={0.95} />
      </mesh>
      <mesh position={[3.2, 1.7, 0.5]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[6, 3.6]} />
        <meshStandardMaterial color={INK} roughness={0.95} />
      </mesh>
      {/* acoustic panels */}
      {[-2.2, 2.2].map((x) => (
        <mesh key={x} position={[x, 1.5, -1.57]} receiveShadow>
          <boxGeometry args={[0.9, 1.4, 0.05]} />
          <meshStandardMaterial color="#141212" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/** The client's primary logo as a solid red sign on the back wall, lit by the red wall light. */
function WallSign() {
  const data = useLoader(SVGLoader, "/svg/auvox-primary-logo.svg");
  const { geometries, center } = useMemo(() => {
    const geometries = data.paths.flatMap((path) =>
      SVGLoader.createShapes(path).map((shape) => new THREE.ExtrudeGeometry(shape, { depth: 18, bevelEnabled: false })),
    );
    const box = new THREE.Box3();
    geometries.forEach((g) => {
      g.computeBoundingBox();
      box.union(g.boundingBox!);
    });
    const center = box.getCenter(new THREE.Vector3());
    return { geometries, center };
  }, [data]);
  const materials = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  useFrame(() => {
    // Keeps the sign readable while the room is dark; stays matte, never neon.
    const glow = 0.25 + session.lights.red * 0.45 + session.audio.level * 0.4;
    materials.current.forEach((m) => {
      if (m) m.emissiveIntensity = glow;
    });
  });
  const s = 0.0019;
  return (
    <group position={[0, 2.05, -1.58]} scale={[s, -s, s]}>
      <group position={[-center.x, -center.y, 0]}>
        {geometries.map((g, i) => (
          <mesh key={i} geometry={g} castShadow>
            <meshStandardMaterial
              ref={(el) => {
                materials.current[i] = el;
              }}
              color={RED}
              emissive={RED}
              emissiveIntensity={0.25}
              roughness={0.55}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function VuMeter() {
  const bars = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const b = session.audio.bands;
    bars.current.forEach((m, i) => {
      if (!m) return;
      const v = 0.06 + b[i] * 0.94;
      m.scale.y += (v - m.scale.y) * 0.35;
      m.position.y = 0.055 * m.scale.y;
    });
  });
  return (
    <group position={[-0.95, 0.84, -0.72]} rotation={[-0.4, 0.3, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.5, 0.025, 0.14]} />
        <meshStandardMaterial color="#111" roughness={0.6} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            bars.current[i] = el;
          }}
          position={[-0.21 + i * 0.038, 0, 0]}
        >
          <boxGeometry args={[0.022, 0.11, 0.014]} />
          <meshBasicMaterial color={TAN} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Vinyl() {
  const disc = useRef<THREE.Group>(null);
  const speed = useRef(0);
  useFrame((_, dt) => {
    const target = session.audio.level > 0.03 ? 2.2 : 0;
    speed.current += (target - speed.current) * Math.min(1, dt * 1.5);
    if (disc.current) disc.current.rotation.z -= speed.current * dt;
  });
  return (
    <group position={[-1.55, 2.0, -1.54]}>
      <group ref={disc}>
        <mesh castShadow>
          <circleGeometry args={[0.3, 48]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.35} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0, 0.002]}>
          <ringGeometry args={[0.1, 0.115, 48]} />
          <meshStandardMaterial color={TAN} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.002]}>
          <circleGeometry args={[0.1, 48]} />
          <meshStandardMaterial color={RED} roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

function Desk() {
  return (
    <group position={[0, 0, -0.85]}>
      <mesh position={[0, 0.76, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.6, 0.05, 0.75]} />
        <meshStandardMaterial color="#2a1a12" roughness={0.65} />
      </mesh>
      {[-1.2, 1.2].map((x) => (
        <mesh key={x} position={[x, 0.38, 0]} castShadow>
          <boxGeometry args={[0.06, 0.76, 0.7]} />
          <meshStandardMaterial color="#1b110c" roughness={0.8} />
        </mesh>
      ))}
      {/* monitor */}
      <mesh position={[0.25, 1.1, -0.15]} castShadow>
        <boxGeometry args={[0.8, 0.46, 0.03]} />
        <meshStandardMaterial color="#121212" roughness={0.5} />
      </mesh>
      <mesh position={[0.25, 1.1, -0.133]}>
        <planeGeometry args={[0.74, 0.4]} />
        <meshStandardMaterial color="#1c1a18" emissive={PEARL} emissiveIntensity={0.08} roughness={0.3} />
      </mesh>
      <mesh position={[0.25, 0.82, -0.15]}>
        <cylinderGeometry args={[0.1, 0.14, 0.08, 24]} />
        <meshStandardMaterial color="#121212" roughness={0.5} />
      </mesh>
      {/* speakers */}
      {[-0.45, 0.95].map((x) => (
        <mesh key={x} position={[x, 0.95, -0.2]} castShadow>
          <boxGeometry args={[0.2, 0.34, 0.22]} />
          <meshStandardMaterial color="#151313" roughness={0.9} />
        </mesh>
      ))}
      {/* desk lamp */}
      <group position={[1.3, 0.785, 0.3]}>
        <mesh>
          <cylinderGeometry args={[0.09, 0.11, 0.02, 24]} />
          <meshStandardMaterial color="#111" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 1.1, 8]} />
          <meshStandardMaterial color="#111" roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.16, 0]} rotation={[0.6, 0, -0.5]}>
          <coneGeometry args={[0.16, 0.2, 24, 1, true]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
        <LampBulb />
      </group>
      <VuMeter />
    </group>
  );
}

function LampBulb() {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (mat.current) mat.current.color.set(TAN).multiplyScalar(0.3 + session.lights.lamp * 2.6);
  });
  return (
    <mesh position={[0.05, 1.1, 0.05]}>
      <sphereGeometry args={[0.04, 16, 16]} />
      <meshBasicMaterial ref={mat} color={TAN} toneMapped={false} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// The guy — placeholder mannequin until the real character/photo arrives
// ---------------------------------------------------------------------------
type V3 = [number, number, number];
const UP = new THREE.Vector3(0, 1, 0);

function Limb({ a, b, r = 0.05, color, roughness = 0.75 }: { a: V3; b: V3; r?: number; color: string; roughness?: number }) {
  const { pos, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    const len = Math.max(0.01, dir.length() - r * 2);
    const pos = va.clone().add(vb).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());
    return { pos, quat, len };
  }, [a, b, r]);
  return (
    <mesh position={pos} quaternion={quat} castShadow receiveShadow>
      <capsuleGeometry args={[r, len, 4, 12]} />
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  );
}

const SKIN = "#5b4034";
const DENIM = "#171a22";

function Guy() {
  const breathe = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (breathe.current) breathe.current.position.y = Math.sin(clock.elapsedTime * 1.1) * 0.006;
  });
  return (
    <group>
      {/* stool */}
      <mesh position={[0, 0.5, 0.15]} castShadow>
        <cylinderGeometry args={[0.24, 0.24, 0.05, 24]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.25, 0.15]}>
        <cylinderGeometry args={[0.03, 0.03, 0.5, 12]} />
        <meshStandardMaterial color="#222" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.01, 0.15]}>
        <cylinderGeometry args={[0.22, 0.22, 0.02, 24]} />
        <meshStandardMaterial color="#222" roughness={0.5} metalness={0.4} />
      </mesh>

      <group ref={breathe}>
        {/* torso in the AUVOX tee */}
        <Limb a={[0, 0.62, 0.14]} b={[0, 1.3, 0.06]} r={0.2} color={PEARL} roughness={0.9} />
        <Suspense fallback={null}>
          <ChestLogo />
        </Suspense>
        {/* neck + head */}
        <Limb a={[0, 1.28, 0.08]} b={[0, 1.42, 0.1]} r={0.05} color={SKIN} />
        <mesh position={[0.02, 1.52, 0.1]} rotation={[0.25, 0.35, 0]} castShadow>
          <sphereGeometry args={[0.13, 24, 24]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>
        <mesh position={[0.02, 1.57, 0.07]} scale={[1, 0.75, 1]} castShadow>
          <sphereGeometry args={[0.14, 24, 24]} />
          <meshStandardMaterial color="#120d0b" roughness={0.9} />
        </mesh>
        {/* right arm → guitar */}
        <Limb a={[-0.22, 1.22, 0.06]} b={[-0.36, 0.98, 0.22]} r={0.05} color={SKIN} />
        <Limb a={[-0.36, 0.98, 0.22]} b={[-0.16, 0.98, 0.62]} r={0.045} color={SKIN} />
        <mesh position={[-0.14, 0.99, 0.64]} castShadow>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>
        {/* left arm → phone */}
        <Limb a={[0.22, 1.22, 0.06]} b={[0.38, 1.0, 0.2]} r={0.05} color={SKIN} />
        <Limb a={[0.38, 1.0, 0.2]} b={[0.41, 1.2, 0.45]} r={0.045} color={SKIN} />
        <mesh position={[0.41, 1.215, 0.46]} castShadow>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>
      </group>

      {/* legs */}
      <Limb a={[0.11, 0.56, 0.18]} b={[0.15, 0.52, 0.62]} r={0.075} color={DENIM} />
      <Limb a={[0.15, 0.52, 0.62]} b={[0.16, 0.06, 0.66]} r={0.065} color={DENIM} />
      <Limb a={[-0.11, 0.56, 0.18]} b={[-0.17, 0.52, 0.62]} r={0.075} color={DENIM} />
      <Limb a={[-0.17, 0.52, 0.62]} b={[-0.19, 0.06, 0.66]} r={0.065} color={DENIM} />
      {[0.16, -0.19].map((x) => (
        <mesh key={x} position={[x, 0.035, 0.74]} castShadow>
          <boxGeometry args={[0.1, 0.07, 0.26]} />
          <meshStandardMaterial color="#0d0d0d" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function ChestLogo() {
  const data = useLoader(SVGLoader, "/svg/auvox-logomark.svg");
  const geometries = useMemo(
    () => data.paths.flatMap((p) => SVGLoader.createShapes(p).map((s) => new THREE.ShapeGeometry(s))),
    [data],
  );
  const s = 0.0011;
  return (
    <group position={[0.055, 1.12, 0.265]} rotation={[-0.12, 0, 0]} scale={[s, -s, s]}>
      <group position={[-44, -39, 0]}>
        {geometries.map((g, i) => (
          <mesh key={i} geometry={g}>
            <meshStandardMaterial color={RED} roughness={0.8} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Guitar with playable strings
// ---------------------------------------------------------------------------
const STRING_X0 = -0.2;
const STRING_X1 = 1.0;
const STRING_Z = 0.052;
const SEGMENTS = 40;
const stringY = (i: number) => 0.055 - i * 0.022;

function Strings() {
  const lines = useRef<(Line2 | LineSegments2 | null)[]>([]);
  const energy = useRef(new Float32Array(6));
  const age = useRef(new Float32Array(6));
  const phase = useRef(new Float32Array(6));
  const scratch = useRef(new Float32Array((SEGMENTS + 1) * 3));
  const resting = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) =>
        Array.from({ length: SEGMENTS + 1 }, (_, k) => {
          const u = k / SEGMENTS;
          return [STRING_X0 + (STRING_X1 - STRING_X0) * u, stringY(i), STRING_Z] as V3;
        }),
      ),
    [],
  );

  useEffect(
    () =>
      onPluck((i) => {
        energy.current[i] = 1;
        age.current[i] = 0;
        phase.current[i] = Math.random() * Math.PI * 2;
      }),
    [],
  );

  useFrame((_, dt) => {
    for (let i = 0; i < 6; i++) {
      const line = lines.current[i];
      const e = energy.current[i];
      if (!line || e < 0.004) continue;
      age.current[i] += dt;
      energy.current[i] = e * Math.exp(-dt * 2.6);
      const t = age.current[i];
      const amp = 0.016 * e;
      const w = 34 + i * 5;
      for (let k = 0; k <= SEGMENTS; k++) {
        const u = k / SEGMENTS;
        const env = Math.sin(Math.PI * u);
        const s =
          amp * env * (Math.sin(t * w + phase.current[i]) + 0.35 * Math.sin(2 * Math.PI * u) * Math.sin(t * w * 2.1));
        scratch.current[k * 3] = STRING_X0 + (STRING_X1 - STRING_X0) * u;
        scratch.current[k * 3 + 1] = stringY(i) + s * 0.35;
        scratch.current[k * 3 + 2] = STRING_Z + s;
      }
      line.geometry.setPositions(scratch.current);
    }
  });

  const strike = (i: number) => {
    dismissGuitarHint();
    pluck(i, 1);
  };

  return (
    <group>
      {resting.map((pts, i) => (
        <Line
          key={i}
          ref={(el) => {
            lines.current[i] = el;
          }}
          points={pts}
          color={new THREE.Color(TAN).multiplyScalar(1.15)}
          lineWidth={1.1 - i * 0.07}
          frustumCulled={false}
          material-toneMapped={false}
        />
      ))}
      {/* invisible hit zones — crossing one plucks it, so a swipe across is a strum */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh
          key={i}
          position={[(STRING_X0 + STRING_X1) / 2, stringY(i), STRING_Z]}
          onPointerEnter={() => strike(i)}
          onPointerDown={(e) => {
            e.stopPropagation();
            strike(i);
          }}
        >
          <boxGeometry args={[STRING_X1 - STRING_X0, 0.022, 0.06]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function Guitar() {
  const group = useRef<THREE.Group>(null);
  const scratch = useRef(new THREE.Vector3());
  useFrame(({ camera, size }) => {
    if (!group.current) return;
    const hintPoint = scratch.current.set(0.05, 0.14, 0.1);
    group.current.localToWorld(hintPoint).project(camera);
    session.hintScreen.x = (hintPoint.x * 0.5 + 0.5) * size.width;
    session.hintScreen.y = (-hintPoint.y * 0.5 + 0.5) * size.height;
    session.hintScreen.opacity =
      session.guitarHint * session.lights.lamp * (1 - THREE.MathUtils.clamp(session.progress / 0.15, 0, 1));
  });
  const wood = <meshStandardMaterial color="#4a1410" roughness={0.35} metalness={0.05} />;
  const strum = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    dismissGuitarHint();
    playRiff();
  };
  return (
    <group ref={group} position={[-0.02, 0.9, 0.56]} rotation={[-0.62, 0.12, 0.3]}>
      {/* body: two bouts */}
      <group
        onPointerDown={strum}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <mesh position={[-0.08, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.21, 0.21, 0.09, 48]} />
          {wood}
        </mesh>
        <mesh position={[0.17, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.165, 0.165, 0.09, 48]} />
          {wood}
        </mesh>
        {/* soundhole */}
        <mesh position={[0.12, 0, 0.046]}>
          <circleGeometry args={[0.055, 32]} />
          <meshStandardMaterial color="#050505" roughness={1} />
        </mesh>
        <mesh position={[0.12, 0, 0.047]}>
          <ringGeometry args={[0.055, 0.066, 32]} />
          <meshStandardMaterial color={TAN} roughness={0.6} />
        </mesh>
        {/* bridge */}
        <mesh position={[-0.2, 0, 0.05]}>
          <boxGeometry args={[0.03, 0.17, 0.012]} />
          <meshStandardMaterial color="#0c0c0c" roughness={0.6} />
        </mesh>
      </group>
      {/* neck + headstock */}
      <mesh position={[0.66, 0, 0.03]} castShadow>
        <boxGeometry args={[0.72, 0.065, 0.028]} />
        <meshStandardMaterial color="#1a100c" roughness={0.5} />
      </mesh>
      <mesh position={[1.09, 0, 0.03]} rotation={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.17, 0.09, 0.022]} />
        {wood}
      </mesh>
      {/* frets */}
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[0.36 + i * 0.054, 0, 0.045]}>
          <boxGeometry args={[0.004, 0.065, 0.004]} />
          <meshStandardMaterial color="#b9b1a4" roughness={0.3} metalness={0.8} />
        </mesh>
      ))}
      <Strings />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Phone with a lit screen (lock screen drawn to a canvas texture)
// ---------------------------------------------------------------------------
function usePhoneScreenTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 544;
    c.height = 1160;
    const g = c.getContext("2d")!;
    g.scale(2, 2);
    const grad = g.createLinearGradient(0, 0, 0, 580);
    grad.addColorStop(0, "#3a0a0a");
    grad.addColorStop(1, "#120808");
    g.fillStyle = grad;
    g.fillRect(0, 0, 272, 580);
    g.fillStyle = PEARL;
    g.textAlign = "center";
    g.font = "600 76px Afacad Flux, system-ui, sans-serif";
    g.fillText("11:50", 136, 170);
    g.font = "500 18px Afacad Flux, system-ui, sans-serif";
    g.globalAlpha = 0.7;
    g.fillText("Tuesday, 7 October", 136, 200);
    g.globalAlpha = 1;
    // notification card
    g.fillStyle = "rgba(241,237,233,0.12)";
    g.beginPath();
    g.roundRect(18, 250, 236, 92, 18);
    g.fill();
    g.fillStyle = TAN;
    g.beginPath();
    g.arc(48, 296, 18, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = RED;
    g.font = "700 20px Afacad Flux, system-ui, sans-serif";
    g.fillText("α", 48, 303);
    g.fillStyle = PEARL;
    g.textAlign = "left";
    g.font = "600 17px Afacad Flux, system-ui, sans-serif";
    g.fillText("AUVOX Music", 78, 288);
    g.font = "400 15px Afacad Flux, system-ui, sans-serif";
    g.globalAlpha = 0.8;
    g.fillText("Hey… have you heard about", 78, 310);
    g.fillText("AUVOX Music?", 78, 328);
    g.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

function Phone() {
  const tex = usePhoneScreenTexture();
  return (
    <group position={PHONE_POS} rotation={PHONE_ROT}>
      <mesh castShadow>
        <boxGeometry args={[0.076, 0.158, 0.008]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.35} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.0042]}>
        <planeGeometry args={[0.068, 0.146]} />
        <meshBasicMaterial map={tex} toneMapped={false} color={[1.6, 1.6, 1.6]} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Dust in the lamp light
// ---------------------------------------------------------------------------
const DUST_COUNT = 220;
/** Deterministic 0–1 noise so the layout is identical on every render. */
const hash = (n: number) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

function Dust() {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const pos = new Float32Array(DUST_COUNT * 3);
    for (let i = 0; i < DUST_COUNT; i++) {
      pos[i * 3] = -1.2 + hash(i * 3) * 3;
      pos[i * 3 + 1] = 0.3 + hash(i * 3 + 1) * 2.2;
      pos[i * 3 + 2] = -1.0 + hash(i * 3 + 2) * 2.2;
    }
    return pos;
  }, []);
  useFrame(({ clock }, dt) => {
    const mesh = points.current;
    if (!mesh) return;
    const attr = mesh.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const t = clock.elapsedTime;
    const kick = session.audio.level * 0.5;
    for (let i = 0; i < DUST_COUNT; i++) {
      arr[i * 3] += Math.sin(t * 0.3 + i) * 0.015 * dt;
      arr[i * 3 + 1] += (0.025 + kick) * dt;
      if (arr[i * 3 + 1] > 2.5) arr[i * 3 + 1] = 0.3;
    }
    attr.needsUpdate = true;
    (mesh.material as THREE.PointsMaterial).opacity = 0.2 * session.lights.lamp;
  });
  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={TAN} size={0.008} transparent opacity={0} depthWrite={false} sizeAttenuation />
    </points>
  );
}

// ---------------------------------------------------------------------------
function Scene() {
  return (
    <>
      <color attach="background" args={[BLACK]} />
      <fog attach="fog" args={[BLACK, 3, 9.5]} />
      <Lights />
      <Room />
      <Desk />
      <Vinyl />
      <Suspense fallback={null}>
        <WallSign />
      </Suspense>
      <Guy />
      <Guitar />
      <Phone />
      <Dust />
      <CameraRig />
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur luminanceThreshold={0.9} luminanceSmoothing={0.15} intensity={0.55} radius={0.6} />
        <Vignette eskil={false} offset={0.25} darkness={0.8} />
      </EffectComposer>
    </>
  );
}

export default function Studio() {
  return (
    <Canvas
      className="absolute inset-0"
      style={{ touchAction: "pan-y" }}
      dpr={[1, 1.5]}
      shadows
      camera={{ fov: 42, near: 0.05, far: 30, position: [0.3, 1.42, 4.5] }}
      gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
      onPointerDown={unlockAudio}
    >
      <Scene />
    </Canvas>
  );
}
