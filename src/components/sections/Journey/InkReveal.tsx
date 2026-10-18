"use client";

import { useEffect, useRef } from "react";

/**
 * One Journey illustration: a pen drawing that draws itself in, then an ink front runs down it and
 * leaves the rendered black-and-white picture behind, with a brand-red sun blooming through the ink.
 * The pointer works as a brush — wherever it passes, ink reveals the render for a moment.
 *
 * Plain WebGL (no three.js): one quad, two greyscale textures, and a shader. It only draws when
 * something changes — the scroll progress (`state.p`, written by Journey's ScrollTrigger) or the brush —
 * so a resting card costs nothing.
 */

export type InkState = { p: number; dirty: boolean };

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uLines;   // pen drawing: 1 = paper, 0 = ink
uniform sampler2D uRender;  // the rendered picture, greyscale
uniform sampler2D uBrush;   // brush trail, 0..1
uniform float uProg;        // scroll progress, 0..1
uniform vec3 uSun;          // sun centre (uv) and radius (fraction of height)
uniform float uAspect;      // width / height
uniform float uSeed;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int k = 0; k < 4; k++) { v += a * vnoise(p); p = p * 2.03 + 7.1; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = vUv;
  vec2 sp = vec2(uv.x * uAspect, uv.y);          // square-pixel space
  float lines = texture(uLines, uv).r;
  float render = texture(uRender, uv).r;
  float n1 = fbm(sp * 3.0);
  float n2 = fbm(sp * 14.0 + 3.7);
  float n3 = vnoise(sp * 70.0);

  // 1 · the pen: lines appear along a noisy diagonal sweep, top-left first
  float drawP = smoothstep(0.0, 0.34, uProg);
  float sweep = uv.y * 0.62 + uv.x * 0.38 + (n1 - 0.5) * 0.22;
  float drawn = smoothstep(sweep - 0.04, sweep, drawP * 1.12);
  float L = mix(1.0, lines, drawn);

  // 2 · the ink front: runs top to bottom, ragged, with droplets flung ahead of it
  float inkP = smoothstep(0.28, 0.86, uProg);
  float front = mix(-0.18, 1.18, inkP);
  float edge = front + (n1 - 0.5) * 0.16 + (n2 - 0.5) * 0.07;
  float d = edge - uv.y;                          // > 0 behind the front
  float reveal = smoothstep(-0.004, 0.004, d);
  float drops = step(0.83, n2 * 0.6 + n3 * 0.4) * step(-0.09, d) * step(d, 0.0) * step(0.02, inkP);
  reveal = max(reveal, drops);

  // the brush: soft trail, given the same ragged ink edge
  float b = texture(uBrush, uv).r;
  float brush = smoothstep(0.42, 0.5, b + (n2 - 0.5) * 0.35 + (n3 - 0.5) * 0.12);
  reveal = max(reveal, brush);

  float grey = mix(L, render, reveal);
  // a thin, ragged line of wet ink right on the front (behind it), not a soft smudge
  float wet = (1.0 - smoothstep(0.0, 0.007 + n3 * 0.006, d)) * step(0.0, d) * step(0.02, inkP) * step(inkP, 0.98);
  grey *= 1.0 - 0.85 * wet;

  // 3 · the sun: an ink-edged red disc that blooms behind the picture once the ink has passed it
  float sunP = smoothstep(0.42, 0.92, uProg);
  vec2 sc = vec2(uSun.x * uAspect, uSun.y);
  float r = uSun.z * (0.15 + 0.85 * sunP);
  float sd = length(sp - sc) / max(r, 1e-4) + (n1 - 0.5) * 0.14 + (n2 - 0.5) * 0.12 + (n3 - 0.5) * 0.05;
  float sun = (1.0 - smoothstep(0.985, 1.0, sd)) * step(0.001, sunP) * smoothstep(-0.02, 0.06, d + 0.1);

  // no paper of its own: only the ink is printed, straight onto the page behind (multiply-like),
  // and it thins out towards the edges in an uneven wash so there's never a rectangle to see
  vec2 ed = min(uv, 1.0 - uv);
  float wash = (n1 - 0.5) * 0.14 + (n2 - 0.5) * 0.06;
  float mask = smoothstep(0.0, 0.15, ed.x * uAspect + wash) * smoothstep(0.0, 0.15, ed.y + wash);
  mask *= mask * (3.0 - 2.0 * mask);
  float ink = (1.0 - grey) * mask * (0.94 + 0.12 * hash(uv * 911.0));  // a little paper tooth

  vec3 red = vec3(0.522, 0.035, 0.035);           // #850909
  vec3 sunCol = red * pow(grey, 1.15);
  float a = sun + (1.0 - sun) * ink;
  outColor = vec4(sun * sunCol, a);               // premultiplied; ink itself is black
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`InkReveal shader: ${gl.getShaderInfoLog(s) || (gl.isContextLost() ? "context lost" : "compile failed")}`);
  return s;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

/**
 * The picture, decoded off the main thread and scaled to what the card actually shows (the files
 * are 1600px; a card is a few hundred). Uploading an <img> made the browser decode the full-size
 * file on the main thread at the moment of upload, an 80ms hitch each time a card came near.
 */
async function loadBitmap(src: string, width: number): Promise<TexImageSource> {
  if (typeof createImageBitmap !== "function") return loadImage(src);
  try {
    const blob = await (await fetch(src)).blob();
    const w = Math.max(64, Math.min(1600, Math.round(width)));
    return await createImageBitmap(blob, { resizeWidth: w, resizeHeight: Math.round((w * 3) / 4), resizeQuality: "high", premultiplyAlpha: "none" });
  } catch {
    return loadImage(src);
  }
}
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

const BRUSH_W = 192;
const BRUSH_H = 144;

