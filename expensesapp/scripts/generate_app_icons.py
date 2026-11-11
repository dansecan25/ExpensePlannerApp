"""Generates the Android and iOS app icons: a money bag with a calendar.

Run from the expensesapp folder:  python3 scripts/generate_app_icons.py
Needs Pillow (pip install pillow). Writes every icon size, so edit the shapes or colors here
and run it again instead of editing the PNGs.
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw

APP_DIR = Path(__file__).resolve().parent.parent
ANDROID_RES = APP_DIR / "android/app/src/main/res"
IOS_ICONSET = APP_DIR / "ios/expensesapp/Images.xcassets/AppIcon.appiconset"
DOCS_ICON = APP_DIR.parent / "documentationScreenshots/app-icon.png"

# Same colors as the app's theme (primary, accent and dark surface).
PRIMARY = (0x42, 0x61, 0xA0, 255)
ACCENT = (0x00, 0x7A, 0xFF, 255)
NAVY = (0x1F, 0x2A, 0x44, 255)
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)

FULL_COLOR = {"bg": PRIMARY, "shape": WHITE, "detail": NAVY, "mark": PRIMARY, "accent": ACCENT}
# Android 13 themed icons tint one silhouette, so details become holes in it.
MONOCHROME = {"bg": CLEAR, "shape": WHITE, "detail": CLEAR, "mark": CLEAR, "accent": CLEAR}

SUPERSAMPLE = 4
# Glyph scale as a fraction of the canvas. Adaptive foregrounds must stay inside the
# central 66dp of the 108dp layer, which is why they are drawn smaller.
LEGACY_SCALE = 0.36
ADAPTIVE_SCALE = 0.27

ANDROID_DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
IOS_ICONS = [  # (point size, scale, idiom)
    (20, 2, "iphone"), (20, 3, "iphone"), (29, 2, "iphone"), (29, 3, "iphone"),
    (40, 2, "iphone"), (40, 3, "iphone"), (60, 2, "iphone"), (60, 3, "iphone"),
    (1024, 1, "ios-marketing"),
]


def draw_glyph(draw, size, scale, colors):
    """Draws the bag and calendar in unit coordinates (roughly -1..1) centered on the canvas."""
    unit = size * scale
    cx, cy = size / 2 + 0.06 * unit, size / 2

    def p(x, y):
        return (cx + x * unit, cy + y * unit)

    def box(x0, y0, x1, y1):
        return [p(x0, y0), p(x1, y1)]

    def rounded(x0, y0, x1, y1, radius, fill):
        draw.rounded_rectangle(box(x0, y0, x1, y1), radius=radius * unit, fill=fill)

    shape, detail = colors["shape"], colors["detail"]

    def path(start, *curves):
        """Polygon through cubic Bézier segments, each given as (control 1, control 2, end)."""
        points, current = [p(*start)], start
        for c1, c2, end in curves:
            for step in range(1, 33):
                t = step / 32
                a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t ** 2, t ** 3
                points.append(p(*(a * current[i] + b * c1[i] + c * c2[i] + d * end[i]
                                  for i in range(2))))
            current = end
        draw.polygon(points, fill=shape)

    # Money bag: a pear-shaped body, the gathered cloth above the tie, and the tie.
    path((0.02, -0.46),
         ((0.12, -0.30), (0.50, 0.00), (0.50, 0.42)),
         ((0.50, 0.72), (0.24, 0.88), (-0.14, 0.88)),
         ((-0.52, 0.88), (-0.78, 0.72), (-0.78, 0.42)),
         ((-0.78, 0.00), (-0.40, -0.30), (-0.30, -0.46)))
    path((-0.30, -0.48),
         ((-0.38, -0.62), (-0.50, -0.74), (-0.52, -0.84)),
         ((-0.40, -0.98), (-0.22, -0.98), (-0.14, -0.80)),
         ((-0.06, -0.98), (0.12, -0.98), (0.24, -0.84)),
         ((0.22, -0.74), (0.10, -0.62), (0.02, -0.48)))
    rounded(-0.40, -0.55, 0.12, -0.41, 0.05, detail)

    # Dollar sign: two half-open arcs forming an S, and a vertical bar.
    mark, stroke = colors["mark"], max(1, round(0.10 * unit))
    radius, sx, sy = 0.17, -0.15, 0.38
    draw.arc(box(sx - radius, sy - 2 * radius, sx + radius, sy), 90, 330, fill=mark, width=stroke)
    draw.arc(box(sx - radius, sy, sx + radius, sy + 2 * radius), 270, 510, fill=mark, width=stroke)
    rounded(sx - 0.035, sy - 0.46, sx + 0.035, sy + 0.46, 0.03, mark)

    # Calendar, outlined in the background color so it separates from the bag.
    rounded(0.12, -0.68, 0.98, 0.12, 0.13, colors["bg"])
    rounded(0.18, -0.62, 0.92, 0.06, 0.09, detail)
    rounded(0.18, -0.44, 0.92, 0.06, 0.09, shape)
    draw.rectangle(box(0.18, -0.44, 0.92, -0.30), fill=shape)
    for ring_x in (0.36, 0.74):
        rounded(ring_x - 0.04, -0.74, ring_x + 0.04, -0.52, 0.04, shape)
    for row in range(2):
        for col in range(4):
            x0, y0 = 0.25 + col * 0.165, -0.34 + row * 0.18
            fill = colors["accent"] if (row, col) == (1, 2) else colors["mark"]
            rounded(x0, y0, x0 + 0.105, y0 + 0.11, 0.025, fill)


def render(size, scale, colors, background=None):
    """Renders at a larger size and scales down, for smooth edges at every size."""
    big = size * SUPERSAMPLE
    image = Image.new("RGBA", (big, big), CLEAR)
    draw = ImageDraw.Draw(image)
    if background == "square":
        draw.rectangle([0, 0, big, big], fill=colors["bg"])
    elif background == "rounded":
        inset = big * 0.04
        draw.rounded_rectangle([inset, inset, big - inset, big - inset], radius=big * 0.2,
                               fill=colors["bg"])
    elif background == "circle":
        inset = big * 0.04
        draw.ellipse([inset, inset, big - inset, big - inset], fill=colors["bg"])
    draw_glyph(draw, big, scale, colors)
    return image.resize((size, size), Image.LANCZOS)


def write_android():
    for density, factor in ANDROID_DENSITIES.items():
        folder = ANDROID_RES / f"mipmap-{density}"
        folder.mkdir(exist_ok=True)
        legacy = round(48 * factor)
        adaptive = round(108 * factor)
        render(legacy, LEGACY_SCALE, FULL_COLOR, "rounded").save(folder / "ic_launcher.png")
        render(legacy, LEGACY_SCALE, FULL_COLOR, "circle").save(folder / "ic_launcher_round.png")
        render(adaptive, ADAPTIVE_SCALE, FULL_COLOR).save(folder / "ic_launcher_foreground.png")
        render(adaptive, ADAPTIVE_SCALE, MONOCHROME).save(folder / "ic_launcher_monochrome.png")

    hex_color = "#{:02X}{:02X}{:02X}".format(*PRIMARY[:3])
    (ANDROID_RES / "values/ic_launcher_background.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        f'    <color name="ic_launcher_background">{hex_color}</color>\n</resources>\n'
    )
    adaptive_xml = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@color/ic_launcher_background" />\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n'
        '    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />\n'
        '</adaptive-icon>\n'
    )
    anydpi = ANDROID_RES / "mipmap-anydpi-v26"
    anydpi.mkdir(exist_ok=True)
    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        (anydpi / name).write_text(adaptive_xml)


def write_ios():
    images = []
    for points, scale, idiom in IOS_ICONS:
        filename = f"icon-{points}@{scale}x.png"
        # iOS rounds the corners itself and rejects icons with transparency.
        render(points * scale, LEGACY_SCALE, FULL_COLOR, "square").convert("RGB").save(
            IOS_ICONSET / filename)
        images.append({"filename": filename, "idiom": idiom, "scale": f"{scale}x",
                       "size": f"{points}x{points}"})
    contents = {"images": images, "info": {"author": "xcode", "version": 1}}
    (IOS_ICONSET / "Contents.json").write_text(json.dumps(contents, indent=2) + "\n")


if __name__ == "__main__":
    write_android()
    write_ios()
    render(512, LEGACY_SCALE, FULL_COLOR, "rounded").save(DOCS_ICON)
    print("Icons written.")
