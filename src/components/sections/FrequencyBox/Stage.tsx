"use client";

// The Frequency Box film, in 3D. One scrubbed value (fbox.progress, 0–1 through the pinned
// section) drives everything, as pure keyframes, so it plays the same in either direction:
//
//   before the pin  the night rises from the bottom of the screen over the Journey's peach
//   0.05–0.17  a line of light at the centre grows into the box (edge-on, glowing)
//   0.06–0.46  the box turns three quarters — back, edge, front — inside a dark gallery of
//              portrait frames at different depths (the near ones sharp, the far ones soft)
//   0.44–0.60  a warm light sweeps across the lid and the front; the headline arrives
//   0.60–0.86  the frames drift up and away, a plinth rises from the floor, the box settles on it
//   0.86–1.00  the showcase holds: box on its plinth under a cone of light, over a dark glossy
//              floor that carries its reflection; headline above, call to action below
//
// Lighting is a dark studio: one big softbox above and behind the camera (what the lid reflects),
// a warm strip behind-right for the rim, a close spotlight as the key (shadows, a gradient on each
// face). Bloom, depth of field, vignette and grain finish the picture. The box never opens.

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, MeshReflectorMaterial, RoundedBox, useTexture } from "@react-three/drei";
import { Bloom, DepthOfField, EffectComposer, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
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
const SAND = "#b4a893";
const LID = "#857c6f";
const SEAM = "#8a7f6e";
const GLOW = new THREE.Color("#ffd9a8");
const RADIUS = 0.03;
const LID_T = 0.1;
const LID_Y = H / 2 + LID_T / 2 - 0.012;
const OVER = 0.035;
const INSET = 0.1;
const FRONT_W = W - INSET * 2;
const FRONT_H = H - INSET * 2;
const SIDE_W = D - INSET * 2;
const SIDE_H = H - INSET * 2;
const TOP_W = W * 0.6;
const TOP_H = D * 0.6;
const RATIOS = { front: FRONT_H / FRONT_W, side: SIDE_H / SIDE_W, top: TOP_H / TOP_W };
const LIFT = 0.003;

// the room: a dark glossy floor; the plinth stands on it
const FLOOR_Y = -3.3;
const PED_TOP = -1.9;
const PED_W = 5.0;
const PED_D = 3.1;
const PLATE_T = 0.08;
const SLAB_T = 0.6;
const JOINT_T = 0.08;
const BASE_T = PED_TOP - PLATE_T - SLAB_T - JOINT_T - FLOOR_Y;
/** where the box rests on the pedestal */
const BOX_LANDED_Y = PED_TOP + H / 2;

const FOV = 26;
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const TWO_PI = Math.PI * 2;

// the gallery: portrait frames on a wall behind and around the box, each at its own depth. The
// pictures are the site's own: the studio, the room, the instruments (studio renders on a dark card).
type PanelSpec = { src: string; x: number; y: number; z: number; drift: number; dim: number };
const SOURCES = ["/scene/hero.jpg", "/verse/seq/guitar/lg/000.webp", "/hero/room-sm.jpg", "/verse/seq/piano/lg/048.webp", "/verse/seq/guitar/lg/060.webp", "/verse/seq/piano/lg/012.webp"];
const FRAME_W = 1.05;
const FRAME_H = 1.4;
function wall(cols: number[], rows: number[], gapX: number, gapY: number): PanelSpec[] {
  const out: PanelSpec[] = [];
  let i = 0;
  for (const y of rows) {
    for (const x of cols) {
      i++;
      if (Math.abs(x) < gapX && Math.abs(y) < gapY) continue; // the box's own room
      const depth = (i * 7) % 4;
      out.push({
        src: SOURCES[(i * 5) % SOURCES.length],
        x: x * (1 + depth * 0.07),
        y: y + ((i * 5) % 3) * 0.2 - 0.2,
        z: -2.4 - depth * 1.3,
        drift: 0.5 + ((i * 4) % 3) * 0.28,
        dim: 0.7 - depth * 0.11,
      });
    }
  }
  return out;
}
const GALLERY = wall([-5.4, -3.8, -2.2, 2.2, 3.8, 5.4], [-2.9, -1.0, 0.95, 2.85], 2.5, 1.5);
const PHONE_GALLERY = wall([-2.8, -1.6, 1.6, 2.8], [-2.6, -0.9, 0.9, 2.6], 2.0, 1.4);

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

/** The camera: a slow dolly in during the turn, then up and back to take in the plinth. */
function Rig() {
  const { camera, size } = useThree();
  const look = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const p = fbox.progress;
    const aspect = size.width / size.height;
    // the box (3 wide) must fit with room on narrow screens: push the camera back there
    const minZ = (W * 0.72) / (TAN * aspect);
    const z = Math.max(kf(p, [[0, 14.5], [0.48, 12.2], [0.86, 15.6]], easeInOut), minZ);
    const y = kf(p, [[0, 0.6], [0.48, 1.1], [0.86, 2.5]], easeInOut);
    camera.position.set(0, y, z);
    look.set(0, kf(p, [[0.3, 0.1], [0.62, -0.15], [0.86, -0.8]], easeInOut), 0);
    camera.lookAt(look);
  });
  return null;
}

