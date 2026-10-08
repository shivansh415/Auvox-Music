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
OLD_REGION = (470, 95, 990, 275)  # x0, y0, x1, y1 — search area for the old cream letters
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


def main() -> None:
    src = FINAL / "02-B-clean-plate.png"
    backup = FINAL / "02-B-clean-plate-original.png"
    if not backup.exists():
        backup.write_bytes(src.read_bytes())
    plate = np.asarray(Image.open(backup).convert("RGB")).astype(np.float32)
    H, W, _ = plate.shape

    # 1. old sign mask → inpaint
    lum = plate.mean(axis=2)
    sat = plate.max(axis=2) - plate.min(axis=2)
    old = np.zeros((H, W), np.uint8)
    x0, y0, x1, y1 = OLD_REGION
    region = (lum[y0:y1, x0:x1] > 120) & (sat[y0:y1, x0:x1] < 110)
    old[y0:y1, x0:x1] = region.astype(np.uint8) * 255
    old = cv2.dilate(old, np.ones((9, 9), np.uint8), iterations=2)
    old = cv2.GaussianBlur(old, (0, 0), 1.5)
    old = (old > 60).astype(np.uint8) * 255
    wall = cv2.inpaint(plate.astype(np.uint8), old, 9, cv2.INPAINT_TELEA).astype(np.float32)

    # 2. our logo
    alpha_img = render_logo(TARGET_W)
    lw, lh = alpha_img.size
    # the wordmark is the top 303/470 of the lockup → centre that part on the old wordmark centre
    wordmark_h = lh * 303 / 446  # the lockup SVG is 1309×446: wordmark 303 tall, MUSIC below
    ty = int(round(TARGET_CY - wordmark_h / 2))
    tx = TARGET_X

    # 3. shade by the wall's own light (brighter where the wall is brighter) + soft shadow
    alpha = np.asarray(alpha_img).astype(np.float32) / 255.0
    patch = wall[ty : ty + lh, tx : tx + lw]
    local = cv2.GaussianBlur(patch.mean(axis=2), (0, 0), 25)
    shade = np.clip(0.55 + 0.9 * (local / max(local.mean(), 1)), 0.6, 1.25)[..., None]
    colour = CREAM[None, None, :] * shade * 0.96
    shadow = cv2.GaussianBlur(alpha, (0, 0), 4)
    shadow = np.roll(np.roll(shadow, 4, axis=0), 2, axis=1) * 0.55
    out = wall.copy()
    sub = out[ty : ty + lh, tx : tx + lw]
    sub = sub * (1 - shadow[..., None]) + np.zeros_like(sub) * shadow[..., None]
    sub = sub * (1 - alpha[..., None]) + colour * alpha[..., None]
    out[ty : ty + lh, tx : tx + lw] = sub

    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(src)
    print("✓ 02-B-clean-plate.png (sign replaced)")
    print(f"SIGN_WORDMARK = {{ x: {tx}, y: {ty}, w: {lw}, h: {int(round(wordmark_h))} }}  lockup {lw}x{lh}")
    # preview crop
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).crop((380, 60, 1080, 320)).save(FINAL / "layers" / "sign-preview.png")


if __name__ == "__main__":
    main()
