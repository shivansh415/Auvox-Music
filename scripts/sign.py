"""Replaces the AI-drawn wall sign on the clean plate with the real AUVOX logo.

    .venv/bin/python scripts/sign.py

1. masks the cream letters of the generated sign and inpaints the wall behind them
2. rasterises public/svg/auvox-primary-logo.svg (the exact lockup the preloader animates)
3. composites it in cream, shaded by the wall's own lighting, with a soft contact shadow

Writes output/final/02-B-clean-plate.png (original kept as 02-B-clean-plate-original.png)
and prints the wordmark box to paste into SIGN_WORDMARK.
"""

from __future__ import annotations

import re
from pathlib import Path

import cv2
import numpy as np
from matplotlib.backends.backend_agg import FigureCanvasAgg
from matplotlib.figure import Figure
from matplotlib.patches import PathPatch
from matplotlib.path import Path as MplPath
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
FINAL = ROOT.parent / "AUVOX Generation Pack" / "output" / "final"
SVG = ROOT / "public" / "svg" / "auvox-primary-logo.svg"

# Where the generated sign sits on the plate (its "auvox" box), and where ours goes.
OLD_REGION = (440, 50, 1010, 285)  # x0, y0, x1, y1 — search area for the old cream letters
TARGET_X, TARGET_W = 505, 448     # keep the old wordmark's left edge and width
TARGET_CY = 165                   # vertical centre of the old wordmark
CREAM = np.array([241, 237, 233], dtype=np.float32)


def svg_paths(svg: str):
    """Parse absolute M/L/C/Z path data (what our generated SVGs contain) into matplotlib paths."""
    vb = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg)
    w, h = float(vb.group(1)), float(vb.group(2))
    paths = []
    # paths may sit inside a transformed <g>; handle the one transform we emit: translate+scale
    pos = 0
    group_tf = (0.0, 0.0, 1.0)
    for m in re.finditer(r'<g transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)">|</g>|<path d="([^"]+)"', svg):
        if m.group(4) is None:
            group_tf = (float(m.group(1)), float(m.group(2)), float(m.group(3))) if m.group(0).startswith("<g") else (0.0, 0.0, 1.0)
            continue
        tx, ty, sc = group_tf
        toks = re.findall(r"[MLCZ]|-?\d*\.?\d+", m.group(4))
        verts, codes = [], []
        i = 0
        cmd = None
        while i < len(toks):
            t = toks[i]
            if t in "MLCZ":
                cmd = t
                i += 1
                if cmd == "Z":
                    verts.append((0, 0))
                    codes.append(MplPath.CLOSEPOLY)
                continue
            if cmd == "M":
                verts.append((float(toks[i]) * sc + tx, float(toks[i + 1]) * sc + ty))
                codes.append(MplPath.MOVETO)
                i += 2
            elif cmd == "L":
                verts.append((float(toks[i]) * sc + tx, float(toks[i + 1]) * sc + ty))
                codes.append(MplPath.LINETO)
                i += 2
            elif cmd == "C":
                for k in range(3):
                    verts.append((float(toks[i + k * 2]) * sc + tx, float(toks[i + k * 2 + 1]) * sc + ty))
                    codes.append(MplPath.CURVE4)
                i += 6
        paths.append(MplPath(verts, codes))
        pos = m.end()
    return w, h, paths


def render_logo(width_px: int) -> Image.Image:
    w, h, paths = svg_paths(SVG.read_text())
    height_px = int(round(width_px * h / w))
    dpi = 100
    fig = Figure(figsize=(width_px / dpi, height_px / dpi), dpi=dpi)
    FigureCanvasAgg(fig)
    fig.patch.set_alpha(0)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_axis_off()
    ax.set_xlim(0, w)
    ax.set_ylim(h, 0)
    for p in paths:
        ax.add_patch(PathPatch(p, facecolor="white", edgecolor="none", antialiased=True))
    fig.canvas.draw()
    rgba = np.asarray(fig.canvas.buffer_rgba())
    return Image.fromarray(rgba[..., 3], "L")  # alpha = logo coverage


