"""The Reach's images: the sky, the cloud plate (as alpha) and the student's hand (cut out).

    .venv/bin/python scripts/reach-assets.py [hand-candidate] [sky-candidate] [clouds-candidate]

Reads   AUVOX Generation Pack/output/promise{Hand,Sky,Clouds}/cand-N.png
Writes  public/reach/sky.webp, clouds.webp (white with alpha), hand.webp (alpha), and prints the
        student's fingertip and wrist in hand.webp pixels for Reach.tsx.
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "..", "..", "AUVOX Generation Pack", "output")
PUB = os.path.join(HERE, "..", "public", "reach")
os.makedirs(PUB, exist_ok=True)
hand_n, sky_n, cloud_n = (sys.argv[1:] + ["2", "1", "1"][len(sys.argv) - 1:])[:3]

# ---- sky: as is, webp
sky = Image.open(os.path.join(OUT_DIR, "promiseSky", f"cand-{sky_n}.png")).convert("RGB")
sky.save(os.path.join(PUB, "sky.webp"), "WEBP", quality=82, method=6)
print("sky", sky.size)

# ---- clouds: luminance becomes alpha; the colour is a warm white (the page tints it further)
c = np.asarray(Image.open(os.path.join(OUT_DIR, "promiseClouds", f"cand-{cloud_n}.png")).convert("RGB")).astype(np.float32) / 255
lum = c @ np.array([0.299, 0.587, 0.114], np.float32)
alpha = np.clip((lum - 0.04) / 0.8, 0, 1) ** 0.9
shade = np.clip(lum / np.maximum(alpha, 1e-3), 0, 1)  # the cloud's own light and shadow
rgb = np.stack([0.99 * shade + 0.01, 0.95 * shade + 0.03, 0.89 * shade + 0.05], -1)
rgba = np.dstack([rgb, alpha])
Image.fromarray((rgba * 255).astype(np.uint8), "RGBA").save(os.path.join(PUB, "clouds.webp"), "WEBP", quality=80, method=6)
# the near bank slides down the frame, so its own top and sides must never show an edge
ch, cw = alpha.shape
ramp_y = np.clip((np.arange(ch, dtype=np.float32) / ch - 0.08) / 0.34, 0, 1) ** 1.5
ramp_x = np.clip(np.minimum(np.arange(cw), cw - 1 - np.arange(cw)).astype(np.float32) / (cw * 0.06), 0, 1)
near = np.dstack([rgb, alpha * ramp_y[:, None] * ramp_x[None, :]])
Image.fromarray((near * 255).astype(np.uint8), "RGBA").save(os.path.join(PUB, "clouds-near.webp"), "WEBP", quality=78, method=6)
print("clouds", rgba.shape[1::-1])

# ---- the hand: cut out with rembg, edges softened a touch
from rembg import new_session, remove  # noqa: E402

src = Image.open(os.path.join(OUT_DIR, "promiseHand", f"cand-{hand_n}.png")).convert("RGB")
cut = remove(src, session=new_session("isnet-general-use"), alpha_matting=True, alpha_matting_foreground_threshold=240, alpha_matting_background_threshold=20)
a = np.asarray(cut)[..., 3].astype(np.float32) / 255
a = cv2.GaussianBlur(a, (0, 0), 0.8)
# fade the arm out where it leaves the frame (bottom-right), so it can sink into cloud
h, w = a.shape
yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
corner = (xx / w + yy / h) / 2
a *= np.clip((0.97 - corner) / 0.22, 0, 1) ** 1.2
img = np.dstack([np.asarray(src), (a * 255).astype(np.uint8)])
Image.fromarray(img, "RGBA").save(os.path.join(PUB, "hand.webp"), "WEBP", quality=86, method=6)
mask = a > 0.5
ys, xs = np.nonzero(mask)
k = xs * 0.55 + ys * 0.83  # the fingertip is the point furthest up-left along the reach
i = int(np.argmin(k))
print(f"hand {w}x{h} tip=({xs[i]}, {ys[i]}) bbox=({xs.min()},{ys.min()})-({xs.max()},{ys.max()})")
