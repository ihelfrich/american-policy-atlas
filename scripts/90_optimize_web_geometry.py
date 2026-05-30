"""
Phase F polish — slim the GeoJSON the browser actually downloads.

Two payloads dominated first paint:
  - ca_tracts.geojson    11.5 MB / 9,129 tracts — but the redlining flagship
                          only draws the 2,003 tracts that carry a 1939 HOLC
                          grade. The other ~7,100 were downloaded and parsed and
                          never rendered.
  - us_counties.geojson   3.3 MB — full-resolution TIGER boundaries, far more
                          vertices than a national choropleth at zoom 3–5 shows.

This script emits two lean, ready-to-ship files:
  app/public/data/ca_tracts_holc.geojson   HOLC-graded tracts only, trimmed
                                            props, topology-aware simplified.
  app/public/data/us_counties.min.geojson  same counties + props, simplified
                                            with shared boundaries preserved.

Geometry is simplified with mapshaper (Visvalingam, `keep-shapes`) so adjacent
polygons keep shared edges — no slivers or gaps, unlike per-feature simplify.
Attributes are untouched; only vertex counts drop.

Run:  python3 scripts/90_optimize_web_geometry.py
"""
from pathlib import Path
import json
import shutil
import subprocess
import sys

BASE = Path(__file__).resolve().parents[1]
WEB = BASE / "data" / "web"
APP = BASE / "app" / "public" / "data"
TMP = BASE / "data" / "_tmp_geom"
TMP.mkdir(parents=True, exist_ok=True)

# Props the redlining flagship needs (map fill, gradient, and room to grow into
# richer tract interactions without re-shipping geometry).
TRACT_KEEP = [
    "GEOID", "county_name", "holc_dominant_grade", "holc_score",
    "diabetes_pct", "obesity_pct", "hypertension_pct",
    "median_hh_income", "pct_poverty", "pct_renter",
    "is_la_county", "is_south_central",
]

MAPSHAPER = ["npx", "--no-install", "mapshaper"]


def mb(p: Path) -> float:
    return p.stat().st_size / 1_048_576


def run_mapshaper(args):
    cmd = MAPSHAPER + args
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stdout + "\n" + r.stderr + "\n")
        raise SystemExit(f"mapshaper failed: {' '.join(args)}")


def slim_tracts():
    src = WEB / "ca_tracts.geojson"
    if not src.exists():
        src = APP / "ca_tracts.geojson"
    gj = json.loads(src.read_text())
    feats = []
    for f in gj["features"]:
        p = f["properties"]
        if not p.get("holc_dominant_grade"):
            continue
        f["properties"] = {k: p.get(k) for k in TRACT_KEEP}
        feats.append(f)
    inter = TMP / "ca_tracts_holc.in.geojson"
    inter.write_text(json.dumps({"type": "FeatureCollection", "features": feats}))
    out = APP / "ca_tracts_holc.geojson"
    # 18% retention keeps tract outlines crisp at the LA/St-Louis zooms (8–11).
    run_mapshaper([str(inter), "-simplify", "18%", "keep-shapes",
                   "-o", str(out), "format=geojson", "precision=0.00001"])
    print(f"  ca_tracts_holc.geojson  {len(feats):>5} feats  {mb(out):5.2f} MB"
          f"  (from {mb(src):.2f} MB / {len(gj['features'])} feats)")


def slim_counties():
    src = WEB / "us_counties.geojson"
    if not src.exists():
        src = APP / "us_counties.geojson"   # legacy location, pre-relocation
    if not src.exists():
        print("  us_counties.geojson not found — run scripts/11_national_county.py first")
        return
    out = APP / "us_counties.min.geojson"
    # 12% retention is invisible at national/regional zoom (≤5) where this map
    # lives; keep-shapes preserves shared boundaries so there are no slivers.
    run_mapshaper([str(src), "-simplify", "12%", "keep-shapes",
                   "-o", str(out), "format=geojson", "precision=0.0001"])
    print(f"  us_counties.min.geojson         {mb(out):5.2f} MB  (from {mb(src):.2f} MB)")


def main():
    print("[optimize] slimming web geometry...")
    slim_tracts()
    slim_counties()
    shutil.rmtree(TMP, ignore_errors=True)
    print("[optimize] done.")


if __name__ == "__main__":
    main()
