// The Reach's shaders: the spark between the fingertips, the dust in the light, and a patch for the
// AUVOX hand's lacquer so its forearm dissolves toward the elbow and a warm rim lights it in the red.

/** A soft glow that always faces the camera (the spark between the fingertips). */
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

/** Motes of dust drifting up through the light. */
export const DUST_VERT = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uSpan;
  uniform float uPx;
  varying float vSeed;
  void main() {
    vec3 p = position;
    p.y = mod(p.y + uTime * (0.04 + aSeed * 0.1) + uSpan * 0.5, uSpan) - uSpan * 0.5;
    p.x += sin(uTime * 0.3 + aSeed * 40.0) * 0.12;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (0.6 + aSeed * 1.6) * uPx / -mv.z;
    gl_Position = projectionMatrix * mv;
    vSeed = aSeed;
  }
`;
export const DUST_FRAG = /* glsl */ `
  precision highp float;
  uniform float uOpacity;
  uniform vec3 uColor;
  varying float vSeed;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.0, 1.0, r)) * uOpacity * (0.35 + vSeed * 0.65);
    gl_FragColor = vec4(uColor * a, a);
  }
`;

type Shader = { vertexShader: string; fragmentShader: string; uniforms: Record<string, unknown> };

/**
 * Patches a MeshPhysicalMaterial: the forearm dissolves (dithered, with a little noise) between local
 * x = uFadeA and uFadeB — the model runs from the fingertips at +0.17 to the end of the forearm at
 * about -0.29 — and a fresnel rim of uRimColor is added, scaled by uRim.
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
      uniform vec3 uRimColor;
      float armHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float armNoise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(armHash(i), armHash(i + vec3(1, 0, 0)), f.x), mix(armHash(i + vec3(0, 1, 0)), armHash(i + vec3(1, 1, 0)), f.x), f.y),
          mix(mix(armHash(i + vec3(0, 0, 1)), armHash(i + vec3(1, 0, 1)), f.x), mix(armHash(i + vec3(0, 1, 1)), armHash(i + vec3(1, 1, 1)), f.x), f.y),
          f.z);
      }`,
    )
    .replace(
      "#include <clipping_planes_fragment>",
      /* glsl */ `#include <clipping_planes_fragment>
      float armN = armNoise(vArm * 60.0) * 0.6 + armNoise(vArm * 170.0) * 0.4;
      float armFade = smoothstep(uFadeA, uFadeB, vArm.x + (armN - 0.5) * 0.08);
      float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      if (armFade < dither * 0.98 + 0.01) discard;`,
    )
    .replace(
      "#include <opaque_fragment>",
      /* glsl */ `float rimF = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.5);
      outgoingLight += uRimColor * rimF * uRim;
      #include <opaque_fragment>`,
    );
}
