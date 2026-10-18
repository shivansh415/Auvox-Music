// The record, drawn in one fragment shader: lacquer and fine grooves cut by a lathe, five track gaps,
// the paper label, the dashed orbit with its drifting beads, the pucks the verses stand on, and the
// light. The light is what sells vinyl: a narrow anisotropic streak that runs through the centre
// toward the light, sparkling on the grooves. Here the light follows the pointer, waves from every
// note run out through the grooves, and the groove behind the stylus glows as it plays.
//
// Units: `vP` is in record radii (the rim is 1), y up. Things that turn with the record are sampled in
// `lp` (the point counter-rotated by uAngle); the light, the stylus and the waves stay in screen space.

export const VINYL_VERT = /* glsl */ `
  uniform float uR;
  varying vec2 vP;
  void main() {
    vP = position.xy / uR;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const VINYL_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vP;

  uniform float uAngle;   // record rotation, radians, clockwise on screen
  uniform float uDrift;   // the beads' rotation, radians
  uniform float uReveal;  // 0-1, the grooves being cut outward
  uniform float uEnter;   // 0-1, pucks and beads
  uniform float uLevel;   // 0-1, the site's audio level
  uniform float uMotor;   // 0-1, platter speed
  uniform vec2 uLight;    // unit vector toward the light, screen space
  uniform float uLabelR;
  uniform float uOrbitR;
  uniform float uPuckR;
  uniform vec4 uNodes[2];       // x, y, hover 0-1, active 0/1
  uniform vec4 uRipples[6];     // x, y, age (s), strength
  uniform vec3 uRippleTone[6];
  uniform vec4 uStylus;         // x, y, down 0-1, arm visible 0/1
  uniform vec2 uPivot;

  const vec3 INK = vec3(0.071, 0.066, 0.062);
  const vec3 CREAM = vec3(0.992, 0.949, 0.890);
  const vec3 PEACH = vec3(0.980, 0.890, 0.773);
  const vec3 TAN = vec3(0.906, 0.706, 0.494);
  const vec3 DEEP = vec3(0.871, 0.722, 0.525);
  const vec3 RED = vec3(0.522, 0.035, 0.035);
  const vec3 WARM = vec3(1.0, 0.89, 0.74);
  const float TAU = 6.2831853;

  const float BEAD_A[9] = float[9](4.0, 47.0, 82.0, 131.0, 161.0, 213.0, 246.0, 290.0, 327.0);
  const float BEAD_S[9] = float[9](0.0075, 0.011, 0.006, 0.009, 0.0105, 0.006, 0.0075, 0.011, 0.006);

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  // 1 on a thin ring of half-width w around c, antialiased over aa
  float band(float x, float c, float w, float aa) {
    return 1.0 - smoothstep(w, w + aa, abs(x - c));
  }
  float segDist(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
  }

  void main() {
    vec2 p = vP;
    float r = length(p);
    float aa = fwidth(r);
    float alpha = 1.0 - smoothstep(1.0 - aa, 1.0, r);
    if (alpha <= 0.0) discard;

    float c = cos(uAngle);
    float s = sin(uAngle);
    vec2 lp = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    float lth = atan(lp.y, lp.x);
    vec2 dir = p / max(r, 1e-4);
    float onVinyl = step(uLabelR, r);

    // ---- waves from the notes, running out through the grooves
    float wave = 0.0;
    vec3 waveCol = vec3(0.0);
    for (int i = 0; i < 6; i++) {
      vec4 q = uRipples[i];
      if (q.w <= 0.0) continue;
      float d = distance(p, q.xy);
      float x = d - q.z * 0.8;
      float env = exp(-x * x * 55.0) * q.w * exp(-q.z * 1.05) * smoothstep(0.0, 0.12, q.z);
      wave += sin(x * 95.0) * env;
      waveCol += uRippleTone[i] * env;
    }

    // ---- the cut: lead-in from the label, five tracks, the rim
    float rr = r + wave * 0.005;
    float gaps = band(r, 0.452, 0.0035, aa);
    gaps = max(gaps, band(r, 0.561, 0.0035, aa));
    gaps = max(gaps, band(r, 0.668, 0.0035, aa));
    gaps = max(gaps, band(r, 0.786, 0.0035, aa));
    gaps = max(gaps, band(r, 0.884, 0.0035, aa));
    float cut = mix(0.33, 1.03, uReveal);
    float zone = smoothstep(0.34, 0.348, r) * (1.0 - smoothstep(0.958, 0.962, r));
    zone *= (1.0 - gaps) * (1.0 - smoothstep(cut - 0.02, cut, r));

    float g = rr * 170.0 + (vnoise(lp * 2.5) - 0.5) * 0.6;
    float gw = fwidth(g);
    float groove = 0.5 + 0.5 * cos(TAU * g);
    groove = mix(groove, 0.5, clamp(gw * 1.2 - 0.2, 0.0, 1.0));
    // louder passages are cut wider and catch more light: the music, visible in the vinyl
    float loud = 0.5 + 0.5 * vnoise(vec2(rr * 38.0, lth * 2.0));

    vec3 col = INK * 0.82;
    col += vec3(0.022) * groove * zone;

    // ---- light
    float lobe = abs(dot(dir, uLight));
    float streak = pow(lobe, mix(14.0, 60.0, smoothstep(0.3, 1.0, r)));
    float wide = pow(lobe, 4.0);
    vec3 sheen = mix(TAN, WARM, groove);
    col += sheen * streak * zone * (0.16 + 0.5 * groove) * loud;
    col += WARM * wide * 0.03 * zone;
    float smoothArea = (1.0 - zone) * onVinyl;
    col += WARM * (streak * 0.1 + wide * 0.018) * smoothArea;
    vec2 kp = p - vec2(-0.45, 0.5);
    col += WARM * 0.045 * exp(-dot(kp, kp) * 2.5);

    // the lathe's cutting edge while the grooves are being cut
    float cutting = step(0.001, uReveal) * (1.0 - step(0.999, uReveal));
    col += TAN * exp(-pow((r - cut) / 0.008, 2.0)) * 0.6 * cutting * step(r, 0.97);

    // the music and its waves
    col += sheen * zone * groove * uLevel * 0.08;
    col += waveCol * (0.2 + 0.8 * groove) * 0.55 * onVinyl;

    // dust
    vec2 dc = floor(lp * 260.0);
    col += WARM * step(0.9965, hash(dc)) * hash(dc + 3.1) * 0.18 * onVinyl;

    // rim: a lip of light, darker toward the edge
    col *= mix(1.0, 0.72, smoothstep(0.86, 1.0, r));
    col += WARM * band(r, 0.986, 0.003, aa) * (0.05 + 0.12 * wide);

    // ---- the orbit the verses ride (dashed, turns with the record) and its two guide rings
    float dash = step(0.7, fract(lth / TAU * 96.0));
    col = mix(col, TAN, band(r, uOrbitR, 0.0012, aa * 1.2) * dash * 0.5 * uEnter);
    col = mix(col, CREAM, band(r, uOrbitR + 0.084, 0.0008, aa) * 0.07);
    col = mix(col, CREAM, band(r, uOrbitR - 0.084, 0.0008, aa) * 0.07);

    // beads sliding back along the groove
    for (int i = 0; i < 9; i++) {
      float a = -(BEAD_A[i] * 0.0174533 + uDrift);
      vec2 bp = vec2(cos(a), sin(a)) * uOrbitR;
      float d = distance(p, bp);
      float br = BEAD_S[i] * uEnter;
      col = mix(col, TAN, (1.0 - smoothstep(br - aa, br + aa, d)) * step(0.0001, br));
      col += TAN * exp(-d * d / max(br * br * 9.0, 1e-6)) * 0.25 * uEnter;
    }

    // ---- the pucks
    for (int i = 0; i < 2; i++) {
      vec4 n = uNodes[i];
      float pr = uPuckR * uEnter * (1.0 + 0.1 * n.z);
      if (pr < 0.001) continue;
      vec2 q = p - n.xy;
      float d = length(q);
      if (n.w > 0.5) {
        vec2 so = p - (n.xy + vec2(0.02, -0.035));
        float sh = exp(-pow(max(length(so) - pr * 0.8, 0.0) / (pr * 0.5), 2.0));
        col *= 1.0 - 0.6 * sh;
        float m = 1.0 - smoothstep(pr - aa, pr + aa, d);
        vec2 lq = q / pr;
        float ll = length(lq);
        float lit = clamp(1.0 - length(lq - vec2(-0.3, 0.35)) * 0.75, 0.0, 1.0);
        vec3 pc = mix(DEEP, CREAM, lit);
        pc = mix(pc, TAN, smoothstep(0.55, 1.0, ll) * 0.6);
        pc *= 1.0 - 0.18 * smoothstep(0.75, 1.0, ll);
        pc = mix(pc, RED, band(ll, 0.86, 0.012, aa / pr) * 0.25);
        col = mix(col, pc, m);
        col += TAN * band(d, pr + 0.035, 0.006, aa * 2.0) * 0.35 * n.z;
      } else {
        float da = atan(q.y, q.x) + uAngle;
        float dd = step(0.5, fract(da / TAU * 34.0));
        col = mix(col, CREAM, band(d, pr, 0.0016, aa * 1.2) * dd * 0.4);
        col += CREAM * 0.035 * (1.0 - smoothstep(pr - aa, pr, d));
      }
    }

    // ---- the paper label
    float lm = 1.0 - smoothstep(uLabelR - aa, uLabelR + aa, r);
    if (lm > 0.0) {
      vec2 lq = p / uLabelR;
      float t = clamp(length(lq - vec2(-0.25, 0.3)) / 1.35, 0.0, 1.0);
      vec3 lc = mix(PEACH, TAN, smoothstep(0.0, 0.65, t));
      lc = mix(lc, DEEP, smoothstep(0.65, 1.0, t));
      float lr = r / uLabelR;
      float la = aa / uLabelR;
      lc = mix(lc, INK, band(lr, 0.99, 0.012, la) * 0.35);
      lc = mix(lc, RED, band(lr, 0.93, 0.006, la) * 0.4);
      lc = mix(lc, RED, band(lr, 0.885, 0.002, la) * 0.18);
      lc *= 0.97 + 0.03 * vnoise(lp * 90.0);
      lc += WARM * uLevel * 0.08;
      lc += WARM * pow(lobe, 6.0) * 0.05;
      col = mix(col, lc, lm);
    }

    // ---- the instruments' soft shadows on their pucks
    for (int i = 0; i < 2; i++) {
      vec4 n = uNodes[i];
      if (n.w < 0.5) continue;
      vec2 so = p - (n.xy + vec2(0.035, -0.055) * (1.0 + n.z * 0.8));
      float pr = uPuckR * uEnter * 0.62;
      col *= 1.0 - 0.28 * exp(-dot(so, so) / max(pr * pr, 1e-6)) * uEnter;
    }

    // ---- the tonearm's shadow, softer and further off the higher it is
    if (uStylus.w > 0.5) {
      float lift = 1.0 - uStylus.z;
      vec2 off = vec2(0.025, -0.045) * (1.0 + lift * 1.6);
      float soft = 0.03 + lift * 0.05;
      float sd = segDist(p - off, uPivot, uStylus.xy);
      float sh = 1.0 - smoothstep(0.012 + lift * 0.01, 0.012 + lift * 0.01 + soft, sd);
      float hs = 1.0 - smoothstep(0.03, 0.03 + soft, distance(p - off, uStylus.xy));
      col *= 1.0 - max(sh, hs) * (0.5 - lift * 0.22);

      // the stylus in the groove: a warm point, and the groove it has just played glowing behind it
      float down = uStylus.z;
      float sr = length(uStylus.xy);
      float behind = mod(atan(uStylus.y, uStylus.x) - atan(p.y, p.x), TAU);
      col += TAN * band(r, sr, 0.0018, aa) * exp(-behind * 1.4) * down * (0.25 + 0.75 * uMotor) * 0.9;
      vec2 sp = p - uStylus.xy;
      col += WARM * exp(-dot(sp, sp) / 0.0005) * 0.45 * down;
    }

    gl_FragColor = vec4(col, alpha);
  }
`;

/** A soft contact shadow under the record. `vP` is in record radii. */
export const SHADOW_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vP;
  uniform float uStrength;
  void main() {
    float d = length(vP * vec2(1.0, 1.08));
    float a = 1.0 - smoothstep(0.55, 1.32, d);
    gl_FragColor = vec4(0.12, 0.07, 0.04, a * a * 0.55 * uStrength);
  }
`;