def shift(img: np.ndarray, dy: int, dx: int) -> np.ndarray:
    """Shift without wrap-around (np.roll would drag the bottom shadow onto the top)."""
    out = np.zeros_like(img)
    h, w = img.shape[:2]
    out[max(dy, 0) : h + min(dy, 0), max(dx, 0) : w + min(dx, 0)] = img[max(-dy, 0) : h - max(dy, 0), max(-dx, 0) : w - max(dx, 0)]
    return out


def resign(src: Path, protect: np.ndarray | None = None) -> tuple[int, int, int, int]:
    """Replace the generated sign on `src` in place. `protect` (H×W, 0–1) keeps foreground pixels untouched."""
    backup = src.with_name(src.stem + "-original.png")
    if not backup.exists():
        backup.write_bytes(src.read_bytes())
    plate = np.asarray(Image.open(backup).convert("RGB")).astype(np.float32)
    H, W, _ = plate.shape
    keep = np.zeros((H, W), np.float32) if protect is None else np.clip(protect, 0, 1)
    keep = cv2.dilate(keep, np.ones((5, 5), np.uint8))

    # 1. old sign mask (cream letters, not on the foreground) → inpaint
    lum = plate.mean(axis=2)
    sat = plate.max(axis=2) - plate.min(axis=2)
    old = np.zeros((H, W), np.uint8)
    x0, y0, x1, y1 = OLD_REGION
    region = (lum[y0:y1, x0:x1] > 120) & (sat[y0:y1, x0:x1] < 110)
    old[y0:y1, x0:x1] = region.astype(np.uint8) * 255
    old = cv2.dilate(old, np.ones((9, 9), np.uint8), iterations=2)
    old = cv2.GaussianBlur(old, (0, 0), 1.5)
    old = ((old > 60) & (keep < 0.5)).astype(np.uint8) * 255
    wall = cv2.inpaint(plate.astype(np.uint8), old, 9, cv2.INPAINT_TELEA).astype(np.float32)

    # 2. our logo
    alpha_img = render_logo(TARGET_W)
    lw, lh = alpha_img.size
    wordmark_h = lh * 303 / 446  # the lockup SVG is 1309×446: wordmark 303 tall, MUSIC below
    ty = int(round(TARGET_CY - wordmark_h / 2))
    tx = TARGET_X

    # 3. shade by the wall's own light + soft shadow, only where the foreground doesn't cover
    alpha = np.asarray(alpha_img).astype(np.float32) / 255.0
    alpha *= 1 - keep[ty : ty + lh, tx : tx + lw]
    patch = wall[ty : ty + lh, tx : tx + lw]
    local = cv2.GaussianBlur(patch.mean(axis=2), (0, 0), 25)
    shade = np.clip(0.55 + 0.9 * (local / max(local.mean(), 1)), 0.6, 1.25)[..., None]
    colour = CREAM[None, None, :] * shade * 0.96
    shadow = shift(cv2.GaussianBlur(alpha, (0, 0), 4), 4, 2) * 0.55
    out = wall.copy()
    sub = out[ty : ty + lh, tx : tx + lw]
    sub = sub * (1 - shadow[..., None])
    sub = sub * (1 - alpha[..., None]) + colour * alpha[..., None]
    out[ty : ty + lh, tx : tx + lw] = sub

    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(src)
    print("✓", src.name, "(sign replaced)")

    # Split versions for the site: the bare wall, and the sign on its own (logo + shadow, occluded by him).
    Image.fromarray(np.clip(wall, 0, 255).astype(np.uint8)).save(src.with_name(src.stem + "-nosign.png"))
    layer = np.zeros((H, W, 4), np.float32)
    a_out = alpha + shadow * (1 - alpha)
    rgb = np.where(a_out[..., None] > 1e-4, colour * alpha[..., None] / np.maximum(a_out[..., None], 1e-4), 0)
    layer[ty : ty + lh, tx : tx + lw, :3] = rgb
    layer[ty : ty + lh, tx : tx + lw, 3] = a_out * 255
    Image.fromarray(np.clip(layer, 0, 255).astype(np.uint8), "RGBA").save(src.with_name(src.stem + "-sign.png"))
    print("✓", src.stem + "-nosign.png,", src.stem + "-sign.png")
    return tx, ty, lw, int(round(wordmark_h))


