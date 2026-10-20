"use client";

// The Frequency Box film, in 3D. One scrubbed value (fbox.progress, 0–1 through the pinned
// section) drives everything, as pure keyframes, so it plays the same in either direction:
//
//   0.00–0.18  the Journey's peach darkens into a warm studio night
//   0.04–0.16  a line of light at the centre grows into the box (edge-on, glowing)
//   0.06–0.46  the box turns three quarters — back, edge, front — while a curved gallery of
//              image panels fades in around it, each at its own depth
//   0.44–0.60  a warm light sweeps across the lid and the front; the headline arrives
//   0.60–0.84  the panels drift up and away, a pedestal rises from below, the box settles on it
//   0.84–1.00  the final showcase holds: box on its plinth, headline above, call to action below
//
// The box itself (sand card, taupe lid, printed faces) is the one from the client's reference.
// It never opens. A drag adds a turn on top of the film; the edition switch gives it a push.

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, MeshReflectorMaterial, RoundedBox, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { gsap } from "@/lib/gsap";
import Prewarm from "@/lib/r3f/Prewarm";
import { easeInOut, easeOut, fbox, kf } from "./state";
import { makePrintTextures, type Edition, type PrintTextures } from "./textures";

// ---------------------------------------------------------------------------------------------
// the box: 15 × 10 × 5 in, lying flat: 3 wide, 1 high, 2 deep
// ---------------------------------------------------------------------------------------------
const W = 3;
const H = 1;
const D = 2;
const SAND = "#bcb19f";
const LID = "#948c7e";
const SEAM = "#8a7f6e";
const GLOW = new THREE.Color("#ffd9a8");
const RADIUS = 0.03;
const LID_T = 0.07;
const LID_Y = H / 2 + LID_T / 2 - 0.012;
const OVER = 0.012;
const INSET = 0.1;
const FRONT_W = W - INSET * 2;
const FRONT_H = H - INSET * 2;
const SIDE_W = D - INSET * 2;
const SIDE_H = H - INSET * 2;
const TOP_W = W * 0.6;
const TOP_H = D * 0.6;
const RATIOS = { front: FRONT_H / FRONT_W, side: SIDE_H / SIDE_W, top: TOP_H / TOP_W };
const LIFT = 0.003;

// the pedestal: its top surface, when it has arrived
const PED_TOP = -1.9;
const PED_W = 6.2;
const PED_D = 3.5;
/** where the box rests on the pedestal */
const BOX_LANDED_Y = PED_TOP + H / 2;

const FOV = 26;
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const TWO_PI = Math.PI * 2;

// the gallery: a wall of small frames behind and around the box, in the camera's view, each at its
// own depth. The pictures are the site's own (the studio, the room, the Journey's renders).
type PanelSpec = { src: string; x: number; y: number; z: number; w: number; drift: number; dim: number };
const SOURCES = ["/journey/02-render.webp", "/scene/hero.jpg", "/journey/04-render.webp", "/hero/room-sm.jpg", "/journey/01-render.webp", "/journey/05-render.webp", "/journey/03-render.webp"];
function wall(cols: number[], rows: number[], gapX: number, gapY: number): PanelSpec[] {
  const out: PanelSpec[] = [];
  let i = 0;
  for (const y of rows) {
    for (const x of cols) {
      i++;
      if (Math.abs(x) < gapX && Math.abs(y) < gapY) continue; // the box's own room
      const depth = (i * 7) % 4;
      out.push({
        src: SOURCES[(i * 3) % SOURCES.length],
        x: x * (1 + depth * 0.06),
        y: y + ((i * 5) % 3) * 0.22 - 0.22,
        z: -2.6 - depth * 1.15,
        w: 1.25 + ((i * 2) % 3) * 0.16,
        drift: 0.5 + ((i * 4) % 3) * 0.28,
        dim: 0.74 - depth * 0.12,
      });
    }
  }
  return out;
}
const GALLERY = wall([-5.3, -3.7, -2.15, 2.15, 3.7, 5.3], [-2.75, -0.95, 0.95, 2.75], 2.5, 1.5);
const PHONE_GALLERY = wall([-2.7, -1.55, 1.55, 2.7], [-2.5, -0.9, 0.9, 2.5], 2.0, 1.4);

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

