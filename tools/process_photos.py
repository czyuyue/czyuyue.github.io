"""Normalize photos in assets/photos/ (run locally: python tools/process_photos.py).

For every image in assets/photos/:
  - convert HEIC/PNG/etc. to JPEG,
  - downscale so the long side is at most MAX_SIDE px,
  - strip all metadata (EXIF, incl. GPS location), keeping orientation applied.
Then write assets/photos/index.json (fallback list for the gallery): [{"src": ..., "caption": ..., "w": ..., "h": ...}],
newest first (by the time the file was first added to git).

Captions come from file names: "Kingfisher, Beijing 2026.jpg" -> "Kingfisher, Beijing 2026".
Names that look camera-generated (IMG_1234, DSC01234, 20261109_...) get no caption.
"""
import json
import re
import subprocess
from pathlib import Path

from PIL import Image, ImageOps
from pillow_heif import register_heif_opener

register_heif_opener()

PHOTO_DIR = Path("assets/photos")
MAX_SIDE = 2000
EXTS = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp", ".tif", ".tiff"}
CAMERA_NAME = re.compile(r"^(img|dsc|dscf|pxl|mvimg|photo|image)?[_\-\s]?\d[\d_\-\s]*$", re.I)


def first_added_ts(path: Path) -> int:
    out = subprocess.run(
        ["git", "log", "--diff-filter=A", "--follow", "--format=%ct", "--", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout.split()
    return int(out[-1]) if out else 0


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


def caption_for(path: Path) -> str:
    stem = path.stem.strip()
    if CAMERA_NAME.match(stem):
        return ""
    return re.sub(r"[_]+", " ", stem)


def main():
    entries = []
    for p in sorted(PHOTO_DIR.iterdir()):
        if p.suffix.lower() not in EXTS:
            continue
        ts = first_added_ts(p)
        p = normalize(p)
        with Image.open(p) as im:
            w, h = im.size
        entries.append({"src": f"assets/photos/{p.name}", "caption": caption_for(p),
                        "w": w, "h": h, "_ts": ts})
    entries.sort(key=lambda e: (-e["_ts"], e["src"]))
    for e in entries:
        del e["_ts"]
    (PHOTO_DIR / "index.json").write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n")
    print(f"{len(entries)} photos in manifest")


if __name__ == "__main__":
    main()
