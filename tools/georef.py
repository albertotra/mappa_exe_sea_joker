#!/usr/bin/env python3
"""Georeferenzia le cartine A3 (ORTO10K / CTR10K) e produce WebP + bounds WGS84.

Le cartine hanno la griglia UTM 33N stampata (1 km). Punti di controllo misurati
sui pixel a 150 dpi (identici per entrambe le cartine):
  E 699000 -> x 367.5, E 700000 -> x 957.5, E 701000 -> x 1548.5   (590.5 px/km)
  N 4501000 -> y 383.5, N 4500000 -> y 974.3, N 4499000 -> y 1564.5
Si ritaglia l'area dei quadranti (E 698550-701750, N 4498750-4501500, senza
legenda ne' etichette) e si riproietta in EPSG:4326 con GDAL (corregge la
convergenza meridiana di ~1.4 gradi).

Uso: python3 tools/georef.py <pdf> <chiave> [--transparent-white]
Richiede: pdftoppm, gdal_translate, gdalwarp, gdalinfo, Pillow, numpy, scipy.
"""
import json, subprocess, sys, tempfile
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

DPI = 200
PX_PER_KM_150 = 590.5
X0_150, E0 = 367.5, 699000.0      # pixel x di E=699000 a 150 dpi
Y0_150, N0 = 383.5, 4501000.0     # pixel y di N=4501000 a 150 dpi
EXTENT = dict(e_min=698550.0, e_max=701750.0, n_min=4498750.0, n_max=4501500.0)
ROOT = Path(__file__).resolve().parent.parent


def px(e=None, n=None):
    s = DPI / 150
    if e is not None:
        return (X0_150 + (e - E0) / 1000 * PX_PER_KM_150) * s
    return (Y0_150 - (n - N0) / 1000 * PX_PER_KM_150) * s


def run(*cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout


def main():
    pdf, key = Path(sys.argv[1]), sys.argv[2]
    transparent = "--transparent-white" in sys.argv
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        run("pdftoppm", "-r", str(DPI), "-png", "-singlefile", str(pdf), str(tmp / "page"))
        img = Image.open(tmp / "page.png").convert("RGB")
        box = (round(px(e=EXTENT["e_min"])), round(px(n=EXTENT["n_max"])),
               round(px(e=EXTENT["e_max"])), round(px(n=EXTENT["n_min"])))
        img.crop(box).save(tmp / "crop.png")
        # ullr esatti per il riquadro ritagliato (arrotondamento a pixel incluso)
        scale = PX_PER_KM_150 * DPI / 150 / 1000  # px per metro
        ulx = E0 + (box[0] / (DPI / 150) - X0_150) / PX_PER_KM_150 * 1000
        uly = N0 - (box[1] / (DPI / 150) - Y0_150) / PX_PER_KM_150 * 1000
        lrx = ulx + (box[2] - box[0]) / scale
        lry = uly - (box[3] - box[1]) / scale
        run("gdal_translate", "-of", "GTiff", "-a_srs", "EPSG:32633",
            "-a_ullr", str(ulx), str(uly), str(lrx), str(lry), str(tmp / "crop.png"), str(tmp / "utm.tif"))
        run("gdalwarp", "-t_srs", "EPSG:4326", "-r", "bilinear", "-dstalpha",
            "-overwrite", str(tmp / "utm.tif"), str(tmp / "ll.tif"))
        info = json.loads(run("gdalinfo", "-json", str(tmp / "ll.tif")))
        (w, s_), (e, n) = info["cornerCoordinates"]["lowerLeft"], info["cornerCoordinates"]["upperRight"]
        out = Image.open(tmp / "ll.tif").convert("RGBA")
        if transparent:
            a = np.array(out)
            white = (a[..., :3].min(axis=2) > 225) & (a[..., 3] > 0)
            dense = ndimage.uniform_filter(white.astype(float), 15) > 0.5
            lab, _ = ndimage.label(dense)
            edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
            outside = ndimage.binary_dilation(np.isin(lab, list(edge)), iterations=4)
            a[outside, 3] = 0
            out = Image.fromarray(a)
        data_dir = ROOT / "data"
        data_dir.mkdir(exist_ok=True)
        target = data_dir / f"{key}.webp"
        out.save(target, "WEBP", quality=80, method=6)
        print(f"{target.name}: {target.stat().st_size / 1e6:.2f} MB, bounds SW=({s_:.6f},{w:.6f}) NE=({n:.6f},{e:.6f})")
        meta_path = data_dir / "overlays.json"
        meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
        meta[key] = {"file": f"data/{key}.webp", "bounds": [[s_, w], [n, e]], "label": key.upper()}
        meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
