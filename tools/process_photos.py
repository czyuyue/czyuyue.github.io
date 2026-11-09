"""Normalize photos under assets/photos/<topic>/ (run locally: python tools/process_photos.py).

For every image in the topic folders:
  - convert HEIC/PNG/etc. to JPEG,
  - downscale so the long side is at most MAX_SIDE px,
  - strip all metadata (EXIF, incl. GPS location), keeping orientation applied.
Already-processed JPEGs are left untouched, so re-running is safe.
"""
import re
from pathlib import Path

from PIL import Image, ImageOps
from pillow_heif import register_heif_opener

register_heif_opener()

PHOTO_DIR = Path("assets/photos")
MAX_SIDE = 2000
EXTS = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp", ".tif", ".tiff"}


def is_processed(path: Path) -> bool:
    """True if `path` is already a small, metadata-free JPEG (avoids re-compressing)."""
    with Image.open(path) as im:
        return (path.suffix == ".jpg" and im.format == "JPEG" and max(im.size) <= MAX_SIDE
                and len(im.getexif()) == 0)


def normalize(path: Path) -> Path:
    """Re-encode `path` as a metadata-free JPEG; return the new path."""
    if is_processed(path):
        return path
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        out = path.with_suffix(".jpg")
        im.save(out, "JPEG", quality=86, optimize=True, progressive=True)
    if out != path:
        path.unlink()
    return out


def main():
    n = 0
    for p in sorted(PHOTO_DIR.rglob("*")):
        if p.is_file() and p.suffix.lower() in EXTS:
            normalize(p)
            n += 1
    print(f"{n} photos checked")


if __name__ == "__main__":
    main()
