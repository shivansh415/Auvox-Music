# Recolours the Ibanez JEM diffuse texture to the AUVOX brand: red body, cream pickguard,
# "AUVOX" on the headstock instead of the maker's logo. Writes a new diffuse next to the original.
#   python3 scripts/guitar-red.py <model dir>
import sys, os
from PIL import Image, ImageDraw, ImageFont, ImageOps
import numpy as np

d = sys.argv[1]
src = os.path.join(d, "textures", "lambert4SG_diffuse.jpeg")
im = Image.open(src).convert("RGB")
W, H = im.size
k = W / 1024  # boxes below were read off a 1024px preview
a = np.asarray(im).astype(np.float32)
lum = a.mean(axis=2)

RED = np.array([0x85, 0x09, 0x09], np.float32)
CREAM = np.array([0xF1, 0xED, 0xE9], np.float32)

def box(x0, y0, x1, y1):
    return slice(int(y0 * k), int(y1 * k)), slice(int(x0 * k), int(x1 * k))

# body front, body back, control cover, headstock (UV islands of the dark lacquer)
for b in [box(380, 0, 762, 560), box(645, 478, 962, 926), box(770, 20, 892, 200), box(770, 200, 900, 480)]:
    sub = a[b]
    l = lum[b]
    on = l > 1.5                       # pure black = unused UV space
    # keep the wear/highlight detail as a brightness modulation of the brand red
    shade = np.clip(0.62 + (l / 255.0) * 1.9, 0.5, 1.45)[..., None]
    out = np.clip(RED * shade, 0, 255)
    sub[on] = out[on]
    a[b] = sub

# pickguard: light grey → cream, keep its shading
b = box(380, 540, 646, 870)
sub = a[b]; l = lum[b]
on = l > 60
sub[on] = np.clip(CREAM * (l[on] / 215.0)[..., None], 0, 255)
a[b] = sub

img = Image.fromarray(a.astype(np.uint8))

# headstock: paint over the maker's logo, then set "AUVOX" the way the original logo runs (top→bottom, mirrored UV)
logo = (box(830, 300, 884, 430))
patch = np.asarray(img).astype(np.float32)
patch[logo] = np.where((lum[logo] > 1.5)[..., None], RED * 0.95, patch[logo])
img = Image.fromarray(patch.astype(np.uint8))
font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Didot.ttc", int(58 * k), index=1)
tw, th = font.getbbox("AUVOX")[2:]
layer = Image.new("RGBA", (tw + 20, th + 30), (0, 0, 0, 0))
ImageDraw.Draw(layer).text((10, 4), "AUVOX", font=font, fill=(241, 237, 233, 255))
layer = ImageOps.mirror(layer.rotate(90, expand=True))
cx, cy = int(857 * k), int(362 * k)
img.paste(layer, (cx - layer.width // 2, cy - layer.height // 2), layer)

img.save(src.replace("diffuse.jpeg", "diffuse-red.jpeg"), quality=95)
img.resize((1024, 1024)).save(os.path.join(d, "preview-red.png"))
print("ok", img.size)
