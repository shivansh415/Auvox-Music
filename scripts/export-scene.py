"""Exports the final plates + layers into public/scene/ in web-friendly formats.

    .venv/bin/python scripts/export-scene.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FINAL = ROOT.parent / "AUVOX Generation Pack" / "output" / "final"
LAYERS = FINAL / "layers"
OUT = ROOT / "public" / "scene"
OUT.mkdir(parents=True, exist_ok=True)


def jpg(src: Path, name: str, quality: int = 88, grayscale: bool = False) -> None:
    im = Image.open(src)
    im = im.convert("L") if grayscale else im.convert("RGB")
    im.save(OUT / name, quality=quality, optimize=True, progressive=True)
    print("✓", name, f"{(OUT / name).stat().st_size // 1024} KB")


def webp_alpha(src: Path, name: str, quality: int = 90) -> None:
    im = Image.open(src).convert("RGBA")
    im.save(OUT / name, quality=quality, method=6)
    print("✓", name, f"{(OUT / name).stat().st_size // 1024} KB")


jpg(FINAL / "02-B-clean-plate.png", "clean.jpg")
jpg(FINAL / "03-A-hero-nosign.png", "hero.jpg")  # bare wall: the sign arrives with the preloader
webp_alpha(FINAL / "03-A-hero-sign.png", "sign.webp")
jpg(FINAL / "04-D-phone-closeup.png", "closeup.jpg")
jpg(FINAL / "08-A-hero-mobile.png", "hero-mobile.jpg")
jpg(LAYERS / "clean-depth.png", "clean-depth.jpg", 85, grayscale=True)
jpg(LAYERS / "hero-depth.png", "hero-depth.jpg", 85, grayscale=True)
jpg(LAYERS / "closeup-depth.png", "closeup-depth.jpg", 85, grayscale=True)
jpg(LAYERS / "mask-red.png", "mask-red.jpg", 80, grayscale=True)
jpg(LAYERS / "mask-lamp.png", "mask-lamp.jpg", 80, grayscale=True)
