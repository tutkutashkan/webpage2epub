"""Generate the toolbar icons from the Convert2EPUB logo artwork.

    python3 scripts/make_icons.py [source]

`source` defaults to assets/logo-source.png. The artwork lives in assets/
rather than src/icons/ so the build never sweeps a megabyte of source PNG
into the shipped package. Re-run whenever the logo changes; the generated
icons are committed, so a build never depends on this script.

Large sizes are a straight downscale of the artwork. Small ones are rebuilt:
the source logo is a soft-shaded square with the glyph filling only ~59% of
its height, and at 16px that shading turns to noise while the glyph turns to
mush. So 16 and 32 are recomposed as a flat spine-green square carrying the
same glyph, enlarged to use the space. Same mark, no redrawing — just the
padding and the gloss taken out where there are no pixels to spare.
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = ROOT / "assets" / "logo-source.png"
OUT_DIR = ROOT / "src" / "icons"

# Sizes the manifest asks for. "recompose" rebuilds the square and enlarges
# the glyph; "downscale" is a straight resample of the artwork.
#
# Unsharp is applied only at 32: it rescues the edges there, but at 16 the
# glyph strokes are already sub-pixel and sharpening only rings them with dark
# halos.
SIZES = {
    16: ("recompose", None),
    32: ("recompose", (0.8, 60, 3)),
    48: ("downscale", None),
    128: ("downscale", None),
}

SPINE_500 = (46, 101, 83, 255)

# Alpha above this counts as the mark itself rather than the glow feathering
# out around it, so the crop lands on the logo's own edge.
SOLID_ALPHA = 128
# A pixel this bright and this opaque is part of the white glyph.
GLYPH_LUMA = 200

# Proportions for the recomposed sizes.
CORNER_RATIO = 0.225  # rounded-square radius, matching the source's corners
GLYPH_FILL = 0.90  # glyph width as a share of the square
SUPERSAMPLE = 8  # drawn large, then downsampled, so corners stay smooth


def solid_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    mask = image.getchannel("A").point(lambda v: 255 if v > SOLID_ALPHA else 0)
    return mask.getbbox()


def glyph_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    """Bounding box of the white glyph inside the coloured square."""
    red, green, blue, alpha = image.split()
    bright = Image.eval(
        Image.merge("RGB", (red, green, blue)).convert("L"),
        lambda v: 255 if v > GLYPH_LUMA else 0,
    )
    opaque = alpha.point(lambda v: 255 if v > SOLID_ALPHA else 0)
    return Image.composite(bright, Image.new("L", image.size, 0), opaque).getbbox()


def square_pad(image: Image.Image) -> Image.Image:
    width, height = image.size
    side = max(width, height)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(image, ((side - width) // 2, (side - height) // 2))
    return square


def downscale(artwork: Image.Image, size: int) -> Image.Image:
    box = solid_bbox(artwork)
    cropped = artwork.crop(box) if box else artwork
    return square_pad(cropped).resize((size, size), Image.LANCZOS)


def recompose(
    artwork: Image.Image,
    size: int,
    sharpen: tuple[float, int, int] | None,
) -> Image.Image:
    """Flat spine-green square carrying the glyph, enlarged to fill it."""
    box = glyph_bbox(artwork)
    if not box:
        return downscale(artwork, size)

    big = size * SUPERSAMPLE
    canvas = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    ImageDraw.Draw(canvas).rounded_rectangle(
        (0, 0, big - 1, big - 1),
        radius=int(big * CORNER_RATIO),
        fill=SPINE_500,
    )

    glyph = artwork.crop(box)
    target_width = int(big * GLYPH_FILL)
    target_height = max(1, round(glyph.height * target_width / glyph.width))
    glyph = glyph.resize((target_width, target_height), Image.LANCZOS)

    canvas.alpha_composite(
        glyph, ((big - target_width) // 2, (big - target_height) // 2)
    )

    icon = canvas.resize((size, size), Image.LANCZOS)
    if sharpen:
        radius, percent, threshold = sharpen
        icon = icon.filter(
            ImageFilter.UnsharpMask(radius=radius, percent=percent, threshold=threshold)
        )
    return icon


def main() -> None:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SOURCE
    if not source.exists():
        raise SystemExit(f"No logo at {source}.")

    artwork = Image.open(source).convert("RGBA")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for size, (strategy, sharpen) in SIZES.items():
        icon = (
            recompose(artwork, size, sharpen)
            if strategy == "recompose"
            else downscale(artwork, size)
        )
        out = OUT_DIR / f"icon{size}.png"
        icon.save(out, "PNG", optimize=True)
        print(f"wrote {out.relative_to(ROOT)} ({strategy}, {out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
