// The Reach's shaders: the fog we start in (the veil), the sun's rays, the spark between the
// fingertips, the motes in the light, the lacquer patch for the AUVOX hand (its forearm fades into
// the cloud and a warm rim lights it) and the crimson grade that runs out from the touch.

const NOISE = /* glsl */ `
  float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = m * p; a *= 0.5; }
    return v;
  }
`;

/** a quad that always fills the screen (clip space straight through) */
export const SCREEN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/**
 * The veil: bright, slowly moving fog in front of everything. uFog is its density; it thins around
 * uClear (the hand) and glows at uLight (the sun somewhere below, in the fog). Premultiplied alpha,
 * so the glow adds light beyond the fog's own cover.
 */
export const VEIL_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uAspect;
  uniform float uFog;
  uniform float uLight;
  uniform vec2 uLightPos;
  uniform vec2 uClear;
  uniform float uClearR;
  uniform vec3 uCream;
  uniform vec3 uPeach;
  ${NOISE}
  void main() {
    vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
    vec2 drift = vec2(uTime * 0.02, -uTime * 0.013);
    float n1 = fbm(q * 2.6 + drift);
    float n2 = fbm(q * 6.0 - drift * 1.6 + 3.1);
    float n = n1 * 0.65 + n2 * 0.35;
    float edge = dot(q, q);
    // the cover: thicker toward the top and the edges, thinner in the middle
    float shape = 0.7 + 0.3 * vUv.y + 0.25 * edge;
    float density = uFog * shape * (0.45 + 0.8 * n);
    // it parts around the hand
    vec2 c = (uClear - 0.5) * vec2(uAspect, 1.0);
    float clear = exp(-dot(q - c, q - c) / max(uClearR * uClearR, 0.0001));
    density *= 1.0 - 0.82 * clear * uFog;
    float alpha = smoothstep(0.03, 1.0, density) * 0.96;
    // the light below, seen through the fog
    vec2 l = (uLightPos - 0.5) * vec2(uAspect, 1.0);
    float dl = dot(q - l, q - l);
    float glow = exp(-dl * 2.4);
    float halo = exp(-dl * 0.7);
    // folds of the fog: lit cream where it is thin and bright, a deeper tan in the shadowed folds
    float structure = smoothstep(0.36, 0.66, n);
    float lit = clamp(structure * 0.85 + 0.1 * (1.0 - min(edge, 1.0)) - 0.14 * vUv.y + halo * 0.18 * uLight, 0.0, 1.0);
    vec3 col = mix(uPeach, uCream, lit);
    vec3 light = (vec3(1.0, 0.98, 0.94) * glow * 1.25 + vec3(1.0, 0.96, 0.9) * halo * 0.28) * uLight;
    gl_FragColor = vec4(col * alpha + light, alpha);
  }
