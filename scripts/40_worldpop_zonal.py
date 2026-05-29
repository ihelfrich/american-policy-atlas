"""
Phase A3 — WorldPop 2020 constrained 100m -> California clip -> zonal density.

This is the GIS teaching deliverable for Module 2:
  1. clip a national raster to a polygon extent (California),
  2. compute zonal statistics (population SUM) per tract and block group,
  3. derive density = population / land-area-km2.

WorldPop constrained pixels are per-pixel population counts, so the zonal SUM
over a polygon IS that polygon's modelled population.

Disk-frugal: writes a small CA clip GeoTIFF, then DELETES the 494 MB national
raster at the end.

Inputs (../data/raw/):
  usa_ppp_2020_constrained.tif        WorldPop national (deleted at end)
  ca_tracts/tl_2023_06_tract.shp      TIGER 2023 tracts
  ca_bg/tl_2023_06_bg.shp             TIGER 2023 block groups
Outputs (../data/clean/ and ../data/raw/):
  ca_ppp_2020_clip.tif                California raster clip (kept, small)
  worldpop_ca_tract.parquet           GEOID, wp_pop, area_km2, pop_density_km2
  worldpop_ca_blockgroup.parquet      same, block-group level
"""
from pathlib import Path
import numpy as np
import geopandas as gpd
import rasterio
from rasterio.windows import from_bounds
from rasterstats import zonal_stats

BASE = Path(__file__).resolve().parents[1]
RAW = BASE / "data" / "raw"
CLEAN = BASE / "data" / "clean"; CLEAN.mkdir(parents=True, exist_ok=True)
NAT = RAW / "usa_ppp_2020_constrained.tif"
CLIP = RAW / "ca_ppp_2020_clip.tif"
ALBERS = "EPSG:3310"   # California Albers, metres


def clip_to_ca(tracts4326):
    minx, miny, maxx, maxy = tracts4326.total_bounds
    pad = 0.05
    with rasterio.open(NAT) as src:
        win = from_bounds(minx - pad, miny - pad, maxx + pad, maxy + pad, src.transform)
        win = win.round_offsets().round_lengths()
        data = src.read(1, window=win)
        transform = src.window_transform(win)
        prof = src.profile.copy()
        prof.update(height=data.shape[0], width=data.shape[1], transform=transform,
                    compress="deflate", tiled=True)
        with rasterio.open(CLIP, "w", **prof) as dst:
            dst.write(data, 1)
    print(f"  CA clip: {data.shape[1]}x{data.shape[0]} px -> {CLIP.name}")


def zonal(shp, idcols, label):
    g = gpd.read_file(shp)
    g["GEOID"] = g[idcols].astype(str).agg("".join, axis=1) if isinstance(idcols, list) else g[idcols]
    g4326 = g.to_crs(4326)
    print(f"  {label}: zonal sum over {len(g)} polygons...")
    zs = zonal_stats(g4326.geometry, str(CLIP), stats=["sum"], nodata=-99999, all_touched=False)
    pop = np.array([(z["sum"] or 0.0) for z in zs])
    area_km2 = g.to_crs(ALBERS).geometry.area / 1e6
    out = gpd.GeoDataFrame({
        "GEOID": g["GEOID"].values,
        "wp_pop": np.round(pop, 1),
        "area_km2": np.round(area_km2.values, 4),
    })
    out["pop_density_km2"] = np.where(out.area_km2 > 0,
                                      (out.wp_pop / out.area_km2).round(1), np.nan)
    return out


tr = gpd.read_file(RAW / "ca_tracts" / "tl_2023_06_tract.shp").to_crs(4326)
print("WorldPop: clipping national raster to California extent...")
clip_to_ca(tr)

t = zonal(RAW / "ca_tracts" / "tl_2023_06_tract.shp", "GEOID", "tracts")
t.to_parquet(CLEAN / "worldpop_ca_tract.parquet", index=False)
print(f"  tracts: {len(t)} rows -> worldpop_ca_tract.parquet  "
      f"(total wp_pop = {t.wp_pop.sum():,.0f})")

b = zonal(RAW / "ca_bg" / "tl_2023_06_bg.shp", "GEOID", "block groups")
b.to_parquet(CLEAN / "worldpop_ca_blockgroup.parquet", index=False)
print(f"  block groups: {len(b)} rows -> worldpop_ca_blockgroup.parquet  "
      f"(total wp_pop = {b.wp_pop.sum():,.0f})")

# disk-frugal: drop the national raster, keep the small CA clip
if NAT.exists():
    mb = NAT.stat().st_size / 1e6
    NAT.unlink()
    print(f"  deleted national raster ({mb:.0f} MB freed); kept {CLIP.name}")
print("DONE.")