/* the print: ink pressed into the card (the artwork doubles as a bump map, so its edges catch the light) */
const printMat = { transparent: true, metalness: 0.05, roughness: 0.72, envMapIntensity: 0.9, bumpScale: -0.5, polygonOffset: true, polygonOffsetFactor: -2 } as const;

function Print({ textures }: { textures: PrintTextures }) {
  return (
    <>
      <mesh position={[0, 0, D / 2 + LIFT]}>
        <planeGeometry args={[FRONT_W, FRONT_H]} />
        <meshStandardMaterial map={textures.front} bumpMap={textures.front} {...printMat} />
      </mesh>
      <mesh position={[W / 2 + LIFT, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[SIDE_W, SIDE_H]} />
        <meshStandardMaterial map={textures.side} bumpMap={textures.side} {...printMat} />
      </mesh>
      <mesh position={[-W / 2 - LIFT, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[SIDE_W, SIDE_H]} />
        <meshStandardMaterial map={textures.side} bumpMap={textures.side} {...printMat} />
      </mesh>
      <mesh position={[0, LID_Y + LID_T / 2 + LIFT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TOP_W, TOP_H]} />
        <meshStandardMaterial map={textures.top} bumpMap={textures.top} {...printMat} />
      </mesh>
    </>
  );
}

function Box({ edition }: { edition: Edition }) {
  const rig = useRef<THREE.Group>(null);
  const box = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Group>(null);
  const sweep = useRef<THREE.DirectionalLight>(null);
  const body = useRef<THREE.MeshPhysicalMaterial>(null);
  const lid = useRef<THREE.MeshPhysicalMaterial>(null);
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
    g.visible = p > 0.025;
    const sx = kf(p, [[0.03, 0.5], [0.16, 1]], easeOut);
    const sy = kf(p, [[0.03, 0.012], [0.15, 1]], easeInOut);
    const sz = kf(p, [[0.03, 0.04], [0.15, 1]], easeInOut);
    g.scale.set(sx, sy, sz);
    const glow = kf(p, [[0.03, 3], [0.12, 1.4], [0.28, 0]], easeOut);
    if (body.current) body.current.emissiveIntensity = glow;
    if (lid.current) lid.current.emissiveIntensity = glow * 0.8;

    // the turn: three quarters, from edge-on through the back to the front; then a rest angle
    const turn = kf(p, [[0.04, Math.PI * 1.5], [0.46, 0]], easeInOut);
    const rest = kf(p, [[0.46, 0], [0.86, -0.3]], easeInOut);
    const idle = s.still ? 0 : Math.sin(t * 0.35) * 0.03 * kf(p, [[0.5, 0], [0.7, 1]]);
    b.rotation.set(0.03 + s.tilt + Math.sin(t * 0.5) * 0.012, turn + rest + s.spin + idle, Math.sin(t * 0.37) * 0.008);

    // where it hangs, then where it lands
    const float = Math.sin(t * 0.8) * 0.04 * kf(p, [[0.6, 1], [0.84, 0]]);
    g.position.y = kf(p, [[0.03, 0.25], [0.32, -0.15], [0.62, -0.35], [0.86, BOX_LANDED_Y]], easeInOut) + float;

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
          {/* the card: a satin finish that takes a soft highlight; the lid a coated board, glossier */}
          <RoundedBox args={[W, H, D]} radius={RADIUS} smoothness={4} receiveShadow>
            <meshPhysicalMaterial ref={body} color={SAND} emissive={GLOW} emissiveIntensity={0} roughness={0.5} metalness={0} clearcoat={0.4} clearcoatRoughness={0.4} sheen={0.35} sheenRoughness={0.6} sheenColor="#f4e2c4" envMapIntensity={0.85} />
          </RoundedBox>
          <RoundedBox args={[W + OVER * 2, LID_T, D + OVER * 2]} radius={RADIUS} smoothness={4} position={[0, LID_Y, 0]} castShadow receiveShadow>
            <meshPhysicalMaterial ref={lid} color={LID} emissive={GLOW} emissiveIntensity={0} roughness={0.26} metalness={0} clearcoat={0.85} clearcoatRoughness={0.16} envMapIntensity={1.3} />
          </RoundedBox>
          <mesh position={[0, H / 2 - 0.016, 0]}>
            <boxGeometry args={[W + 0.004, 0.012, D + 0.004]} />
            <meshStandardMaterial color={SEAM} roughness={0.9} />
          </mesh>
          {textures && <Print textures={textures} />}
        </group>
      </group>
      <group ref={shadow} position={[0, PED_TOP + 0.012, 0]} visible={false}>
        <ContactShadows scale={[5.2, 3.6]} opacity={0.6} blur={2.2} far={1.6} resolution={512} color="#0a0705" />
      </group>
    </>
  );
}

/** a picture cropped to cover its frame (the textures are shared, so each frame gets its own copy) */
function cover(tex: THREE.Texture, frameRatio: number) {
  const t = tex.clone();
  const img = tex.image as { width?: number; height?: number } | undefined;
  const ir = img && img.width && img.height ? img.width / img.height : 1;
  t.repeat.set(1, 1);
  t.offset.set(0, 0);
  if (ir > frameRatio) {
    t.repeat.x = frameRatio / ir;
    t.offset.x = (1 - t.repeat.x) / 2;
  } else {
    t.repeat.y = ir / frameRatio;
    t.offset.y = (1 - t.repeat.y) / 2;
  }
  t.needsUpdate = true;
  return t;
}

/** The gallery: portrait frames on a dark wall, each at its own depth, drifting up as the film moves on. */
function Gallery({ phone }: { phone: boolean }) {
  const specs = phone ? PHONE_GALLERY : GALLERY;
  const maps = useTexture(SOURCES, (loaded) => {
    for (const m of Array.isArray(loaded) ? loaded : [loaded]) {
      m.colorSpace = THREE.SRGBColorSpace;
      m.anisotropy = 4;
      m.needsUpdate = true;
    }
  });
  const crops = useMemo(() => {
    const byIndex = new Map<number, THREE.Texture>();
    return specs.map((s) => {
      const i = SOURCES.indexOf(s.src);
      let t = byIndex.get(i);
      if (!t) {
        t = cover(maps[i], FRAME_W / FRAME_H);
        byIndex.set(i, t);
      }
      return t;
    });
  }, [specs, maps]);
  useEffect(() => () => new Set(crops).forEach((t) => t.dispose()), [crops]);
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    const p = fbox.progress;
    const fade = kf(p, [[0.1, 0], [0.32, 1], [0.6, 1], [0.8, 0]], easeInOut);
    const grow = kf(p, [[0.1, 0.8], [0.44, 1]], easeOut);
    const lift = kf(p, [[0.34, 0], [0.86, 1]], easeInOut);
    const k = phone ? 0.82 : 1;
    specs.forEach((s, i) => {
      const g = refs.current[i];
      if (!g) return;
      // they open outward and drift up as the film moves on, the nearer ones faster
      const spread = 1 + lift * 0.18 + (1 - grow) * 0.25;
      g.position.set(s.x * spread * k, (s.y + lift * s.drift * 2.6) * k, s.z);
      g.lookAt(0, g.position.y * 0.6, 14);
      g.scale.setScalar(grow * k);
      g.visible = fade > 0.01;
      const [card, pic] = g.children as THREE.Mesh[];
      (card.material as THREE.MeshStandardMaterial).opacity = fade;
      (pic.material as THREE.MeshBasicMaterial).opacity = fade * s.dim;
    });
  });
  return (
    <>
      {specs.map((s, i) => (
        <group
          key={`${s.src}-${i}`}
          ref={(g) => {
            refs.current[i] = g;
          }}
        >
          {/* the card the picture sits on: near-black, a touch of sheen */}
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[FRAME_W + 0.06, FRAME_H + 0.06]} />
            <meshStandardMaterial color="#141110" roughness={0.6} metalness={0.3} transparent opacity={0} depthWrite={false} />
          </mesh>
          {/* the picture: warm, dimmed and a touch desaturated by the tint; unlit so it reads the same at any angle */}
          <mesh>
            <planeGeometry args={[FRAME_W, FRAME_H]} />
            <meshBasicMaterial map={crops[i]} color="#b7a897" transparent opacity={0} toneMapped={false} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** The plinth: a polished plate on a dark slab on a black base, standing on the floor. */
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
        <MeshReflectorMaterial color="#4a4542" metalness={0.7} roughness={0.35} mirror={0.6} mixBlur={1} mixStrength={1.1} blur={[220, 70]} resolution={512} depthScale={0.5} minDepthThreshold={0.7} maxDepthThreshold={1.5} />
      </mesh>
      <mesh position={[0, PED_TOP - PLATE_T / 2, 0]}>
        <boxGeometry args={[PED_W, PLATE_T, PED_D]} />
        <meshStandardMaterial color="#56504c" metalness={0.8} roughness={0.28} envMapIntensity={1.3} />
      </mesh>
      <mesh position={[0, PED_TOP - PLATE_T - SLAB_T / 2, 0]}>
        <boxGeometry args={[PED_W, SLAB_T, PED_D]} />
        <meshStandardMaterial color="#1e1b19" metalness={0.5} roughness={0.5} envMapIntensity={0.6} />
      </mesh>
      {/* a hairline of light between slab and base, like a joint in the stone */}
      <mesh position={[0, PED_TOP - PLATE_T - SLAB_T - JOINT_T / 2, 0]}>
        <boxGeometry args={[PED_W - 0.02, JOINT_T, PED_D - 0.02]} />
        <meshStandardMaterial color="#6e6660" metalness={0.85} roughness={0.28} />
      </mesh>
      <mesh position={[0, FLOOR_Y + BASE_T / 2, 0]}>
        <boxGeometry args={[PED_W, BASE_T, PED_D]} />
        <meshStandardMaterial color="#0d0b0a" metalness={0.3} roughness={0.7} envMapIntensity={0.4} />
      </mesh>
    </group>
  );
}

// the cone of light, as haze would show it: soft at the edges (fresnel), brightest near the lamp, gone by the plinth
const CONE_VERT = /* glsl */ `
  varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const CONE_FRAG = /* glsl */ `
  uniform float uOpacity; uniform vec3 uColor;
  varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  void main() {
    // no pow(): pow(0, y) is NaN on some GPUs, and one NaN pixel spreads through the bloom
    float e = abs(dot(normalize(vN), normalize(vV)));
    float edge = e * e;
    float fall = vUv.y * vUv.y;
    gl_FragColor = vec4(uColor, clamp(uOpacity * edge * fall, 0.0, 1.0));
  }`;

/** The room: a dark glossy floor (in once the night has fallen) and a cone of light over the plinth. */
function Room() {
  const floor = useRef<THREE.Mesh>(null);
  const cone = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uOpacity: { value: 0 }, uColor: { value: new THREE.Color("#ffd9a8") } }), []);
  useFrame(() => {
    const p = fbox.progress;
    // the floor: half-there behind the turn, full under the showcase
    if (floor.current) (floor.current.material as THREE.Material).opacity = kf(p, [[0.1, 0], [0.24, 0.45], [0.62, 0.45], [0.86, 1]]);
    if (cone.current) cone.current.uniforms.uOpacity.value = kf(p, [[0.72, 0], [0.94, 0.5]]);
  });
  return (
    <>
      <mesh ref={floor} position={[0, FLOOR_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 80]} />
        <MeshReflectorMaterial color="#070504" metalness={0.5} roughness={0.8} mirror={0.45} mixBlur={1} mixStrength={1.3} blur={[500, 140]} resolution={512} depthScale={1.2} minDepthThreshold={0.85} maxDepthThreshold={1.6} transparent opacity={0} />
      </mesh>
      <mesh position={[0.2, PED_TOP + 5.5, 0.1]}>
        <coneGeometry args={[2.7, 11, 64, 1, true]} />
        <shaderMaterial ref={cone} vertexShader={CONE_VERT} fragmentShader={CONE_FRAG} uniforms={uniforms} transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

/** The lights: a close spot as the key (gradients, a shadow under the lid), a rim from behind, a burgundy glow low behind. */
function Mood() {
  const red = useRef<THREE.PointLight>(null);
  const key = useRef<THREE.SpotLight>(null);
  const lamp = useRef<THREE.PointLight>(null);
  const target = useMemo(() => {
    const t = new THREE.Object3D();
    t.position.set(0.6, -0.5, 0.4);
    return t;
  }, []);
  useFrame(() => {
    const p = fbox.progress;
    if (red.current) red.current.intensity = kf(p, [[0.1, 0], [0.32, 4], [0.86, 1]]);
    if (key.current) key.current.intensity = kf(p, [[0, 40], [0.3, 160], [0.84, 190]]);
    // the showcase lamp: a warm light over the plinth once it has arrived
    if (lamp.current) lamp.current.intensity = kf(p, [[0.64, 0], [0.88, 14]]);
  });
  return (
    <>
      <primitive object={target} />
      <spotLight
        ref={key}
        position={[-4.5, 6.5, 5.5]}
        target={target}
        angle={0.42}
        penumbra={0.8}
        intensity={40}
        decay={1.6}
        distance={30}
        color="#ffe6c6"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <pointLight ref={lamp} position={[0.6, 1.4, 3.4]} intensity={0} color="#ffe6c8" distance={9} decay={1.8} />
      {/* the rim: from behind and the right, so the lid's edge and the box's silhouette read against the dark */}
      <directionalLight position={[5, 4, -6]} intensity={3.2} color="#fff6ea" />
      <directionalLight position={[-6, 1, -3]} intensity={0.7} color="#c9d6ff" />
      <pointLight ref={red} position={[0, -3.4, -7]} intensity={0} color="#8a1414" distance={16} decay={1.6} />
    </>
  );
}

/** The grade: bloom on the highlights, the far frames soft, a vignette and a little grain. */
function Grade() {
  return (
    <EffectComposer multisampling={4} frameBufferType={THREE.HalfFloatType}>
      <Bloom intensity={0.55} luminanceThreshold={0.82} luminanceSmoothing={0.3} mipmapBlur radius={0.6} />
      <DepthOfField target={[0, -0.6, 0]} worldFocusRange={7} bokehScale={2.6} />
      <Vignette eskil={false} offset={0.22} darkness={0.62} />
      <Noise opacity={0.045} blendFunction={BlendFunction.OVERLAY} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

function Scene({ edition, phone }: { edition: Edition; phone: boolean }) {
  return (
    <>
      <Driver />
      <Rig />
      <fog attach="fog" args={["#0c0908", 14, 36]} />
      <Suspense fallback={null}>
        {/* a dark studio: a big softbox above and behind the camera (the lid reflects it), a long warm
            strip behind right for the rim, a faint cool strip left. Nothing else is in the room. */}
        <Environment resolution={256} frames={1}>
          <color attach="background" args={["#0a0807"]} />
          <Lightformer form="rect" intensity={6} color="#fff1dc" position={[-2, 9, 13]} scale={[14, 6, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={5} color="#ffd9b0" position={[7, 3, -5]} scale={[1.2, 9, 1]} target={[0, 0, 0]} />
          <Lightformer form="rect" intensity={0.8} color="#dce6ff" position={[-8, 0.5, -3]} scale={[1, 6, 1]} target={[0, 0, 0]} />
        </Environment>
        <Gallery phone={phone} />
        <Prewarm name="fbox" />
      </Suspense>
      <Room />
      <Box edition={edition} />
      <Pedestal />
      <Mood />
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
        shadows="percentage"
        camera={{ fov: FOV, near: 0.1, far: 60, position: [0, 0.6, 14.5] }}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping }}
        style={{ touchAction: "pan-y" }}
      >
        <Scene edition={edition} phone={phone} />
      </Canvas>
    </div>
  );
}

useTexture.preload(SOURCES);
