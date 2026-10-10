"""Puts the room behind him into focus.

    .venv/bin/python scripts/sharp-room.py

The generated hero plate (03-A-hero-dof.png) has a baked-in shallow depth of field, which no
upscaler can undo. The clean plate (02-B-clean-plate.png, no person) is the same room in sharp focus
but framed wider, so it is aligned to the hero's frame (SIFT matches on the background, similarity
transform), and the hero is composited back over it through the rembg matte plus the guitar's
near-depth region (the matte misses the headstock). His pixels, and every calibration, are unchanged.

Writes output/final/03-A-hero.png.
"""

from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FINAL = ROOT.parent / "AUVOX Generation Pack" / "output" / "final"

hero = np.asarray(Image.open(FINAL / "03-A-hero-dof.png").convert("RGB"))
clean = np.asarray(Image.open(FINAL / "02-B-clean-plate.png").convert("RGB"))
matte = np.asarray(Image.open(FINAL / "layers" / "hero-cutout-mask.png").convert("L"))
depth = np.asarray(Image.open(FINAL / "layers" / "hero-depth.png").convert("L"))
H, W = matte.shape

# align the clean plate to the hero's frame using background features only
gh = cv2.cvtColor(hero, cv2.COLOR_RGB2GRAY)
gc = cv2.cvtColor(clean, cv2.COLOR_RGB2GRAY)
fg = cv2.dilate(((matte > 40) | (depth > 140)).astype(np.uint8) * 255, np.ones((41, 41), np.uint8))
sift = cv2.SIFT_create(6000)
k1, d1 = sift.detectAndCompute(gh, 255 - fg)
k2, d2 = sift.detectAndCompute(gc, None)
good = [a for a, b in cv2.BFMatcher().knnMatch(d1, d2, k=2) if a.distance < 0.72 * b.distance]
src = np.float32([k2[g.trainIdx].pt for g in good])
dst = np.float32([k1[g.queryIdx].pt for g in good])
A, inliers = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=4)
print(f"  {len(good)} matches, {int(inliers.sum())} inliers, scale {np.hypot(A[0, 0], A[0, 1]):.3f}")
room = cv2.warpAffine(clean, A, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT)

# him, the guitar (headstock included) and the phone keep their own pixels
guitar = ((depth > 150) & (np.arange(H)[:, None] > 620)).astype(np.uint8) * 255
subject = np.maximum(matte, cv2.dilate(guitar, np.ones((5, 5), np.uint8)))
a = cv2.GaussianBlur(subject.astype(np.float32) / 255.0, (0, 0), 1.5)[..., None]
out = (hero * a + room * (1 - a)).astype(np.uint8)
Image.fromarray(out).save(FINAL / "03-A-hero.png")
print("✓ 03-A-hero.png (room in focus)")
