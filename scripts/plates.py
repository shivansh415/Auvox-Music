"""Turns the generated plates into the layers the website needs.

    .venv/bin/python scripts/plates.py

Reads  ../AUVOX Generation Pack/output/final/{02-B-clean-plate,03-A-hero}.png
Writes ../AUVOX Generation Pack/output/final/layers/
    hero-depth.png      depth map of the hero plate (white = near)   — Depth Anything V2
    clean-depth.png     depth map of the empty studio
    hero-cutout.png     the man + guitar + stool with alpha           — rembg (isnet)
    hero-cutout-mask.png
    mask-red.png        rough mask of the red-lit wall (for the red light beat)
    mask-lamp.png       rough mask of the lamp glow (for the lamp beat)
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

PACK = Path(__file__).resolve().parents[2] / "AUVOX Generation Pack"
FINAL = PACK / "output" / "final"
OUT = FINAL / "layers"


def depth(image: Image.Image, name: str) -> None:
    from transformers import pipeline

    pipe = pipeline("depth-estimation", model="depth-anything/Depth-Anything-V2-Small-hf")
    result = pipe(image)["depth"]
    result = result.resize(image.size, Image.BICUBIC)
    result.save(OUT / name)
    print("✓", name)


def cutout(image: Image.Image) -> None:
    from rembg import new_session, remove

    session = new_session("isnet-general-use")
    rgba = remove(image, session=session, alpha_matting=False)
    # tighten the edge: a 1px erode kills the background fringe, a soft feather hides the stair-steps
    a = np.asarray(rgba.getchannel("A")).astype(np.float32) / 255.0
    import cv2

    a = cv2.erode(a, np.ones((3, 3), np.uint8))
    a = cv2.GaussianBlur(a, (0, 0), 0.7)
    alpha = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    rgba.putalpha(alpha)
    rgba.save(OUT / "hero-cutout.png")
    alpha.save(OUT / "hero-cutout-mask.png")
    print("✓ hero-cutout.png")


def light_masks(image: Image.Image) -> None:
    """Two light beats for the intro: mask-red = the warm LED strip glow, mask-lamp = the spotlit highlights."""
    rgb = np.asarray(image.convert("RGB")).astype(np.float32) / 255.0
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b

    # LED strip: bright and warm, spread into a glow
    led = np.clip((lum - 0.5) * 3.0, 0, 1) * np.clip((r - b) * 4.0, 0, 1)
    Image.fromarray((led * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(30)).save(OUT / "mask-red.png")

    # spotlights / general: everything reasonably lit, softly
    lit = np.clip((lum - 0.22) / 0.45, 0, 1)
    Image.fromarray((lit * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(22)).save(OUT / "mask-lamp.png")
    print("✓ mask-red.png (LED), mask-lamp.png (spots)")


def main() -> None:
    hero_path = FINAL / "03-A-hero.png"
    clean_path = FINAL / "02-B-clean-plate.png"
    for p in (hero_path, clean_path):
        if not p.exists():
            sys.exit(f"missing {p} — pick that plate first")
    OUT.mkdir(parents=True, exist_ok=True)
    hero = Image.open(hero_path).convert("RGB")
    clean = Image.open(clean_path).convert("RGB")

    depth(hero, "hero-depth.png")
    depth(clean, "clean-depth.png")
    closeup_path = FINAL / "04-D-phone-closeup.png"
    if closeup_path.exists():
        depth(Image.open(closeup_path).convert("RGB"), "closeup-depth.png")
    light_masks(hero)


if __name__ == "__main__":
    main()
