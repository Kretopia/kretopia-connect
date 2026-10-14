"""
Hero Kreto Waving, HD (see AGENTS.md: the layers must stay aligned, HD and in Flying's palette): built from the official 3D render (kreto-mascot-hero-wave.png,
1378x1141, the same character as kreto-main-cutout and Flying) instead of the 768 px
chibi art. Same palette as Flying: pearl white-lavender shell, no rim glow or halo,
violet ear lenses, eyes and K untouched. Split into body + arm layers (arm = forearm and
hand, pivot at the elbow) so the wave stays a compositor transform.
"""
import os
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

# Run from anywhere: `python3 scripts/build-hero-kreto-wave.py` previews (sheets go to the temp
# folder, or $KRETO_PREVIEW_DIR); `... write` regenerates the two WebP layers in src/assets.
R = str(Path(__file__).resolve().parent.parent) + "/"
OUT = os.environ.get("KRETO_PREVIEW_DIR", tempfile.gettempdir()) + "/"
WRITE = len(sys.argv) > 1 and sys.argv[1] == "write"

SRC = R + "src/assets/brand/kreto/kreto-mascot-hero-wave.png"
FLY = R + "src/assets/brand/kreto/kreto-flying.webp"

SHELL_H = int(262 / 360 * 255)   # mean of Flying's bright shell: (226, 219, 235)
VIOLET_H = int(272 / 360 * 255)  # Flying's lens / black parts sheen
SHELL_S_CAP = 38                 # Flying's bright shell is ~7% saturated
SHELL_S_GAIN = 0.27
EDGE_DEPTH = 10                  # px of silhouette recoloured from the inside
EYE_BOX = (430, 235, 1010, 540)
K_BOX = (730, 630, 875, 775)
EAR_ELLIPSES = [(350, 420, 72, 152), (1005, 235, 66, 122)]  # cx, cy, rx, ry in source coordinates
MAGENTA_H = int(322 / 360 * 255)

# Arm = forearm sleeve + hand. Polygon follows the dark gap between the helmet rim and the
# thumb/sleeve, then the sleeve's left edge a few px into the shoulder joint (overlap, so the
# two layers never leave a hairline seam).
ARM_POLY = [
    (1040, 385), (1240, 385), (1240, 735), (1010, 735), (996, 696), (971, 675), (951, 640),
    (941, 600), (936, 570), (935, 562), (945, 535), (965, 505), (985, 480), (1008, 447),
]
PIVOT = (965, 655)  # elbow, in source coordinates


def ramp(img, lo, hi):
    span = max(1, hi - lo)
    return img.point([max(0, min(255, int((v - lo) * 255 / span))) for v in range(256)])


def binary(img, lo):
    return img.point([255 if v >= lo else 0 for v in range(256)])


def inv(img):
    return img.point([255 - v for v in range(256)])


def mul(a, b):
    return ImageChops.multiply(a, b)


def components_keep(mask, min_area):
    w, h = mask.size
    px = mask.load()
    seen = bytearray(w * h)
    keep = Image.new("L", (w, h), 0)
    kp = keep.load()
    for y0 in range(h):
        for x0 in range(w):
            i0 = y0 * w + x0
            if seen[i0] or px[x0, y0] < 128:
                continue
            stack = [(x0, y0)]
            seen[i0] = 1
            comp = []
            while stack:
                x, y = stack.pop()
                comp.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if not seen[j] and px[nx, ny] >= 128:
                            seen[j] = 1
                            stack.append((nx, ny))
            if len(comp) >= min_area:
                for x, y in comp:
                    kp[x, y] = 255
    return keep


def components_label(mask):
    w, h = mask.size
    px = mask.load()
    seen = bytearray(w * h)
    out = []
    for y0 in range(h):
        for x0 in range(w):
            i0 = y0 * w + x0
            if seen[i0] or px[x0, y0] < 128:
                continue
            stack = [(x0, y0)]
            seen[i0] = 1
            comp = []
            while stack:
                x, y = stack.pop()
                comp.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        j = ny * w + nx
                        if not seen[j] and px[nx, ny] >= 128:
                            seen[j] = 1
                            stack.append((nx, ny))
            out.append(comp)
    return out


def erode(mask, n):
    for _ in range(n):
        mask = mask.filter(ImageFilter.MinFilter(3))
    return mask


