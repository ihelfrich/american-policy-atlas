"""
Phase A4 — assemble the two packaged datasets.

Joins everything pulled in A1-A3, area-weights HOLC 1939 grades onto modern
tracts statewide (8 graded CA cities), flags LA County + South Central LA
(City of LA "South Los Angeles" + "Southeast Los Angeles" Community Plan Areas,
authoritative LADCP boundary), and writes:

  data/clean/california_master_tract.parquet      ~9,100 tracts, all variables
  data/clean/california_master_bg.parquet         ~25,600 block groups, core
  data/clean/la_focus_tract.parquet               LA County, HOLC + health
  data/clean/south_central_tracts.csv             explicit documented tract list
  data/web/ca_tracts.geojson                      simplified tract polygons + key vars
  data/web/ca_counties.geojson                    county polygons + econ
  data/web/la_focus.geojson                        LA focus polygons (HOLC + health)

HOLC method (matches the LA practicum): each tract takes the grade covering the
largest share of its area; holc_score is the area-weighted mean grade (A=1..D=4);
holc_pct_covered is the share of tract area inside any graded zone.
"""
from pathlib import Path
import json
import numpy as np
import pandas as pd
import geopandas as gpd
import requests

BASE = Path(__file__).resolve().parents[1]
RAW = BASE / "data" / "raw"
CLEAN = BASE / "data" / "clean"
WEB = BASE / "data" / "web"; WEB.mkdir(parents=True, exist_ok=True)
ALBERS = "EPSG:3310"
GRADE_NUM = {"A": 1, "B": 2, "C": 3, "D": 4}

from dotenv import dotenv_values
import os
CENSUS_KEY = (dotenv_values("/Users/ian/Projects/econscope/.env").get("CENSUS_API_KEY")
              or os.environ.get("CENSUS_API_KEY"))

# ---------- 1. tabular merge (tract) ----------
print("merge tract tables...")
acs = pd.read_parquet(CLEAN / "acs_ca_tract.parquet")
places = pd.read_parquet(CLEAN / "places_ca_tract.parquet")
wp = pd.read_parquet(CLEAN / "worldpop_ca_tract.parquet")
for d in (acs, places, wp):
    d["GEOID"] = d["GEOID"].astype(str).str.zfill(11)
tract = acs.merge(places, on="GEOID", how="left", suffixes=("", "_places"))
tract = tract.merge(wp, on="GEOID", how="left")
# acs already carries pct_uninsured from S2701; keep it, drop PLACES dup if present
if "no_health_insurance_pct" in tract:
    tract = tract.drop(columns=[c for c in ["no_health_insurance_pct"] if c in tract])
tract["county_fips"] = tract["GEOID"].str[:5]

# county econ
econ = pd.read_parquet(CLEAN / "econ_ca_county.parquet").rename(
    columns={"GEOID_county": "county_fips"})
tract = tract.merge(econ, on="county_fips", how="left")

# county names (one Census call, with retries)
import time
cn = None
for attempt in range(6):
    try:
        r = requests.get("https://api.census.gov/data/2022/acs/acs5",
                         params={"get": "NAME", "for": "county:*", "in": "state:06",
                                 "key": CENSUS_KEY},
                         timeout=60)
        cn = r.json()
        break
    except Exception as e:
        print(f"  county-name fetch attempt {attempt+1} failed: {e}; retrying...")
        time.sleep(3 * (attempt + 1))
if cn is None:
    raise SystemExit("county-name fetch failed after retries")
cndf = pd.DataFrame(cn[1:], columns=cn[0])
cndf["county_fips"] = "06" + cndf["county"]
cndf["county_name"] = cndf["NAME"].str.replace(", California", "", regex=False)
tract = tract.merge(cndf[["county_fips", "county_name"]], on="county_fips", how="left")

# ---------- 2. tract geometry ----------
print("load tract geometry...")
geo = gpd.read_file(RAW / "ca_tracts" / "tl_2023_06_tract.shp")[["GEOID", "geometry"]]
geo["GEOID"] = geo["GEOID"].astype(str).str.zfill(11)
geo = geo.to_crs(ALBERS)

# ---------- 3. HOLC area-weighted grade ----------
print("area-weight HOLC 1939 grades onto tracts...")
mi = json.load(open(RAW / "mappinginequality.json"))
ca_feats = [f for f in mi["features"]
            if f["properties"].get("state") == "CA"
            and f["properties"].get("grade") in GRADE_NUM
            and f.get("geometry")]
holc = gpd.GeoDataFrame.from_features(ca_feats, crs="EPSG:4326").to_crs(ALBERS)
holc["grade"] = holc["grade"].map(lambda g: g)
holc["gnum"] = holc["grade"].map(GRADE_NUM)
holc = holc[holc.geometry.notna() & ~holc.geometry.is_empty].copy()
holc["geometry"] = holc.geometry.buffer(0)

tg = geo.copy()
tg["tract_area"] = tg.geometry.area
inter = gpd.overlay(tg[["GEOID", "tract_area", "geometry"]],
                    holc[["grade", "gnum", "geometry"]], how="intersection")
inter["ipart"] = inter.geometry.area

# dominant grade = largest intersected area per tract
dom = (inter.sort_values("ipart")
       .groupby("GEOID").tail(1)[["GEOID", "grade"]]
       .rename(columns={"grade": "holc_dominant_grade"}))
