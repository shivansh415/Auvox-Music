// The box's printed faces, painted at runtime into 2D canvases and used as transparent CanvasTextures
// (print only; the sand card underneath is the box material). Matched to the client's reference box:
// front: the AUVOX MUSIC lockup in brown, "FORGED IN FREQUENCY" between two rules and a long hairline
// with a waveform at its centre, in tan. Side: the edition (Guitar / Piano) under the logomark.
// Lid: the logomark, tone on tone.

import * as THREE from "three";

/** printed ink, sampled from the reference */
export const INK = { logo: "#6d4738", line: "#a99a84", lid: "#7e7566" } as const;

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

/** A long hairline with a small symmetric waveform rising and falling at its centre. */
function waveLine(g: Ctx, cx: number, cy: number, w: number, waveW: number, h: number, bars: number, stroke: number) {
  g.lineCap = "round";
  g.lineWidth = stroke;
  line(g, cx - w / 2, cy, cx - waveW / 2, cy);
  line(g, cx + waveW / 2, cy, cx + w / 2, cy);
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

// ---------- faces

function paintFront(g: Ctx, W: number, H: number, lockup: HTMLImageElement | null, display: string, sans: string) {
  g.clearRect(0, 0, W, H);
  const cx = W / 2;

  // the AUVOX MUSIC lockup, brown
  const lh = H * 0.36;
  if (lockup) {
    const lw = lh * (lockup.naturalWidth / lockup.naturalHeight || 2.9);
    g.drawImage(tinted(lockup, lw, lh, INK.logo), cx - lw / 2, H * 0.2);
  } else {
    g.fillStyle = INK.logo;
    g.font = `400 ${H * 0.2}px ${display}`;
    g.textAlign = "center";
    g.fillText("auvox", cx, H * 0.42);
  }

  // — FORGED IN FREQUENCY —
  g.fillStyle = INK.line;
  g.strokeStyle = INK.line;
  const ts = H * 0.05;
  g.font = `600 ${ts}px ${sans}`;
  g.textBaseline = "alphabetic";
  const ry = H * 0.69;
  const tw = tracked(g, "FORGED IN FREQUENCY", cx, ry + ts * 0.36, ts * 0.45);
  g.lineWidth = Math.max(2, H * 0.004);
  g.lineCap = "butt";
  const gap = ts * 0.9;
  const dash = ts * 1.6;
  line(g, cx - tw / 2 - gap - dash, ry, cx - tw / 2 - gap, ry);
  line(g, cx + tw / 2 + gap, ry, cx + tw / 2 + gap + dash, ry);

  // the hairline with its waveform
  waveLine(g, cx, H * 0.82, W * 0.42, W * 0.09, H * 0.09, 17, Math.max(2, H * 0.005));
}

function paintSide(g: Ctx, W: number, H: number, mark: HTMLImageElement | null, sans: string, edition: Edition) {
  g.clearRect(0, 0, W, H);
  const cx = W / 2;
  const mh = H * 0.26;
  if (mark) {
    const mw = mh * (mark.naturalWidth / mark.naturalHeight || 1.116);
    g.drawImage(tinted(mark, mw, mh, INK.logo), cx - mw / 2, H * 0.2);
  }
  g.fillStyle = INK.line;
  g.strokeStyle = INK.line;
  const ts = H * 0.075;
  g.font = `600 ${ts}px ${sans}`;
  g.textBaseline = "alphabetic";
  tracked(g, edition === "guitar" ? "GUITAR VERSE" : "PIANO VERSE", cx, H * 0.66, ts * 0.42);
  const s2 = H * 0.05;
  g.font = `500 ${s2}px ${sans}`;
  tracked(g, "THE FREQUENCY BOX", cx, H * 0.78, s2 * 0.5);
}

function paintTop(g: Ctx, W: number, H: number, mark: HTMLImageElement | null) {
  g.clearRect(0, 0, W, H);
  if (!mark) return;
  const mh = H * 0.3;
  const mw = mh * (mark.naturalWidth / mark.naturalHeight || 1.116);
  g.drawImage(tinted(mark, mw, mh, INK.lid), W / 2 - mw / 2, H / 2 - mh / 2);
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
  const display = familyFrom(["--font-display", "--font-tan-pearl", "--font-dm-serif"], "Georgia, 'Times New Roman', serif");
  const sans = familyFrom(["--font-sans", "--font-afacad-flux"], "system-ui, Helvetica, Arial, sans-serif");
  const [lockup, mark] = await Promise.all([loadImage("/svg/auvox-primary-logo.svg"), loadImage("/svg/auvox-logomark.svg"), ready([`400 100px ${display}`, `600 100px ${sans}`])]);

  const FW = 2048;
  const front = canvas(FW, Math.round(FW * ratios.front));
  const SW = 1024;
  const side = canvas(SW, Math.round(SW * ratios.side));
  const TW = 1536;
  const top = canvas(TW, Math.round(TW * ratios.top));
  paintFront(front.g, front.c.width, front.c.height, lockup, display, sans);
  paintSide(side.g, side.c.width, side.c.height, mark, sans, edition);
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
