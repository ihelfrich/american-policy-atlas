"""
Phase G4 — national spatial dependence for the stats curriculum.

Computes Moran's I for county-level adult diabetes prevalence under queen
contiguity (counties that share any boundary point are neighbours), with a
permutation test for significance. Row-standardised weights, so the spatial
lag of a county is the mean of its neighbours' standardised values.

Contiguity is built from the RAW unsimplified TIGER county geometry. The
web-facing us_counties.geojson is simplified (simplify(0.01)), which nudges
shared vertices apart so a touches() test misses most real neighbours. We read
the full-resolution shapefile and use an intersects() test, which is robust to
the hairline gaps/overlaps that survive in any real polygon coverage.

No libpysal on this machine, so the weights are built directly via the
geopandas spatial index.

Reads:   data/web/us_counties.geojson  (the diabetes_pct values)
         data/raw/tl_2023_us_county/tl_2023_us_county.shp  (the geometry)
Writes:  merges a "moran" block into app/public/data/us_summary.json
"""
from pathlib import Path
import json
import numpy as np
import geopandas as gpd

BASE = Path(__file__).resolve().parents[1]
APP = BASE / "app" / "public" / "data"
WEB = BASE / "data" / "web"   # full-res county source lives here, not in public/data
RAW = BASE / "data" / "raw" / "tl_2023_us_county" / "tl_2023_us_county.shp"
VAR = "diabetes_pct"          # the health thread that runs through the curriculum
N_PERM = 999
N_SCATTER = 900               # points sent to the browser for the lag scatter
rng = np.random.default_rng(42)

# values come from the web layer; geometry comes from the raw TIGER shapefile
vals = gpd.read_file(WEB / "us_counties.geojson")[["GEOID", VAR]]
vals = vals[vals[VAR].notna()]

raw = gpd.read_file(RAW)[["GEOID", "geometry"]]
gdf = raw.merge(vals, on="GEOID", how="inner")
# contiguity is only meaningful in the lower 48 + adjacent; drop the obvious
# island states whose counties have no land neighbours (AK 02, HI 15) so they
# don't sit as zero-weight outliers in the scatter.
gdf = gdf[~gdf.GEOID.str.startswith(("02", "15"))].reset_index(drop=True)
n = len(gdf)
print(f"{n} counties with {VAR} (geometry from raw TIGER)")

# ---- queen contiguity via spatial index ----
# intersects() on full-resolution geometry: two counties are neighbours if their
# boundaries touch or hairline-overlap. Robust where touches() is brittle.
sindex = gdf.sindex
geoms = gdf.geometry.values
neighbors = [[] for _ in range(n)]
for i in range(n):
    cand = sindex.query(geoms[i], predicate="intersects")
    neighbors[i] = [int(j) for j in cand if j != i]
deg = np.array([len(nb) for nb in neighbors])
print(f"  contiguity built — mean {deg.mean():.1f} neighbours, "
      f"{int((deg == 0).sum())} islands")

keep = deg > 0
x = gdf[VAR].to_numpy(dtype=float)
z = (x - x[keep].mean()) / x[keep].std()      # standardise on the connected set

# row-standardised spatial lag
lag = np.full(n, np.nan)
for i in range(n):
    if neighbors[i]:
        lag[i] = z[neighbors[i]].mean()

idx = np.where(keep)[0]
zc, lagc = z[idx], lag[idx]


def morans_I(zv, nbrs, order):
    num = 0.0
    for i in order:
        nb = nbrs[i]
        if nb:
            num += zv[i] * zv[nb].mean()
    return num / np.sum(zv[order] ** 2)


I_obs = morans_I(z, neighbors, idx)

# permutation: reshuffle values across the connected counties
perm = np.empty(N_PERM)
zc_pool = zc.copy()
for p in range(N_PERM):
    shuffled = z.copy()
    shuffled[idx] = rng.permutation(zc_pool)
    perm[p] = morans_I(shuffled, neighbors, idx)
perm_p = (np.sum(perm >= I_obs) + 1) / (N_PERM + 1)
print(f"  Moran's I = {I_obs:.3f}  (permutation p = {perm_p:.4f})")

# sample the scatter for the browser
take = idx if len(idx) <= N_SCATTER else rng.choice(idx, N_SCATTER, replace=False)
scatter = [{"z": round(float(z[i]), 3), "lag": round(float(lag[i]), 3)} for i in take]

summary = json.load(open(APP / "us_summary.json"))
summary["moran"] = {
    "variable": VAR,
    "I": round(float(I_obs), 4),
    "perm_p": round(float(perm_p), 4),
    "n": int(keep.sum()),
    "mean_neighbors": round(float(deg[keep].mean()), 2),
    "scatter": scatter,
}
json.dump(summary, open(APP / "us_summary.json", "w"))
print(f"wrote moran block — {len(scatter)} scatter points")