# ---- v2 room (client feedback 2026-10-09): light greige wall, sign on the bare upper-left wall ----
V2_X, V2_W, V2_CY = 200, 270, 160      # lockup left edge, lockup width, wordmark centre (plate px)
RED = np.array([133, 9, 9], dtype=np.float32)
HALO = np.array([255, 196, 130], dtype=np.float32)


def place_backlit_sign(src: Path) -> tuple[int, int, int, int]:
    """Writes <src>-sign.png (RGBA layer: red letters, soft shadow, warm LED halo) and <src>-signed.png (preview)."""
    plate = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
    H, W, _ = plate.shape
    alpha_img = render_logo(V2_W)
    lw, lh = alpha_img.size
    wordmark_h = lh * 303 / 446
    tx, ty = V2_X, int(round(V2_CY - wordmark_h / 2))
    a = np.zeros((H, W), np.float32)
    a[ty : ty + lh, tx : tx + lw] = np.asarray(alpha_img).astype(np.float32) / 255.0

    # letters: brand red, shaded a touch by the wall's own light falloff
    local = cv2.GaussianBlur(plate.mean(axis=2), (0, 0), 30)
    shade = np.clip(local / max(local[ty : ty + lh, tx : tx + lw].mean(), 1), 0.8, 1.15)[..., None]
    letters = RED[None, None, :] * shade
    # halo: the letters stand off the wall with a warm LED behind them, like the slat panels
    halo = cv2.GaussianBlur(a, (0, 0), 16) * 0.55 + cv2.GaussianBlur(a, (0, 0), 5) * 0.35
    shadow = shift(cv2.GaussianBlur(a, (0, 0), 2.5), 3, 2) * 0.35

    # composite as one RGBA layer, back to front: halo (warm light) → shadow → letters
    rgb = np.zeros((H, W, 3), np.float32)
    al = np.zeros((H, W), np.float32)
    for colour, amount in ((HALO, np.clip(halo, 0, 1) * 0.6), (np.zeros(3, np.float32), shadow)):
        a_out = amount + al * (1 - amount)
        mix = colour[None, None, :] * amount[..., None] + rgb * (al * (1 - amount))[..., None]
        rgb = mix / np.maximum(a_out, 1e-5)[..., None]
        al = a_out
    a_out = a + al * (1 - a)
    rgb = (letters * a[..., None] + rgb * (al * (1 - a))[..., None]) / np.maximum(a_out, 1e-5)[..., None]
    al = a_out
    layer = np.dstack([np.clip(rgb, 0, 255), np.clip(al * 255, 0, 255)]).astype(np.uint8)
    Image.fromarray(layer, "RGBA").save(src.with_name(src.stem + "-sign.png"))

    preview = plate * (1 - al[..., None]) + rgb * al[..., None]
    Image.fromarray(np.clip(preview, 0, 255).astype(np.uint8)).save(src.with_name(src.stem + "-signed.png"))
    print("✓", src.stem + "-sign.png,", src.stem + "-signed.png")
    return tx, ty, lw, int(round(wordmark_h))


def main() -> None:
    tx, ty, lw, wh = place_backlit_sign(FINAL / "03-A-hero.png")
    print(f"SIGN_WORDMARK = {{ x: {tx}, y: {ty}, w: {lw}, h: {wh} }}")
    Image.open(FINAL / "03-A-hero-signed.png").crop((120, 40, 620, 300)).save(FINAL / "layers" / "sign-preview.png")


if __name__ == "__main__":
    main()
