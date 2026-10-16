"""Journey illustrations: align each rendered picture to its pen drawing and export both for the web.

    .venv/bin/python scripts/journey-assets.py

Reads   AUVOX Generation Pack/output/journey/raw/0N-lines.png and 0N-render.png  (N = 1..5)
Writes  public/journey/0N-lines.webp and 0N-render.webp  (1600x1200, greyscale, paper = white)

The shader (src/components/sections/Journey/InkReveal.tsx) blends the two pixel for pixel, so the
render is warped onto the drawing with an affine ECC fit on their edge maps (the image model shifts
and scales a few pixels), then both are levelled so the paper is pure white — the shader tints it.
"""
import os
import sys

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "..", "..", "AUVOX Generation Pack", "output", "journey", "raw")
OUT = os.path.join(HERE, "..", "public", "journey")
W, H = 1600, 1200


def level(img, lo_pct=1.0, paper_pct=70.0):
    """Stretch so the paper (the bright majority) is white and the darkest ink is near black."""
    lo = np.percentile(img, lo_pct)
    hi = np.percentile(img, paper_pct)
    out = (img.astype(np.float32) - lo) / max(1.0, hi - lo)
    return np.clip(out * 255, 0, 255).astype(np.uint8)


def align(lines, render):
    le = cv2.GaussianBlur(cv2.Canny(lines, 60, 160).astype(np.float32), (0, 0), 3)
    re_ = cv2.GaussianBlur(cv2.Canny(render, 60, 160).astype(np.float32), (0, 0), 3)
    warp = np.eye(2, 3, dtype=np.float32)
    try:
        cc, warp = cv2.findTransformECC(le, re_, warp, cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 300, 1e-6))
    except cv2.error as e:
        print("  ECC failed, using identity:", e)
        cc = 0.0
    out = cv2.warpAffine(render, warp, (lines.shape[1], lines.shape[0]), flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
    return out, cc, warp


def main():
    os.makedirs(OUT, exist_ok=True)
    for n in range(1, 6):
        lp = os.path.join(RAW, f"0{n}-lines.png")
        rp = os.path.join(RAW, f"0{n}-render.png")
        if not (os.path.exists(lp) and os.path.exists(rp)):
            print(f"step {n}: missing raw files, skipped")
            continue
        lines = cv2.imread(lp, cv2.IMREAD_GRAYSCALE)
        render = cv2.imread(rp, cv2.IMREAD_GRAYSCALE)
        render = cv2.resize(render, (lines.shape[1], lines.shape[0]), interpolation=cv2.INTER_AREA)
        render, cc, warp = align(lines, render)
        lines = cv2.resize(level(lines, 0.5, 60), (W, H), interpolation=cv2.INTER_AREA)
        render = cv2.resize(level(render, 0.5, 72), (W, H), interpolation=cv2.INTER_AREA)
        cv2.imwrite(os.path.join(OUT, f"0{n}-lines.webp"), lines, [cv2.IMWRITE_WEBP_QUALITY, 80])
        cv2.imwrite(os.path.join(OUT, f"0{n}-render.webp"), render, [cv2.IMWRITE_WEBP_QUALITY, 82])
        shift = np.round(warp[:, 2], 1).tolist()
        print(f"step {n}: aligned (cc={cc:.3f}, shift={shift}) -> 0{n}-lines.webp, 0{n}-render.webp")
    return 0


if __name__ == "__main__":
    sys.exit(main())