def inpaint_edge(rgb, core, depth):
    """The outer `depth` px of the silhouette take the colour just inside it."""
    w, h = rgb.size
    trusted = erode(core, depth)
    px = rgb.load()
    cp = core.load()
    tp = trusted.load()
    filled = bytearray(w * h)
    todo = []
    for y in range(h):
        for x in range(w):
            if tp[x, y] >= 128:
                filled[y * w + x] = 1
            elif cp[x, y] >= 128:
                todo.append((x, y))
    for _ in range(depth + 3):
        if not todo:
            break
        nxt, assigned = [], []
        for x, y in todo:
            sr = sg = sb = n = 0
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and filled[ny * w + nx]:
                        r, g, b = px[nx, ny]
                        sr += r
                        sg += g
                        sb += b
                        n += 1
            if n:
                assigned.append((x, y, (sr // n, sg // n, sb // n)))
            else:
                nxt.append((x, y))
        for x, y, c in assigned:
            px[x, y] = c
            filled[y * w + x] = 1
        todo = nxt
    return rgb


def box_mask(size, box):
    m = Image.new("L", size, 0)
    m.paste(255, box)
    return m


def round_dilate(mask, sigma, thr):
    return binary(mask.filter(ImageFilter.GaussianBlur(sigma)), thr)


src = Image.open(SRC).convert("RGBA")
W, H = src.size
r, g, b, a = src.split()

# 1. Silhouette: glow removed, continuous (anti-aliased) alpha, specks dropped.
soft = ramp(a, 165, 240)
core = components_keep(binary(soft, 128), 4000)
alpha = ImageChops.darker(soft, core.filter(ImageFilter.MaxFilter(7)))
alpha = alpha.filter(ImageFilter.GaussianBlur(0.5))

# 2. The rim takes the colour of the surface just inside it.
rgb = inpaint_edge(Image.merge("RGB", (r, g, b)), core, EDGE_DEPTH)

# 3. Palette.
hsv = rgb.convert("HSV")
h, s, v = hsv.split()

# Eyes: the non-dark pixels fully enclosed by the dark visor, kept only where they belong to an
# eye (a component with real saturated glow), so the visor gloss is treated like the shell.
alpha_solid = binary(alpha, 128)
wall = mul(v.point([255 if val < 70 else 0 for val in range(256)]), alpha_solid)
flood = wall.copy()
ImageDraw.floodfill(flood, (0, 0), 128)
enclosed = ImageChops.subtract(binary(flood, 1).point([0 if val else 255 for val in range(256)]), wall)
enclosed = mul(enclosed, mul(alpha_solid, box_mask(src.size, EYE_BOX)))
glow_px = mul(binary(s, 140), binary(v, 140))
labels = components_label(enclosed)
eye_mask = Image.new("L", src.size, 0)
ep = eye_mask.load()
gp = glow_px.load()
for comp_pixels in labels:
    if any(gp[x, y] for x, y in comp_pixels[::7]) and len(comp_pixels) > 300:
        for x, y in comp_pixels:
            ep[x, y] = 255
eyes = round_dilate(eye_mask, 2.2, 40)
k_core = mul(box_mask(src.size, K_BOX), mul(binary(s, 110), binary(v, 100)))
protect = ImageChops.lighter(eyes, round_dilate(k_core, 1.6, 60))
# Ear lenses keep the render's own gloss (blue-violet lens, neon rim): only the colours that read
# as an aura (orange / yellow) become the magenta rim Flying has.
ear_zone = Image.new("L", src.size, 0)
ez = ImageDraw.Draw(ear_zone)
for ecx, ecy, erx, ery in EAR_ELLIPSES:
    ez.ellipse((ecx - erx, ecy - ery, ecx + erx, ecy + ery), fill=255)
# Strong colour only (ring, lens, rim): the faint bloom on the shell around them is not an ear.
ear_core = mul(ear_zone, mul(binary(s, 150), binary(v, 35)))
ears = round_dilate(ear_core, 1.6, 60)
protect = ImageChops.lighter(protect, ears)
orange = mul(binary(h, 0), inv(binary(h, 36)))
keep_hard = inv(protect)
keep = keep_hard.filter(ImageFilter.GaussianBlur(1.0))   # feathered: blends are in RGB, so no hue wrap

def hsv_rgb(hue_img, sat_img, val_img):
    return Image.merge("HSV", (hue_img, sat_img, val_img)).convert("RGB")

def hue_const(value):
    return Image.new("L", src.size, value)

# Dark but tinted parts (gloves, boots, joints, visor bloom): orange/pink sheen -> Flying's violet.
violet_rgb = hsv_rgb(hue_const(VIOLET_H), s, v)
tint_w = mul(ImageChops.lighter(ramp(s, 18, 70), ramp(inv(v), 165, 195)), keep)
out = Image.composite(violet_rgb, rgb, tint_w)

# Every bright pixel that is not an eye, the K or an ear: pearl white-lavender, Flying's shell.
s_new = s.point([min(int(val * SHELL_S_GAIN), SHELL_S_CAP) for val in range(256)])
shell_rgb = hsv_rgb(hue_const(SHELL_H), s_new, v)
w_shell = mul(ramp(v, 110, 190), keep)
out = Image.composite(shell_rgb, out, w_shell)

# Ears keep the render's gloss; only the orange / yellow that reads as an aura becomes magenta.
magenta_rgb = hsv_rgb(hue_const(MAGENTA_H), s, v)
ear_orange = mul(mul(ears, orange), binary(s, 90)).filter(ImageFilter.GaussianBlur(0.8))
out = Image.composite(magenta_rgb, out, ear_orange)
full = Image.merge("RGBA", (*out.split(), alpha))

# 4. Split: body = everything but the arm, arm = forearm + hand (slightly larger: overlap).
arm_hard = Image.new("L", src.size, 0)
ImageDraw.Draw(arm_hard).polygon(ARM_POLY, fill=255)
arm_mask = arm_hard.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.2))
body_alpha = mul(alpha, inv(arm_hard))
arm_alpha = mul(alpha, arm_mask)
body = Image.merge("RGBA", (*out.split(), body_alpha))
arm_full = Image.merge("RGBA", (*out.split(), arm_alpha))

bbox_all = alpha.point([255 if val > 8 else 0 for val in range(256)]).getbbox()
print("figure bbox", bbox_all)
PAD = 6
cx0, cy0, cx1, cy1 = bbox_all[0] - PAD, bbox_all[1] - PAD, bbox_all[2] + PAD, bbox_all[3] + PAD
body_c = body.crop((cx0, cy0, cx1, cy1))
ab = arm_alpha.point([255 if val > 8 else 0 for val in range(256)]).getbbox()
ax0, ay0, ax1, ay1 = ab[0] - PAD, ab[1] - PAD, ab[2] + PAD, ab[3] + PAD
arm_c = arm_full.crop((ax0, ay0, ax1, ay1))
print("canvas", body_c.size, "arm crop", arm_c.size, "arm offset in canvas", (ax0 - cx0, ay0 - cy0),
      "pivot in arm", (PIVOT[0] - ax0, PIVOT[1] - ay0))

# Helmet width in the canvas (ear cup to ear cup), measured on the alpha of the rows 60..560.
helmet = alpha.crop((cx0, 60, cx1, 380)).point([255 if val > 128 else 0 for val in range(256)]).getbbox()
print("helmet x-extent in source", (helmet[0] + cx0, helmet[2] + cx0), "width", helmet[2] - helmet[0])

fly = Image.open(FLY).convert("RGBA")


def box300(im, size):
    im2 = im.resize((size, size), Image.LANCZOS)
    c = Image.new("RGBA", (300, 300), (0, 0, 0, 0))
    c.alpha_composite(im2, ((300 - size) // 2, (300 - size) // 2))
    return c


comp = body_c.copy()
comp.alpha_composite(arm_c, (ax0 - cx0, ay0 - cy0))
for name, bgc in (("dark", (10, 10, 12, 255)), ("light", (250, 250, 250, 255))):
    sheet = Image.new("RGBA", (1500, 640), bgc)
    s_ = 600 / comp.height
    sheet.alpha_composite(comp.resize((int(comp.width * s_), 600), Image.LANCZOS), (20, 20))
    fsz = 420
    sheet.alpha_composite(fly.resize((fsz, fsz), Image.LANCZOS), (700, 20))
    # 1x-ish preview at the displayed size (figure ~290 px tall)
    small = comp.resize((int(comp.width * 290 / comp.height), 290), Image.LANCZOS)
    sheet.alpha_composite(small, (1150, 330))
    sheet.save(OUT + f"hd_sheet_{name}.png")
    # 2x zoom of head + arm
    zbox = (int(0.3 * comp.width), 0, comp.width, int(0.62 * comp.height))
    z = Image.new("RGBA", (zbox[2] - zbox[0], zbox[3] - zbox[1]), bgc)
    z.alpha_composite(comp.crop(zbox))
    z.save(OUT + f"hd_zoom_{name}.png")

if WRITE:
    body_c.save(R + "src/assets/brand/kreto/hero-wave-hd-body.webp", "WEBP", quality=90, alpha_quality=100, method=6)
    arm_c.save(R + "src/assets/brand/kreto/hero-wave-hd-arm.webp", "WEBP", quality=90, alpha_quality=100, method=6)
    print("written")
print("ok")