/** The camera: a slow dolly in during the turn, then up and back a little to look down at the plinth. */
function Rig() {
  const { camera, size } = useThree();
  const look = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const p = fbox.progress;
    const aspect = size.width / size.height;
    // the box (3 wide) must fit with room on narrow screens: push the camera back there
    const minZ = (W * 0.72) / (TAN * aspect);
    const z = Math.max(kf(p, [[0, 14], [0.48, 10.6], [0.86, 14.4]], easeInOut), minZ);
    const y = kf(p, [[0, 0.6], [0.48, 1.2], [0.86, 2.4]], easeInOut);
    camera.position.set(0, y, z);
    look.set(0, kf(p, [[0.3, 0.1], [0.62, -0.15], [0.86, -0.62]], easeInOut), 0);
    camera.lookAt(look);
  });
  return null;
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
  const shadow = useRef<THREE.Group>(null);
  const sweep = useRef<THREE.DirectionalLight>(null);
  const body = useRef<THREE.MeshStandardMaterial>(null);
  const lid = useRef<THREE.MeshStandardMaterial>(null);
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
      const old = made;
      if (old) window.setTimeout(() => old.dispose(), 1500);
    };
  }, [edition]);

  useFrame(({ clock }, delta) => {
    const g = rig.current;
    const b = box.current;
    if (!g || !b) return;
    const s = fbox;
    const p = s.progress;
    const dt = Math.min(delta, 0.05);
    const t = clock.elapsedTime;

    // a drag turns the box on top of the film; inertia after release
    if (!s.dragging) {
      s.spin += s.vel * dt;
      s.vel *= Math.exp(-dt * 2.4);
      if (Math.abs(s.vel) < 0.002) s.vel = 0;
      // once the throw has died down, the box comes back round to face the front
      if (Math.abs(s.vel) < 1.2) {
        const home = Math.round(s.spin / TWO_PI) * TWO_PI;
        s.spin += (home - s.spin) * Math.min(1, dt * 1.6);
      }
    }
    s.tilt += (s.tiltTarget - s.tilt) * Math.min(1, dt * (s.dragging ? 10 : 4));

    // the birth: a horizontal line of light that grows into the box
    g.visible = p > 0.085;
    const sx = kf(p, [[0.09, 0.5], [0.22, 1]], easeOut);
    const sy = kf(p, [[0.09, 0.012], [0.21, 1]], easeInOut);
    const sz = kf(p, [[0.09, 0.04], [0.21, 1]], easeInOut);
    g.scale.set(sx, sy, sz);
    const glow = kf(p, [[0.09, 3], [0.18, 1.4], [0.34, 0]], easeOut);
    if (body.current) body.current.emissiveIntensity = glow;
    if (lid.current) lid.current.emissiveIntensity = glow * 0.8;

    // the turn: three quarters, from edge-on through the back to the front; then a rest angle
    const turn = kf(p, [[0.1, Math.PI * 1.5], [0.48, 0]], easeInOut);
    const rest = kf(p, [[0.48, 0], [0.86, -0.3]], easeInOut);
    const idle = s.still ? 0 : Math.sin(t * 0.35) * 0.03 * kf(p, [[0.5, 0], [0.7, 1]]);
    b.rotation.set(0.03 + s.tilt + Math.sin(t * 0.5) * 0.012, turn + rest + s.spin + idle, Math.sin(t * 0.37) * 0.008);

    // where it hangs, then where it lands
    const float = Math.sin(t * 0.8) * 0.04 * kf(p, [[0.6, 1], [0.84, 0]]);
    g.position.y = kf(p, [[0.09, 0.25], [0.32, -0.15], [0.62, -0.35], [0.86, BOX_LANDED_Y]], easeInOut) + float;

    // the shadow lives on the pedestal: it fades in as the box lands
    if (shadow.current) {
      shadow.current.visible = p > 0.7;
      shadow.current.scale.setScalar(kf(p, [[0.7, 0.6], [0.88, 1]]));
    }

    // a warm light crossing the box as the front settles
    const l = sweep.current;
    if (l) {
      const u = kf(p, [[0.44, 0], [0.6, 1]], easeInOut);
      l.position.set(THREE.MathUtils.lerp(-9, 9, u), 4.5, 5);
      l.intensity = Math.sin(u * Math.PI) * 3.6;
    }
  });

  return (
    <>
      <group ref={rig}>
        <directionalLight ref={sweep} intensity={0} color="#fff1dc" />
        <group ref={box}>
          <RoundedBox args={[W, H, D]} radius={RADIUS} smoothness={4}>
            <meshStandardMaterial ref={body} color={SAND} emissive={GLOW} emissiveIntensity={0} roughness={0.82} metalness={0} envMapIntensity={0.55} />
          </RoundedBox>
          <RoundedBox args={[W + OVER * 2, LID_T, D + OVER * 2]} radius={RADIUS} smoothness={4} position={[0, LID_Y, 0]}>
            <meshStandardMaterial ref={lid} color={LID} emissive={GLOW} emissiveIntensity={0} roughness={0.75} metalness={0} envMapIntensity={0.55} />
          </RoundedBox>
          <mesh position={[0, H / 2 - 0.016, 0]}>
            <boxGeometry args={[W + 0.004, 0.012, D + 0.004]} />
            <meshStandardMaterial color={SEAM} roughness={0.9} />
          </mesh>
          {textures && <Print textures={textures} />}
        </group>
      </group>
      <group ref={shadow} position={[0, PED_TOP + 0.012, 0]} visible={false}>
        <ContactShadows scale={[5.6, 3.8]} opacity={0.55} blur={2.2} far={1.6} resolution={512} color="#120c0a" />
      </group>
    </>
  );
}

