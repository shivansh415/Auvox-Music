// The box's printed faces, painted at runtime into 2D canvases and used as transparent CanvasTextures
// (ink only; the sand board underneath is the box material — the ink is a gold foil in the scene).
// Matched to the client's reference box, which stands upright, 15 wide × 10 tall × 5 deep:
// front: the X monogram, AUVOX MUSIC, "FORGED IN FREQUENCY" between two rules, a hairline with a
// waveform at its centre, and the edition in small type. Side: four pillars, each an icon over its
// name, with hairlines between — Musical Instruments, Digital Production, Chromatic Flux, Harmonic
// Veil. Lid: the monogram, small. Plus a procedural paper grain for the board.

import * as THREE from "three";

/** the ink: painted in a light gold; the foil material in the scene gives it its metal */
export const INK = "#e2bb74";

export type Edition = "guitar" | "piano";

export type PrintTextures = {
  front: THREE.CanvasTexture;
  side: THREE.CanvasTexture;
  top: THREE.CanvasTexture;
  dispose: () => void;
};

type Ctx = CanvasRenderingContext2D;

/** A CSS font-family list from the first `--font-*` variable that resolves (next/font puts them on <html>), with a fallback. */
function familyFrom(variables: string[], fallback: string) {
  const cs = getComputedStyle(document.documentElement);
  for (const variable of variables) {
    const v = cs.getPropertyValue(variable).trim();
    if (v && !v.includes("var(")) return `${v}, ${fallback}`;
  }
  return fallback;
}

async function ready(fonts: string[]) {
  try {
    await Promise.all(fonts.map((f) => document.fonts.load(f)));
  } catch {
    // fall back to whatever is installed
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) throw new Error("2d context unavailable");
  return { c, g };
}

