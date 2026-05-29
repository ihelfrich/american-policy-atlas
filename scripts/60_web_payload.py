"""
Phase A4 (part 2) — derived statistics + web payload for the atlas frontend.

Reads the assembled master, computes the things that are awkward in the browser
(Moran's I with real queen-contiguity weights, per-variable summary stats,
HOLC gradient means, the redlining regression), and writes:

  app/public/data/ca_tracts.geojson      (copied from data/web)
  app/public/data/la_focus.geojson       (copied)
  app/public/data/ca_counties.geojson    (built here)
  app/public/data/atlas_summary.json     (stats payload)
"""
from pathlib import Path
import json, shutil
import numpy as np
import pandas as pd
import geopandas as gpd

BASE = Path(__file__).resolve().parents[1]
RAW = BASE / "data" / "raw"
CLEAN = BASE / "data" / "clean"
WEB = BASE / "data" / "web"
APP = BASE / "app" / "public" / "data"; APP.mkdir(parents=True, exist_ok=True)
ALBERS = "EPSG:3310"

tract = pd.read_parquet(CLEAN / "california_master_tract.parquet")

WEB_VARS = ["pop_density_km2", "median_hh_income", "pct_poverty", "pct_hispanic",
            "pct_black", "pct_bachelor_plus", "pct_unemployed", "pct_uninsured",
            "pct_renter", "diabetes_pct", "obesity_pct", "hypertension_pct"]

# ---- per-variable summary ----
varstats = {}
for v in WEB_VARS:
    s = pd.to_numeric(tract[v], errors="coerce").dropna()
    if len(s):
        varstats[v] = {"min": float(s.min()), "max": float(s.max()),
                       "mean": float(s.mean()), "median": float(s.median()),
                       "q": [float(s.quantile(q)) for q in (.2, .4, .6, .8)]}

# ---- HOLC gradient means ----
byGrade = {}
for g in ["A", "B", "C", "D"]:
    sub = tract[tract.holc_dominant_grade == g]
    if len(sub):
        byGrade[g] = {k: float(pd.to_numeric(sub[k], errors="coerce").mean())
                      for k in ["diabetes_pct", "obesity_pct", "hypertension_pct",
                                "pct_poverty", "pct_hispanic", "median_hh_income"]}
        byGrade[g]["n"] = int(len(sub))

# ---- redlining regression (diabetes ~ holc_score [+ poverty]) ----
reg = {}
d = tract[["holc_score", "diabetes_pct", "pct_poverty"]].apply(pd.to_numeric, errors="coerce").dropna()
if len(d) > 30:
    X1 = np.column_stack([np.ones(len(d)), d.holc_score])
    b1 = np.linalg.lstsq(X1, d.diabetes_pct, rcond=None)[0]
    X2 = np.column_stack([np.ones(len(d)), d.holc_score, d.pct_poverty])
    b2 = np.linalg.lstsq(X2, d.diabetes_pct, rcond=None)[0]
    yhat1 = X1 @ b1
    r2 = 1 - ((d.diabetes_pct - yhat1) ** 2).sum() / ((d.diabetes_pct - d.diabetes_pct.mean()) ** 2).sum()
    reg = {"b0": float(b1[0]), "b1": float(b1[1]), "b1_ctrl": float(b2[1]),
           "r2": float(r2), "n": int(len(d))}

# ---- Moran's I (queen contiguity) for diabetes ----
print("building queen weights for Moran's I...")
geo = gpd.read_file(RAW / "ca_tracts" / "tl_2023_06_tract.shp")[["GEOID", "geometry"]].to_crs(ALBERS)
geo["GEOID"] = geo["GEOID"].astype(str).str.zfill(11)
geo = geo.merge(tract[["GEOID", "diabetes_pct"]], on="GEOID", how="left")
geo = geo[geo.diabetes_pct.notna()].reset_index(drop=True)
geo["geometry"] = geo.geometry.buffer(1)  # tiny buffer so shared borders register
sj = gpd.sjoin(geo[["GEOID", "geometry"]], geo[["GEOID", "geometry"]],
               predicate="intersects")
sj = sj[sj.GEOID_left != sj.GEOID_right]
idx = {g: i for i, g in enumerate(geo.GEOID)}
n = len(geo)
y = geo.diabetes_pct.to_numpy(float)
z = y - y.mean()
# neighbor lists
from collections import defaultdict
nb = defaultdict(list)
for a, b in zip(sj.GEOID_left, sj.GEOID_right):
    nb[idx[a]].append(idx[b])
# row-standardized lag
lag = np.zeros(n)
for i in range(n):
    if nb[i]:
        lag[i] = z[nb[i]].mean()
S0 = sum(1.0 for i in range(n) for _ in nb[i])  # each pair weight 1 before row-std
# Moran's I with row-standardized W: I = (z' Wz)/(z'z) since sum of row weights=1 -> S0=n_with_nb
num = (z * lag * np.array([1.0 if nb[i] else 0.0 for i in range(n)])).sum()
den = (z ** 2).sum()
I = (n / sum(1 for i in range(n) if nb[i])) * (num / den)
# permutation p-value
rng = np.random.default_rng(42)
perm = np.empty(999)
zc = z.copy()
has = np.array([bool(nb[i]) for i in range(n)])
for p in range(999):
    zp = rng.permutation(zc)
    lp = np.array([zp[nb[i]].mean() if nb[i] else 0.0 for i in range(n)])
    perm[p] = (n / has.sum()) * ((zp * lp).sum() / den)
perm_p = float((np.sum(perm >= I) + 1) / 1000)
# scatter sample (standardized)
zs = z / z.std()
lags = (lag - lag.mean()) / lag.std()
samp = rng.choice(n, size=min(1500, n), replace=False)
scatter = [{"z": round(float(zs[i]), 3), "lag": round(float(lags[i]), 3)} for i in samp if has[i]]
moran = {"I": float(I), "perm_p": perm_p, "scatter": scatter}
print(f"  Moran's I = {I:.3f}, p = {perm_p}")

summary = {"varstats": varstats, "byGrade": byGrade, "reg": reg, "moran": moran,
           "n_tracts": int(len(tract)),
           "n_holc": int(tract.holc_dominant_grade.notna().sum()),
           "n_south_central": int(tract.is_south_central.sum())}
json.dump(summary, open(APP / "atlas_summary.json", "w"))
print(f"wrote atlas_summary.json")

# ---- county geojson with econ ----
print("building county geojson...")
cty = gpd.read_file(RAW / "ca_tracts" / "tl_2023_06_tract.shp")
cty["county_fips"] = cty.STATEFP + cty.COUNTYFP
cty = cty.dissolve(by="county_fips").reset_index()[["county_fips", "geometry"]].to_crs(4326)
econ = pd.read_parquet(CLEAN / "econ_ca_county.parquet").rename(columns={"GEOID_county": "county_fips"})
cty = cty.merge(econ, on="county_fips", how="left")
cty["geometry"] = cty.geometry.simplify(0.002, preserve_topology=True)
cty.to_file(APP / "ca_counties.geojson", driver="GeoJSON")

# ---- copy tract + la geojson ----
for f in ["ca_tracts.geojson", "la_focus.geojson"]:
    if (WEB / f).exists():
        shutil.copy(WEB / f, APP / f)
        print(f"copied {f} ({(APP / f).stat().st_size/1e6:.1f} MB)")
print("DONE web payload.")