/** The gallery: panels on a curved wall, each at its own depth, drifting up as you scroll past. */
function Gallery({ phone }: { phone: boolean }) {
  const specs = phone ? PHONE_GALLERY : GALLERY;
  // drei's onLoad is where a loaded texture may be set up (colour space, filtering)
  const maps = useTexture(specs.map((s) => s.src), (loaded) => {
    for (const m of Array.isArray(loaded) ? loaded : [loaded]) {
      m.colorSpace = THREE.SRGBColorSpace;
      m.anisotropy = 4;
      m.needsUpdate = true;
    }
  });
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const p = fbox.progress;
    const fade = kf(p, [[0.14, 0], [0.34, 1], [0.6, 1], [0.8, 0]], easeInOut);
    const grow = kf(p, [[0.14, 0.8], [0.44, 1]], easeOut);
    const lift = kf(p, [[0.34, 0], [0.86, 1]], easeInOut);
    const k = phone ? 0.82 : 1;
    specs.forEach((s, i) => {
      const m = refs.current[i];
      if (!m) return;
      // they open outward and drift up as the film moves on, the nearer ones faster
      const spread = 1 + lift * 0.18 + (1 - grow) * 0.25;
      m.position.set(s.x * spread * k, (s.y + lift * s.drift * 2.6) * k, s.z);
      m.lookAt(0, m.position.y * 0.6, 14);
      m.scale.setScalar(grow * k);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = fade * s.dim;
      m.visible = mat.opacity > 0.01;
    });
  });
  return (
    <>
      {specs.map((s, i) => {
        const tex = maps[i];
        const img = tex.image as { width?: number; height?: number } | undefined;
        const ratio = img && img.width && img.height ? img.height / img.width : 0.75;
        return (
          <mesh
            key={`${s.src}-${i}`}
            ref={(m) => {
              refs.current[i] = m;
            }}
          >
            <planeGeometry args={[s.w, s.w * ratio]} />
            {/* warm, dimmed and a touch desaturated by the tint; unlit so it reads the same at any angle */}
            <meshBasicMaterial map={tex} color="#b8a494" transparent opacity={0} toneMapped={false} depthWrite={false} />
          </mesh>
        );
      })}
    </>
  );
}

