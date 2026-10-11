// The box's printed faces, painted at runtime into 2D canvases and used as transparent CanvasTextures
// (print only — the cream card underneath is the box material). Front: logomark, "AUVOX MUSIC",
// rule + "FORGED IN FREQUENCY", a small waveform. Spine: four icons with their labels.

import * as THREE from "three";

/** tan foil */
export const PRINT = "#c89a5c";

export type PrintTextures = {
  front: THREE.CanvasTexture;
  spine: THREE.CanvasTexture;
  dispose: () => void;
};

type Ctx = CanvasRenderingContext2D;

const SPINE_ITEMS: { label: [string, string]; icon: (g: Ctx, s: number) => void }[] = [
  { label: ["MUSICAL", "INSTRUMENTS"], icon: waveformIcon },
  { label: ["DIGITAL", "PRODUCTION"], icon: equaliserIcon },
  { label: ["CHROMATIC", "FLUX"], icon: ringsIcon },
  { label: ["HARMONIC", "VEIL"], icon: lotusIcon },
];

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

/** Symmetric audio waveform: a centre line with rounded bars rising and falling around the middle. */
function waveform(g: Ctx, cx: number, cy: number, w: number, h: number, bars: number, stroke: number) {
  g.lineCap = "round";
  g.lineWidth = stroke;
  line(g, cx - w / 2, cy, cx + w / 2, cy);
  const step = (w * 0.56) / (bars - 1);
  for (let i = 0; i < bars; i++) {
    const u = i / (bars - 1);
    // an envelope with a dip in the middle, like the reference mark
    const env = Math.sin(u * Math.PI);
    const ripple = 0.55 + 0.45 * Math.abs(Math.sin(u * Math.PI * 3.5));
    const hh = (h / 2) * Math.max(0.1, env * ripple);
    const x = cx - (w * 0.56) / 2 + i * step;
    line(g, x, cy - hh, x, cy + hh);
  }
}

// ---------- spine icons: each is drawn centred at (0,0) in a box of side `s`

function waveformIcon(g: Ctx, s: number) {
  waveform(g, 0, 0, s * 0.95, s * 0.9, 13, s * 0.05);
  g.beginPath();
  g.arc(-s * 0.475, 0, s * 0.045, 0, Math.PI * 2);
  g.arc(s * 0.475, 0, s * 0.045, 0, Math.PI * 2);
  g.fill();
}

function equaliserIcon(g: Ctx, s: number) {
  const cols = [3, 5, 8, 6, 11, 7, 9, 5, 3];
  const pitch = s * 0.105;
  const r = s * 0.03;
  const x0 = -((cols.length - 1) * pitch) / 2;
  cols.forEach((n, i) => {
    for (let k = 0; k < n; k++) {
      g.beginPath();
      g.arc(x0 + i * pitch, s * 0.45 - k * pitch * 0.85, r, 0, Math.PI * 2);
      g.fill();
    }
  });
}