`;

/** the veil on a plane in the world (behind the hand) */
export const VEIL_WORLD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** The sun's rays: streaks of light turning slowly about uSun, falling down through the scene. */
export const RAYS_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
export const RAYS_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uAspect;
  uniform vec2 uSun;
  uniform float uPower;
  uniform vec3 uColor;
  void main() {
    vec2 q = (vUv - uSun) * vec2(uAspect, 1.0);
    float dist = length(q);
    float ang = atan(q.y, q.x) / 6.2831853 + 0.5;
    float t = uTime * 0.045;
    float r = 0.5
      + 0.26 * sin(ang * 6.2831853 * 7.0 + t * 1.7)
      + 0.2 * sin(ang * 6.2831853 * 19.0 - t * 2.6 + 1.3)
      + 0.14 * sin(ang * 6.2831853 * 43.0 + t * 1.1 + 2.0)
      + 0.1 * sin(ang * 6.2831853 * 97.0 - t * 3.0);
    float rays = pow(clamp(r, 0.0, 1.0), 3.2);
    float fall = exp(-dist * 1.35);
    // strongest below the sun
    float down = 0.35 + 0.65 * smoothstep(-0.3, 0.7, -q.y / max(dist, 0.001));
    float core = exp(-dist * dist * 9.0) * 0.35;
    float a = (rays * fall * down + core) * uPower;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

/** A soft glow that always faces the camera (the spark between the fingertips, the sun). */
export const SPARK_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
export const SPARK_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uPower;
  uniform vec3 uColor;
  void main() {
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;
    float g = exp(-r * r * 14.0) + 0.3 * exp(-r * 4.0);
    // a faint four-point star, like light on a lens
    float star = exp(-abs(c.x) * 70.0) * exp(-abs(c.y) * 4.0) + exp(-abs(c.y) * 70.0) * exp(-abs(c.x) * 4.0);
    float a = (g + star * 0.45) * (1.0 - smoothstep(0.8, 1.0, r)) * uPower;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

/** Motes drifting up through the light. */
export const MOTE_VERT = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uSpan;
  uniform float uPx;
  varying float vSeed;
  void main() {
    vec3 p = position;
    p.y = mod(p.y + uTime * (0.05 + aSeed * 0.12) + uSpan * 0.5, uSpan) - uSpan * 0.5;
    p.x += sin(uTime * 0.25 + aSeed * 40.0) * 0.25;
    p.z += cos(uTime * 0.2 + aSeed * 23.0) * 0.15;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (0.8 + aSeed * 2.4) * uPx / -mv.z;
    gl_Position = projectionMatrix * mv;
    vSeed = aSeed;
  }
`;
export const MOTE_FRAG = /* glsl */ `
  precision highp float;
  uniform float uOpacity;
  uniform float uTime;
  uniform vec3 uColor;
  varying float vSeed;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float twinkle = 0.65 + 0.35 * sin(uTime * (1.5 + vSeed * 3.0) + vSeed * 50.0);
    float a = pow(1.0 - smoothstep(0.0, 1.0, r), 1.6) * uOpacity * (0.35 + vSeed * 0.65) * twinkle;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

type Shader = { vertexShader: string; fragmentShader: string; uniforms: Record<string, unknown> };

/**
 * Patches the AUVOX hand's MeshPhysicalMaterial: the forearm fades out smoothly between local
 * x = uFadeA and uFadeB (the model runs from the fingertips at +0.17 to the end of the forearm at
 * about -0.29), and a fresnel rim of uRimColor is added, scaled by uRim. The material must be transparent.
 */
export function patchArm(shader: Shader, uniforms: Record<string, unknown>) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vArm;")
    .replace("#include <morphtarget_vertex>", "#include <morphtarget_vertex>\nvArm = transformed;");
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      /* glsl */ `#include <common>
      varying vec3 vArm;
      uniform float uFadeA;
      uniform float uFadeB;
      uniform float uRim;
      uniform vec3 uRimColor;`,
    )
    .replace(
      "#include <alphamap_fragment>",
      /* glsl */ `#include <alphamap_fragment>
      float armFade = smoothstep(uFadeA, uFadeB, vArm.x);
      armFade = armFade * armFade * (3.0 - 2.0 * armFade);
      if (armFade < 0.004) discard;
      diffuseColor.a *= armFade;`,
    )
    .replace(
      "#include <opaque_fragment>",
      /* glsl */ `float rimF = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.6);
      outgoingLight += uRimColor * rimF * uRim;
      #include <opaque_fragment>`,
    );
}

/**
 * The crimson grade (a postprocessing Effect): inside a circle of uRadius about uCenter (screen uv)
 * the picture is remapped to deep red — shadows almost black-red, mids AUVOX red, highlights a warm
 * pink — a bright crest rides the circle's edge, and uFlash whites the fingertips at the touch.
 */
export const GRADE_FRAG = /* glsl */ `
  uniform vec2 uCenter;
  uniform float uRadius;
  uniform float uRed;
  uniform float uFlash;
  uniform float uAspect;
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 d = (uv - uCenter) * vec2(uAspect, 1.0);
    float dist = length(d);
    float inside = 1.0 - smoothstep(uRadius - 0.14, uRadius + 0.02, dist);
    float k = inside * uRed;
    vec3 c = inputColor.rgb;
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    vec3 deep = vec3(0.09, 0.004, 0.008);
    vec3 red = vec3(0.56, 0.035, 0.04);
    vec3 hi = vec3(1.0, 0.72, 0.64);
    vec3 crimson = mix(deep, red, smoothstep(0.03, 0.58, l));
    crimson = mix(crimson, hi, smoothstep(0.64, 1.0, l));
    // keep a breath of the original hue in the mids
    crimson = mix(crimson, c * vec3(1.0, 0.3, 0.26), 0.12);
    c = mix(c, crimson, k);
    float crest = exp(-pow((dist - uRadius) / 0.07, 2.0)) * uRed * step(0.002, uRadius) * (1.0 - smoothstep(1.6, 2.4, uRadius));
    c += crest * vec3(1.0, 0.78, 0.6) * 0.8;
    c += uFlash * vec3(1.0, 0.96, 0.9) * exp(-dist * 2.6);
    outputColor = vec4(c, inputColor.a);
  }
`;