/** The plinth: a lighter top plate on a dark slab on a black base that runs out of frame. */
function Pedestal() {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!g.current) return;
    const p = fbox.progress;
    g.current.position.y = kf(p, [[0.6, -9], [0.86, 0]], easeOut);
    g.current.visible = p > 0.58;
  });
  return (
    <group ref={g} visible={false}>
      {/* the top plate: polished stone that carries a soft reflection of the box */}
      <mesh position={[0, PED_TOP, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[PED_W, PED_D]} />
        <MeshReflectorMaterial color="#6e6058" metalness={0.55} roughness={0.5} mirror={0.45} mixBlur={1} mixStrength={0.9} blur={[360, 120]} resolution={512} depthScale={0.6} minDepthThreshold={0.6} maxDepthThreshold={1.4} />
      </mesh>
      <mesh position={[0, PED_TOP - 0.04, 0]}>
        <boxGeometry args={[PED_W, 0.08, PED_D]} />
        <meshStandardMaterial color="#5a4e46" metalness={0.7} roughness={0.3} envMapIntensity={1.2} />
      </mesh>
      <mesh position={[0, PED_TOP - 0.08 - 0.3, 0]}>
        <boxGeometry args={[PED_W, 0.6, PED_D]} />
        <meshStandardMaterial color="#2a2320" metalness={0.5} roughness={0.5} envMapIntensity={0.6} />
      </mesh>
      {/* a hairline of light between slab and base, like a joint in the stone */}
      <mesh position={[0, PED_TOP - 0.08 - 0.6 - 0.04, 0]}>
        <boxGeometry args={[PED_W - 0.02, 0.08, PED_D - 0.02]} />
        <meshStandardMaterial color="#7a6a5e" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, PED_TOP - 0.08 - 0.6 - 0.08 - 2.2, 0]}>
        <boxGeometry args={[PED_W, 4.4, PED_D]} />
        <meshStandardMaterial color="#120e0c" metalness={0.3} roughness={0.7} envMapIntensity={0.4} />
      </mesh>
    </group>
  );
}

/** The atmosphere: a burgundy glow rising behind the box as the night settles in. */
function Mood() {
  const red = useRef<THREE.PointLight>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const lamp = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const p = fbox.progress;
    if (red.current) red.current.intensity = kf(p, [[0.1, 0], [0.32, 7], [0.86, 1.5]]);
    if (key.current) key.current.intensity = kf(p, [[0, 1.4], [0.3, 2.4], [0.84, 2.8]]);
    // the showcase lamp: a warm light over the plinth once it has arrived
    if (lamp.current) lamp.current.intensity = kf(p, [[0.64, 0], [0.88, 14]]);
  });
  return (
    <>
      <pointLight ref={lamp} position={[0.6, 1.4, 3.4]} intensity={0} color="#ffe6c8" distance={9} decay={1.8} />
      <directionalLight ref={key} position={[-6, 8, 6]} intensity={1.4} color="#ffe2bd" />
      <directionalLight position={[6, 3, -4]} intensity={1.1} color="#f3e7da" />
      <pointLight ref={red} position={[0, 1.6, -5.5]} intensity={0} color="#8a1414" distance={16} decay={1.6} />
      <hemisphereLight args={["#fff2e0", "#3a2a22", 0.35]} />
    </>
  );
}

function Scene({ edition, phone }: { edition: Edition; phone: boolean }) {
  return (
    <>
      <Driver />
      <Rig />
      <Suspense fallback={null}>
        <Environment files="/world/studio_1k.hdr" environmentIntensity={0.3} />
        <Gallery phone={phone} />
        <Prewarm name="fbox" />
      </Suspense>
      <Box edition={edition} />
      <Pedestal />
      <Mood />
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
        camera={{ fov: FOV, near: 0.1, far: 60, position: [0, 0.6, 13.5] }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
        style={{ touchAction: "pan-y" }}
      >
        <Scene edition={edition} phone={phone} />
      </Canvas>
    </div>
  );
}

useTexture.preload(SOURCES);