/** Draws `img` into a temp canvas and recolours its ink to `color` (source-in keeps only the glyph's alpha). */
function tinted(img: HTMLImageElement, w: number, h: number, color: string) {
  const { c, g } = canvas(Math.ceil(w), Math.ceil(h));
  g.drawImage(img, 0, 0, w, h);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Centre-aligned text with manual letter-spacing (works in every canvas, not just ones with ctx.letterSpacing). */
function tracked(g: Ctx, text: string, cx: number, y: number, tracking: number) {
  const chars = [...text];
  const widths = chars.map((ch) => g.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
  let x = cx - total / 2;
  g.textAlign = "left";
  chars.forEach((ch, i) => {
    g.fillText(ch, x, y);
    x += widths[i] + tracking;
  });
  return total;
}

function line(g: Ctx, x0: number, y0: number, x1: number, y1: number) {
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
}

/** A hairline with a small symmetric waveform rising and falling at its centre. */
function waveLine(g: Ctx, cx: number, cy: number, w: number, waveW: number, h: number, bars: number, stroke: number) {
  g.lineCap = "round";
  g.lineWidth = stroke;
  if (w > waveW) {
    line(g, cx - w / 2, cy, cx - waveW / 2 - stroke * 2, cy);
    line(g, cx + waveW / 2 + stroke * 2, cy, cx + w / 2, cy);
  }
  const step = waveW / (bars - 1);
  for (let i = 0; i < bars; i++) {
    const u = i / (bars - 1);
    const env = Math.sin(u * Math.PI);
    const ripple = 0.5 + 0.5 * Math.abs(Math.sin(u * Math.PI * 3.5));
    const hh = (h / 2) * Math.max(0.12, env * ripple);
    const x = cx - waveW / 2 + i * step;
    line(g, x, cy - hh, x, cy + hh);
  }
}

// ---------- the side's icons (drawn, in the reference's spirit)

function iconWave(g: Ctx, cx: number, cy: number, s: number) {
  waveLine(g, cx, cy, s * 1.1, s * 0.62, s * 0.9, 9, s * 0.055);
}

function iconEqualiser(g: Ctx, cx: number, cy: number, s: number) {
  // columns of dots rising to the middle and falling away, like a level meter
  const cols = 9;
  const heights = [2, 3, 5, 7, 9, 7, 5, 3, 2];
  const gap = s * 0.115;
  const r = s * 0.032;
  for (let c = 0; c < cols; c++) {
    const x = cx + (c - (cols - 1) / 2) * gap;
    for (let k = 0; k < heights[c]; k++) {
      const y = cy + s * 0.45 - k * gap;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }
}

function iconRings(g: Ctx, cx: number, cy: number, s: number) {
  g.lineCap = "butt";
  g.lineWidth = s * 0.05;
  const radii = [0.16, 0.3, 0.44];
  radii.forEach((k, i) => {
    const r = s * k;
    // each ring broken into arcs, offset from the last, so they read as a tuned coil
    const n = 3 + i;
    for (let a = 0; a < n; a++) {
      const start = (a / n) * Math.PI * 2 + i * 0.5;
      g.beginPath();
      g.arc(cx, cy, r, start, start + (Math.PI * 2) / n - 0.35);
      g.stroke();
    }
  });
  g.beginPath();
  g.arc(cx, cy, s * 0.05, 0, Math.PI * 2);
  g.fill();
}

function iconLotus(g: Ctx, cx: number, cy: number, s: number) {
  g.lineCap = "round";
  g.lineWidth = s * 0.04;
  // two layers of petals, the inner turned half a step
  for (let layer = 0; layer < 2; layer++) {
    const n = 8;
    const R = s * (layer ? 0.27 : 0.44);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (layer ? Math.PI / n : 0);
      g.save();
      g.translate(cx, cy);
      g.rotate(a);
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(R * 0.42, -R * 0.5, 0, -R);
      g.quadraticCurveTo(-R * 0.42, -R * 0.5, 0, 0);
      g.stroke();
      g.restore();
    }
  }
  g.beginPath();
  g.arc(cx, cy, s * 0.05, 0, Math.PI * 2);
  g.fill();
}

const PILLARS: { name: [string, string]; icon: (g: Ctx, cx: number, cy: number, s: number) => void }[] = [
  { name: ["MUSICAL", "INSTRUMENTS"], icon: iconWave },
  { name: ["DIGITAL", "PRODUCTION"], icon: iconEqualiser },
  { name: ["CHROMATIC", "FLUX"], icon: iconRings },
  { name: ["HARMONIC", "VEIL"], icon: iconLotus },
];

// ---------- faces

function paintFront(g: Ctx, W: number, H: number, mark: HTMLImageElement | null, sans: string, edition: Edition) {
  g.clearRect(0, 0, W, H);
  const cx = W / 2;
  g.fillStyle = INK;
  g.strokeStyle = INK;

  // the monogram
  const mh = H * 0.19;
  if (mark) {
    const mw = mh * (mark.naturalWidth / mark.naturalHeight || 1.116);
    g.drawImage(tinted(mark, mw, mh, INK), cx - mw / 2, H * 0.22);
  }

  // AUVOX MUSIC
  const ts = H * 0.064;
  g.font = `500 ${ts}px ${sans}`;
  g.textBaseline = "alphabetic";
  tracked(g, "AUVOX MUSIC", cx, H * 0.525, ts * 0.34);

  // — FORGED IN FREQUENCY —
  const ss = H * 0.027;
  g.font = `600 ${ss}px ${sans}`;
  const ry = H * 0.595;
  const tw = tracked(g, "FORGED IN FREQUENCY", cx, ry + ss * 0.36, ss * 0.5);
  g.lineWidth = Math.max(2, H * 0.0035);
  g.lineCap = "butt";
  const gap = ss * 1.1;
  const dash = W * 0.075;
  line(g, cx - tw / 2 - gap - dash, ry, cx - tw / 2 - gap, ry);
  line(g, cx + tw / 2 + gap, ry, cx + tw / 2 + gap + dash, ry);

  // the hairline with its waveform
  waveLine(g, cx, H * 0.665, W * 0.3, W * 0.075, H * 0.06, 17, Math.max(2, H * 0.0045));

  // the edition, small
  const es = H * 0.022;
  g.font = `500 ${es}px ${sans}`;
  tracked(g, edition === "guitar" ? "GUITAR VERSE EDITION" : "PIANO VERSE EDITION", cx, H * 0.76, es * 0.5);
}

function paintSide(g: Ctx, W: number, H: number, sans: string) {
  g.clearRect(0, 0, W, H);
  const cx = W / 2;
  g.fillStyle = INK;
  g.strokeStyle = INK;
  const top = H * 0.1;
  const block = H * 0.205;
  const ns = H * 0.0215;
  PILLARS.forEach((p, i) => {
    const y0 = top + i * block;
    p.icon(g, cx, y0 + H * 0.05, W * 0.3);
    g.font = `600 ${ns}px ${sans}`;
    g.textBaseline = "alphabetic";
    tracked(g, p.name[0], cx, y0 + H * 0.118, ns * 0.14);
    tracked(g, p.name[1], cx, y0 + H * 0.118 + ns * 1.45, ns * 0.14);
    if (i < PILLARS.length - 1) {
      g.lineWidth = Math.max(1.5, H * 0.0015);
      g.lineCap = "butt";
      const ly = y0 + block - H * 0.022;
      line(g, cx - W * 0.3, ly, cx + W * 0.3, ly);
    }
  });
}

function paintTop(g: Ctx, W: number, H: number, mark: HTMLImageElement | null) {
  g.clearRect(0, 0, W, H);
  if (!mark) return;
  const mh = H * 0.42;
  const mw = mh * (mark.naturalWidth / mark.naturalHeight || 1.116);
  g.drawImage(tinted(mark, mw, mh, INK), W / 2 - mw / 2, H / 2 - mh / 2);
}

function toTexture(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/**
 * Paints the printed faces. Each ratio is height ÷ width of the plane it will cover, so the artwork is
 * never stretched.
 */
export async function makePrintTextures(ratios: { front: number; side: number; top: number }, edition: Edition): Promise<PrintTextures> {
  const sans = familyFrom(["--font-sans", "--font-afacad-flux"], "system-ui, Helvetica, Arial, sans-serif");
  const [mark] = await Promise.all([loadImage("/svg/auvox-logomark.svg"), ready([`500 100px ${sans}`, `600 100px ${sans}`])]);

  const FW = 2048;
  const front = canvas(FW, Math.round(FW * ratios.front));
  const SW = 1024;
  const side = canvas(SW, Math.round(SW * ratios.side));
  const TW = 1536;
  const top = canvas(TW, Math.round(TW * ratios.top));
  paintFront(front.g, front.c.width, front.c.height, mark, sans, edition);
  paintSide(side.g, side.c.width, side.c.height, sans);
  paintTop(top.g, top.c.width, top.c.height, mark);

  const ft = toTexture(front.c);
  const st = toTexture(side.c);
  const tt = toTexture(top.c);
  return {
    front: ft,
    side: st,
    top: tt,
    dispose: () => {
      ft.dispose();
      st.dispose();
      tt.dispose();
    },
  };
}

/**
 * The board's grain: fine value noise with a few fibres laid across it, as a tiling bump map.
 * Mid grey is flat; the noise is small so the surface reads as paper, not sand.
 */
export function makePaperTexture() {
  const S = 512;
  const { c, g } = canvas(S, S);
  const img = g.createImageData(S, S);
  const d = img.data;
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < S * S; i++) {
    const v = 128 + (rnd() - 0.5) * 34;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // fibres: short faint strokes, mostly along one direction (a laid paper)
  g.lineWidth = 1;
  for (let i = 0; i < 900; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const len = 6 + rnd() * 22;
    const a = (rnd() - 0.5) * 0.5 + (rnd() < 0.5 ? 0 : Math.PI / 2);
    g.strokeStyle = `rgba(${rnd() < 0.5 ? 90 : 170},${rnd() < 0.5 ? 90 : 170},${rnd() < 0.5 ? 90 : 170},0.18)`;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 6);
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}
