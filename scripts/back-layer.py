"""Builds the layer that shows through behind him in the 3D scene.

    .venv/bin/python scripts/back-layer.py

- hero-back.jpg: the hero plate with the near objects (him, the guitar) inpainted away, so the
  gaps at his silhouette are filled with wall rather than a smeared copy of his edge
- hero-depth-back.jpg: the hero depth map eroded (min-filtered), so near objects shrink inward and
  the back layer takes the far depth right where the front layer's skirts are dropped
"""

from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FINAL = ROOT.parent / "AUVOX Generation Pack" / "output" / "final"
OUT = ROOT / "public" / "scene"

hero = cv2.cvtColor(np.asarray(Image.open(FINAL / "03-A-hero.png").convert("RGB")), cv2.COLOR_RGB2BGR)
depth = np.asarray(Image.open(FINAL / "layers" / "hero-depth.png").convert("L"))

# near objects: anything clearly in front of the wall, grown a little so the seam is covered
near = (depth > 150).astype(np.uint8) * 255
near = cv2.dilate(near, np.ones((21, 21), np.uint8))
back = cv2.inpaint(hero, near, 12, cv2.INPAINT_TELEA)
cv2.imwrite(str(OUT / "hero-back.jpg"), back, [cv2.IMWRITE_JPEG_QUALITY, 86])

eroded = cv2.erode(depth, np.ones((31, 31), np.uint8))
eroded = cv2.GaussianBlur(eroded, (0, 0), 3)
Image.fromarray(eroded).save(OUT / "hero-depth-back.jpg", quality=85)
print("✓ hero-back.jpg, hero-depth-back.jpg")