# area-weighted mean score + coverage
agg = inter.groupby("GEOID").apply(
    lambda d: pd.Series({
        "holc_score": np.average(d["gnum"], weights=d["ipart"]),
        "holc_covered_area": d["ipart"].sum(),
        "tract_area": d["tract_area"].iloc[0],
    }), include_groups=False).reset_index()
agg["holc_pct_covered"] = (100 * agg["holc_covered_area"] / agg["tract_area"]).round(1)
holc_tract = dom.merge(agg[["GEOID", "holc_score", "holc_pct_covered"]], on="GEOID")
holc_tract["holc_score"] = holc_tract["holc_score"].round(3)
# require >=10% coverage to assign a grade (same rule as LA practicum)
holc_tract.loc[holc_tract["holc_pct_covered"] < 10, ["holc_dominant_grade"]] = np.nan
print(f"  tracts with HOLC grade (>=10% cover): "
      f"{holc_tract['holc_dominant_grade'].notna().sum()}")
tract = tract.merge(holc_tract, on="GEOID", how="left")

# ---------- 4. LA County + South Central flags ----------
print("flag LA County + South Central...")
tract["is_la_county"] = tract["county_fips"].eq("06037")
cpa = gpd.read_file(RAW / "south_central_cpa.geojson").to_crs(ALBERS)
sc_union = cpa.union_all() if hasattr(cpa, "union_all") else cpa.unary_union
cent = geo.copy()
cent["geometry"] = cent.geometry.centroid
cent["is_south_central"] = cent.within(sc_union)
tract = tract.merge(cent[["GEOID", "is_south_central"]], on="GEOID", how="left")
tract["is_south_central"] = tract["is_south_central"].fillna(False)
print(f"  South Central tracts: {tract['is_south_central'].sum()}")

# explicit documented tract list
sc = tract.loc[tract["is_south_central"],
               ["GEOID", "county_name", "pop_total", "holc_dominant_grade",
                "median_hh_income", "pct_hispanic", "diabetes_pct"]].sort_values("GEOID")
sc.to_csv(CLEAN / "south_central_tracts.csv", index=False)

# ---------- 5. write master tract (parquet) ----------
tract.to_parquet(CLEAN / "california_master_tract.parquet", index=False)
print(f"master tract: {len(tract)} rows, {tract.shape[1]} cols")

# ---------- 6. block-group master ----------
print("assemble block-group master...")
bg = pd.read_parquet(CLEAN / "acs_ca_blockgroup.parquet")
bgwp = pd.read_parquet(CLEAN / "worldpop_ca_blockgroup.parquet")
bg["GEOID"] = bg["GEOID"].astype(str).str.zfill(12)
bgwp["GEOID"] = bgwp["GEOID"].astype(str).str.zfill(12)
bg = bg.merge(bgwp, on="GEOID", how="left")
bg["county_fips"] = bg["GEOID"].str[:5]
bg["tract_geoid"] = bg["GEOID"].str[:11]
bg["is_la_county"] = bg["county_fips"].eq("06037")
bg = bg.merge(tract[["GEOID", "is_south_central"]].rename(
    columns={"GEOID": "tract_geoid"}), on="tract_geoid", how="left")
bg["is_south_central"] = bg["is_south_central"].fillna(False)
bg.to_parquet(CLEAN / "california_master_bg.parquet", index=False)
print(f"master bg: {len(bg)} rows, {bg.shape[1]} cols")

# ---------- 7. la_focus ----------
laf = tract[tract["is_la_county"]].copy()
laf.to_parquet(CLEAN / "la_focus_tract.parquet", index=False)
print(f"la_focus: {len(laf)} rows")

# ---------- 8. web geojson (simplified) ----------
print("write web geojson...")
WEB_VARS = ["GEOID", "county_name", "pop_total", "pop_density_km2", "median_hh_income",
            "pct_poverty", "pct_hispanic", "pct_black", "pct_white", "pct_asian",
            "pct_bachelor_plus", "pct_unemployed", "pct_renter", "pct_uninsured",
            "diabetes_pct", "obesity_pct", "hypertension_pct",
            "holc_dominant_grade", "holc_score", "is_la_county", "is_south_central"]
gj = geo.to_crs(4326).merge(tract[[c for c in WEB_VARS if c in tract]], on="GEOID")
gj["geometry"] = gj.geometry.simplify(0.0005, preserve_topology=True)
gj.to_file(WEB / "ca_tracts.geojson", driver="GeoJSON")

# la focus polygons (richer health vars)
LAF_VARS = WEB_VARS + ["coronary_heart_disease_pct", "poor_mental_health_pct",
                       "no_physical_activity_pct", "smoking_pct", "asthma_pct"]
lgj = geo.to_crs(4326).merge(laf[[c for c in LAF_VARS if c in laf]], on="GEOID")
lgj["geometry"] = lgj.geometry.simplify(0.0003, preserve_topology=True)
lgj.to_file(WEB / "la_focus.geojson", driver="GeoJSON")

print("DONE assembling.")
print(tract[["GEOID", "county_name", "pop_total", "pop_density_km2",
             "holc_dominant_grade", "diabetes_pct", "is_south_central"]].head())
