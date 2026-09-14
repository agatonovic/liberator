#!/usr/bin/env python3
"""Raster-compare LABELATOR reference PDF vs Python PDF."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import fitz
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageEnhance


def render_pages(pdf_path: Path, out_dir: Path, dpi: int = 150) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    paths: list[Path] = []
    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)
    for i, page in enumerate(doc):
        pix = page.get_pixmap(matrix=mat, alpha=False)
        path = out_dir / f"page-{i + 1}.png"
        pix.save(str(path))
        paths.append(path)
    doc.close()
    return paths


def compare_pair(ref: Path, py: Path, diff_path: Path) -> dict:
    a = Image.open(ref).convert("RGB")
    b = Image.open(py).convert("RGB")
    if a.size != b.size:
        b = b.resize(a.size, Image.Resampling.NEAREST)
    aa = np.asarray(a, dtype=np.float32)
    bb = np.asarray(b, dtype=np.float32)
    absdiff = np.abs(aa - bb)
    mean_abs = float(absdiff.mean() / 255.0)
    # changed pixels: any channel delta > 16/255
    changed = (absdiff.max(axis=2) > 16).mean()
    # SSIM-ish via simple luminance correlation (lightweight)
    la = aa.mean(axis=2)
    lb = bb.mean(axis=2)
    mu_a, mu_b = la.mean(), lb.mean()
    sigma_a = la.std()
    sigma_b = lb.std()
    sigma_ab = ((la - mu_a) * (lb - mu_b)).mean()
    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    ssim = float(((2 * mu_a * mu_b + c1) * (2 * sigma_ab + c2)) / ((mu_a**2 + mu_b**2 + c1) * (sigma_a**2 + sigma_b**2 + c2) + 1e-9))

    diff_img = ImageChops.difference(a, b)
    # amplify for visibility
    diff_img = ImageEnhance.Brightness(diff_img).enhance(4.0)
    diff_path.parent.mkdir(parents=True, exist_ok=True)
    diff_img.save(diff_path)

    # bounding box of significant differences
    mask = (absdiff.max(axis=2) > 24).astype(np.uint8)
    ys, xs = np.where(mask > 0)
    bbox = None
    if len(xs):
        bbox = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]

    return {
        "mean_abs_diff": round(mean_abs, 6),
        "changed_pixel_fraction": round(float(changed), 6),
        "ssim_approx": round(ssim, 6),
        "diff_bbox": bbox,
        "size": list(a.size),
    }


def write_side_by_side(ref: Path, py: Path, dest: Path) -> None:
    """Same-scale rasters with captions. Does not resize one independently of the other."""
    left = Image.open(ref).convert("RGB")
    right = Image.open(py).convert("RGB")
    if left.size != right.size:
        raise ValueError(f"Raster size mismatch {left.size} vs {right.size}")
    gap = 16
    header = 36
    canvas = Image.new("RGB", (left.width * 2 + gap, left.height + header), "white")
    draw = ImageDraw.Draw(canvas)
    draw.rectangle([0, 0, canvas.width, header], fill=(18, 38, 58))
    draw.text((12, 10), "LABELATOR REFERENCE", fill="white")
    draw.text((left.width + gap + 12, 10), "PYTHON RENDERER", fill="white")
    canvas.paste(left, (0, header))
    canvas.paste(right, (left.width + gap, header))
    dest.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(dest)


def write_index(out_root: Path, label: str, metrics: list[dict], slots: int) -> None:
    lines = [
        f"# {label} golden comparison",
        "",
        "Open the side-by-side PNGs to inspect LABELATOR and Python at the same pixel size.",
        "",
        "DPI: 150. PDFs are not byte-identical. Numbers are raster appearance.",
        "",
    ]
    for item in metrics:
        page = item["page"]
        start = (page - 1) * slots + 1
        end = start + slots - 1
        lines.extend(
            [
                f"## Page {page}",
                "",
                f"Golden rows {start}–{end} (empty slots on the last page stay blank).",
                "",
                f"- reference: `reference/page-{page}.png`",
                f"- python: `python/page-{page}.png`",
                f"- side-by-side: `comparison/page-{page}-side-by-side.png`",
                f"- diff: `diff/page-{page}.png`",
                f"- mean abs: {item['mean_abs_diff']}",
                f"- changed pixels: {item['changed_pixel_fraction']}",
                f"- SSIM: {item['ssim_approx']}",
                f"- size: {item['size'][0]}×{item['size'][1]}",
                "",
            ]
        )
    (out_root / "README.md").write_text("\n".join(lines), encoding="utf-8")


def _regions_for(label: str, size: tuple[int, int]) -> dict[str, tuple[int, int, int, int]]:
    w, h = size
    if label == "cdc_a3":
        return {
            "building": (0, 0, w, int(h * 0.34)),
            "warehouse": (0, int(h * 0.30), w, int(h * 0.64)),
            "barcode": (0, int(h * 0.60), w, h),
        }
    if label == "canopy_a3_1pn":
        return {
            "part": (0, 0, w, int(h * 0.42)),
            "position": (0, int(h * 0.38), w, int(h * 0.68)),
            "magacin": (0, int(h * 0.62), int(w * 0.22), int(h * 0.72)),
            "barcode": (0, int(h * 0.66), w, h),
        }
    if label == "canopy_a3_3pn":
        return {
            "parts": (0, 0, w, int(h * 0.50)),
            "position": (0, int(h * 0.45), w, int(h * 0.70)),
            "magacin": (0, int(h * 0.62), int(w * 0.22), int(h * 0.74)),
            "barcode": (0, int(h * 0.66), w, h),
        }
    if label == "ga_address":
        # Fractions of the 409×81 mm sticker, not hard-coded template ids.
        return {
            "magacin": (0, int(h * 0.22), int(w * 0.34), int(h * 0.72)),
            "regal": (int(w * 0.30), int(h * 0.22), int(w * 0.70), int(h * 0.72)),
            "nivo": (int(w * 0.66), int(h * 0.22), int(w * 0.90), int(h * 0.72)),
            "barcode": (int(w * 0.12), int(h * 0.65), int(w * 0.88), h),
            "arrow": (int(w * 0.88), int(h * 0.20), w, int(h * 0.85)),
        }
    return {
        "part-number": (40, 160, min(w, 2440), min(h, 520)),
        "barcode": (0, int(h * 0.68), w, h),
        "arrows": (1000, 480, min(w, 1750), min(h, 780)),
    }


def main() -> int:
    import argparse

    root = Path(__file__).resolve().parents[2]
    p = argparse.ArgumentParser(description="Raster-compare a LABELATOR reference PDF to a Python PDF")
    p.add_argument("--label", default="warehouse_a3")
    p.add_argument("--ref", type=Path)
    p.add_argument("--python", dest="python_pdf", type=Path)
    p.add_argument("--out", type=Path)
    p.add_argument("--slots", type=int, default=1)
    args = p.parse_args()
    label = args.label
    ref_pdf = args.ref or (root / "artifacts/golden/warehouse_a3_labelator_reference.pdf")
    py_pdf = args.python_pdf or (root / "artifacts/golden/warehouse_a3_python.pdf")
    out_root = args.out or (root / "artifacts/golden")
    if not ref_pdf.exists() or not py_pdf.exists():
        print("Missing PDFs", ref_pdf.exists(), py_pdf.exists(), file=sys.stderr)
        return 1
    ref_dir = out_root / "reference"
    py_dir = out_root / "python"
    diff_dir = out_root / "diff"
    refs = render_pages(ref_pdf, ref_dir)
    pys = render_pages(py_pdf, py_dir)
    metrics = []
    for i, (r, pth) in enumerate(zip(refs, pys), start=1):
        m = compare_pair(r, pth, diff_dir / f"page-{i}.png")
        m["page"] = i
        metrics.append(m)
        print(f"page {i}: mean_abs={m['mean_abs_diff']:.4f} changed={m['changed_pixel_fraction']:.4f} ssim≈{m['ssim_approx']:.4f}")
    crops = out_root / "crops"
    crops.mkdir(parents=True, exist_ok=True)
    for i, (r, pth) in enumerate(zip(refs, pys), start=1):
        ref_img = Image.open(r)
        py_img = Image.open(pth)
        for name, box in _regions_for(label, ref_img.size).items():
            ref_img.crop(box).save(crops / f"reference-page-{i}-{name}.png")
            py_img.crop(box).save(crops / f"python-page-{i}-{name}.png")
    comparison = out_root / "comparison"
    for i, (r, pth) in enumerate(zip(refs, pys), start=1):
        write_side_by_side(r, pth, comparison / f"page-{i}-side-by-side.png")
    out = out_root / "metrics.json"
    out.write_text(json.dumps({"label": label, "dpi": 150, "pages": metrics}, indent=2) + "\n", encoding="utf-8")
    write_index(out_root, label, metrics, max(1, args.slots))
    print(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