export default function InkReveal({
  lines,
  render,
  sun,
  state,
  alt,
  seed = 1,
}: {
  lines: string;
  render: string;
  /** sun centre (uv, 0..1 from top-left) and radius as a fraction of the height */
  sun: [number, number, number];
  state: InkState;
  alt: string;
  seed?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    const gl = cv.getContext("webgl2", { antialias: false, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: false });
    if (!gl) return; // the <img> fallback stays visible

    let raf = 0;
    let alive = true;
    let ready = false;
    let near = false;
    let lastP = -1;

    // brush trail lives in a small 2D canvas, uploaded as a texture whenever it changes
    const bc = document.createElement("canvas");
    bc.width = BRUSH_W;
    bc.height = BRUSH_H;
    const bx = bc.getContext("2d")!;
    bx.fillStyle = "#000";
    bx.fillRect(0, 0, BRUSH_W, BRUSH_H);
    let brushEnergy = 0;
    let last: { x: number; y: number } | null = null;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uProg = u("uProg");
    const uAspect = u("uAspect");
    gl.uniform1i(u("uLines"), 0);
    gl.uniform1i(u("uRender"), 1);
    gl.uniform1i(u("uBrush"), 2);
    gl.uniform3f(u("uSun"), sun[0], sun[1], sun[2]);
    gl.uniform1f(u("uSeed"), seed * 17.3);

    const tex = (unit: number) => {
      const t = gl.createTexture()!;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    const tLines = tex(0);
    const tRender = tex(1);
    const tBrush = tex(2);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bc);

    const resize = () => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      cv.width = Math.max(2, Math.round(r.width * dpr));
      cv.height = Math.max(2, Math.round(r.height * dpr));
      gl.viewport(0, 0, cv.width, cv.height);
      gl.uniform1f(uAspect, r.width / Math.max(1, r.height));
      state.dirty = true;
    };

    const draw = () => {
      raf = 0;
      if (!alive || !ready) return;
      // the brush fades back to the drawing, like wet ink drying away
      if (brushEnergy > 0) {
        bx.globalCompositeOperation = "source-over";
        bx.fillStyle = "rgba(0,0,0,0.028)";
        bx.fillRect(0, 0, BRUSH_W, BRUSH_H);
        brushEnergy = Math.max(0, brushEnergy - 0.007);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, tBrush);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bc);
        state.dirty = true;
      }
      if (state.dirty || state.p !== lastP) {
        state.dirty = false;
        lastP = state.p;
        gl.uniform1f(uProg, state.p);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      if (near) raf = requestAnimationFrame(draw);
    };
    const kick = () => {
      if (!raf && near && ready) raf = requestAnimationFrame(draw);
    };

    // only load the pictures and run the loop near the screen
    let loading = false;
    const io = new IntersectionObserver(
      ([e]) => {
        near = e.isIntersecting;
        if (near && !loading) {
          loading = true;
          // the size the card is drawn at (with a little headroom for sharpness)
          const px = el.getBoundingClientRect().width * Math.min(window.devicePixelRatio || 1, 1.5) * 1.25;
          Promise.all([loadBitmap(lines, px), loadBitmap(render, px)])
            .then(async ([a, b]) => {
              if (!alive) return;
              // one upload per frame
              gl.activeTexture(gl.TEXTURE0);
              gl.bindTexture(gl.TEXTURE_2D, tLines);
              gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, a);
              await nextFrame();
              if (!alive) return;
              gl.activeTexture(gl.TEXTURE1);
              gl.bindTexture(gl.TEXTURE_2D, tRender);
              gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, b);
              if ("close" in a) (a as ImageBitmap).close();
              if ("close" in b) (b as ImageBitmap).close();
              ready = true;
              resize();
              el.dataset.ready = "1";
              kick();
            })
            .catch(() => {});
        }
        kick();
      },
      { rootMargin: "60% 0px" },
    );
    io.observe(el);
    const ro = new ResizeObserver(() => {
      resize();
      kick();
    });
    ro.observe(el);

    // the brush (mouse and pen only — on touch, a drag is a scroll)
    const stamp = (x: number, y: number, r: number) => {
      const g = bx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(255,255,255,0.9)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      bx.fillStyle = g;
      bx.beginPath();
      bx.arc(x, y, r, 0, Math.PI * 2);
      bx.fill();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * BRUSH_W;
      const y = ((e.clientY - r.top) / r.height) * BRUSH_H;
      const rad = BRUSH_H * 0.16;
      // fill the gap between pointer events so fast strokes stay continuous
      if (last) {
        const dist = Math.hypot(x - last.x, y - last.y);
        const n = Math.ceil(dist / (rad * 0.4));
        for (let i = 1; i <= n; i++) stamp(last.x + ((x - last.x) * i) / n, last.y + ((y - last.y) * i) / n, rad);
      } else stamp(x, y, rad);
      last = { x, y };
      brushEnergy = 1;
      kick();
    };
    const onLeave = () => {
      last = null;
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);

    // scroll progress arrives from outside; poll it cheaply via the loop while near
    const poll = window.setInterval(kick, 250);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.clearInterval(poll);
      io.disconnect();
      ro.disconnect();
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      gl.deleteTexture(tLines);
      gl.deleteTexture(tRender);
      gl.deleteTexture(tBrush);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      // no loseContext(): React's dev double-mount reuses this canvas, and a lost context can't compile
    };
  }, [lines, render, sun, state, seed]);

  return (
    <div ref={wrap} className="ink-card relative aspect-[4/3] w-full" data-cursor="Paint">
      {/* fallback / pre-load: the finished picture, shown until the canvas is ready (and without WebGL) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={render} alt={alt} className="ink-fallback absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-hidden />
    </div>
  );
}