function ringsIcon(g: Ctx, s: number) {
  g.lineCap = "butt";
  g.beginPath();
  g.arc(0, 0, s * 0.075, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = s * 0.045;
  g.beginPath();
  g.arc(0, 0, s * 0.19, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = s * 0.035;
  g.setLineDash([s * 0.07, s * 0.045]);
  g.beginPath();
  g.arc(0, 0, s * 0.31, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([s * 0.42, s * 0.16]);
  g.lineDashOffset = s * 0.12;
  g.beginPath();
  g.arc(0, 0, s * 0.45, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  g.lineDashOffset = 0;
}

function lotusIcon(g: Ctx, s: number) {
  g.lineWidth = s * 0.028;
  // two rings of petals, the inner one rotated half a step — reads as a flower of life
  const petals = (n: number, ry: number, rx: number, offset: number, phase: number) => {
    for (let k = 0; k < n; k++) {
      g.save();
      g.rotate(phase + (k * Math.PI * 2) / n);
      g.beginPath();
      g.ellipse(0, -offset, rx, ry, 0, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
  };
  petals(8, s * 0.24, s * 0.11, s * 0.2, 0);
  petals(8, s * 0.17, s * 0.085, s * 0.12, Math.PI / 8);
  g.beginPath();
  g.arc(0, 0, s * 0.05, 0, Math.PI * 2);
  g.fill();
}

// ---------- faces

function paintFront(g: Ctx, W: number, H: number, logo: HTMLImageElement | null, display: string, sans: string) {
  g.clearRect(0, 0, W, H);
  g.fillStyle = PRINT;
  g.strokeStyle = PRINT;
  g.textBaseline = "alphabetic";
  const cx = W / 2;

  // logomark
  const lh = H * 0.27;
  if (logo) {
    const lw = lh * (logo.naturalWidth / logo.naturalHeight || 1.116);
    g.drawImage(tinted(logo, lw, lh, PRINT), cx - lw / 2, H * 0.2);
  } else {
    // if the svg can't load, a serif X stands in so the face is never blank
    g.font = `italic ${lh * 1.1}px ${display}`;
    g.textAlign = "center";
    g.fillText("X", cx, H * 0.2 + lh * 0.92);
  }

  // wordmark
  const ws = H * 0.095;
  g.font = `400 ${ws}px ${display}`;
  tracked(g, "AUVOX MUSIC", cx, H * 0.635, ws * 0.3);

  // rule with "FORGED IN FREQUENCY" set into it
  const ts = H * 0.03;
  g.font = `600 ${ts}px ${sans}`;
  const ry = H * 0.715;
  const tw = tracked(g, "FORGED IN FREQUENCY", cx, ry + ts * 0.36, ts * 0.42);
  g.lineWidth = Math.max(2, H * 0.0022);
  g.lineCap = "butt";
  const gap = ts * 1.4;
  line(g, W * 0.26, ry, cx - tw / 2 - gap, ry);
  line(g, cx + tw / 2 + gap, ry, W * 0.74, ry);

  // small waveform
  waveform(g, cx, H * 0.8, W * 0.2, H * 0.06, 15, Math.max(2, H * 0.0032));
}

function paintSpine(g: Ctx, W: number, H: number, sans: string) {
  g.clearRect(0, 0, W, H);
  g.fillStyle = PRINT;
  g.strokeStyle = PRINT;
  g.textBaseline = "alphabetic";
  const cx = W / 2;
  const n = SPINE_ITEMS.length;
  const top = H * 0.035;
  const pitch = (H - top * 2) / n;
  const s = W * 0.3; // icon box
  const ls = W * 0.052; // label size

  SPINE_ITEMS.forEach((item, i) => {
    const y0 = top + i * pitch;
    // icon
    g.save();
    g.translate(cx, y0 + pitch * 0.36);
    g.lineCap = "round";
    g.lineJoin = "round";
    item.icon(g, s);
    g.restore();
    // label, two lines
    g.font = `600 ${ls}px ${sans}`;
    tracked(g, item.label[0], cx, y0 + pitch * 0.69, ls * 0.1);
    tracked(g, item.label[1], cx, y0 + pitch * 0.69 + ls * 1.25, ls * 0.1);
    // separator
    if (i < n - 1) {
      g.lineWidth = Math.max(2, W * 0.0035);
      g.lineCap = "butt";
      g.globalAlpha = 0.7;
      line(g, W * 0.2, y0 + pitch, W * 0.8, y0 + pitch);
      g.globalAlpha = 1;
    }
  });
}

function toTexture(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/**
 * Paints both printed faces. `frontRatio` / `spineRatio` are height ÷ width of the planes they will cover,
 * so the artwork is never stretched.
 */
export async function makePrintTextures(frontRatio: number, spineRatio: number): Promise<PrintTextures> {
  // the display face (Tan Pearl once it lands, DM Serif until then), the UI sans for the small labels
  const display = familyFrom(["--font-display", "--font-tan-pearl", "--font-dm-serif"], "Georgia, 'Times New Roman', serif");
  const sans = familyFrom(["--font-sans", "--font-afacad-flux"], "system-ui, Helvetica, Arial, sans-serif");
  const [logo] = await Promise.all([loadImage("/svg/auvox-logomark.svg"), ready([`400 100px ${display}`, `600 100px ${sans}`])]);

  const FW = 2048;
  const FH = Math.round(FW * frontRatio);
  const SW = 1024;
  const SH = Math.round(SW * spineRatio);
  const front = canvas(FW, FH);
  const spine = canvas(SW, SH);
  paintFront(front.g, FW, FH, logo, display, sans);
  paintSpine(spine.g, SW, SH, sans);

  const ft = toTexture(front.c);
  const st = toTexture(spine.c);
  return {
    front: ft,
    spine: st,
    dispose: () => {
      ft.dispose();
      st.dispose();
    },
  };
}
