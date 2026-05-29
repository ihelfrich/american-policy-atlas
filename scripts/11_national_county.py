"""
Phase G1 — national county layer for the US-wide atlas.

The frontend can classify ~3,140 county polygons in the browser (same path as the
old CA-tract layer), so this script produces a single GeoJSON the map loads as the
national base, plus a summary JSON with national distribution stats.

Sources, all verified live:
  ACS 2018-22 5-year, county:* in=state:*   (one detailed call + S2701 subject call)
  CDC PLACES 2025 county (swc5-untb, long format, CrdPrv rows pivoted to columns)
  TIGER 2023 county geometry (tl_2023_us_county) for land area + shape

Writes:
  app/public/data/us_counties.geojson
  app/public/data/us_summary.json
"""
from pathlib import Path
from io import StringIO
import os, time, zipfile, json
import requests
import numpy as np
import pandas as pd
import geopandas as gpd
from dotenv import dotenv_values

BASE = Path(__file__).resolve().parents[1]
RAW = BASE / "data" / "raw"; RAW.mkdir(parents=True, exist_ok=True)
APP = BASE / "app" / "public" / "data"; APP.mkdir(parents=True, exist_ok=True)
KEY = (dotenv_values("/Users/ian/Projects/econscope/.env").get("CENSUS_API_KEY")
       or os.environ.get("CENSUS_API_KEY"))
assert KEY, "no census key"
YEAR = 2022
DET = f"https://api.census.gov/data/{YEAR}/acs/acs5"
SUBJ = f"https://api.census.gov/data/{YEAR}/acs/acs5/subject"

# 50 states + DC; drop territories (PLACES/ACS coverage is partial there)
VALID_STATES = {f"{i:02d}" for i in range(1, 57)} - {"03", "07", "14", "43", "52"}

ACS_VARS = {
    "B01003_001E": "pop_total",
    "B02001_003E": "race_black", "B03003_003E": "hispanic", "B03003_001E": "hisp_universe",
    "B19013_001E": "median_hh_income",
    "B17001_001E": "pov_universe", "B17001_002E": "pov_below",
    "B15003_001E": "edu_universe", "B15003_022E": "edu_ba", "B15003_023E": "edu_ma",
    "B15003_024E": "edu_prof", "B15003_025E": "edu_phd",
    "B23025_003E": "labor_force", "B23025_005E": "unemployed",
    "B25003_001E": "tenure_total", "B25003_003E": "renter",
}
PLACES_RES = "https://data.cdc.gov/resource/swc5-untb.csv"
PLACES_MEASURES = {"DIABETES": "diabetes_pct", "OBESITY": "obesity_pct", "BPHIGH": "hypertension_pct"}
TIGER = "https://www2.census.gov/geo/tiger/TIGER2023/COUNTY/tl_2023_us_county.zip"

# the 12 variables the frontend maps, in catalogue order
WEB_VARS = ["pop_density_km2", "median_hh_income", "pct_poverty", "pct_hispanic",
            "pct_black", "pct_bachelor_plus", "pct_unemployed", "pct_uninsured",
            "pct_renter", "diabetes_pct", "obesity_pct", "hypertension_pct"]


def fetch(url, params, csv=False, dtype=None):
    last = None
    for attempt in range(6):
        try:
            r = requests.get(url, params=params, timeout=300)
            if r.status_code == 200:
                if csv:
                    return pd.read_csv(StringIO(r.text), dtype=dtype)
                j = r.json()
                return pd.DataFrame(j[1:], columns=j[0])
            last = f"{r.status_code}: {r.text[:200]}"
        except requests.exceptions.RequestException as e:
            last = repr(e)
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"fetch failed after retries: {last}")


def to_num(df, cols):
    for c in cols:
        df[c] = pd.to_numeric(df[c], errors="coerce")
        df.loc[df[c] < -1e6, c] = pd.NA
    return df


# ---------- ACS county (national, single call each) ----------
print("ACS county: detailed table (county:* in=state:*)...")
det = fetch(DET, {"get": ",".join(ACS_VARS), "for": "county:*",
                  "in": "state:*", "key": KEY}).rename(columns=ACS_VARS)
det["GEOID"] = det.state + det.county
det = det[det.state.isin(VALID_STATES)].copy()
det = to_num(det, list(ACS_VARS.values()))
print(f"  {len(det)} counties")

print("ACS county: subject S2701 (uninsured)...")
subj = fetch(SUBJ, {"get": "S2701_C05_001E", "for": "county:*", "in": "state:*", "key": KEY})
subj["GEOID"] = subj.state + subj.county
subj["pct_uninsured"] = pd.to_numeric(subj["S2701_C05_001E"], errors="coerce")
subj.loc[subj.pct_uninsured < -1e6, "pct_uninsured"] = pd.NA
det = det.merge(subj[["GEOID", "pct_uninsured"]], on="GEOID", how="left")

pct = lambda num, den: (num / den * 100).where(den > 0)
acs = pd.DataFrame({"GEOID": det.GEOID})
acs["pop_total"] = det.pop_total
acs["median_hh_income"] = det.median_hh_income
acs["pct_black"] = pct(det.race_black, det.pop_total)
acs["pct_hispanic"] = pct(det.hispanic, det.hisp_universe)
acs["pct_poverty"] = pct(det.pov_below, det.pov_universe)
acs["pct_renter"] = pct(det.renter, det.tenure_total)
acs["pct_bachelor_plus"] = pct(det.edu_ba + det.edu_ma + det.edu_prof + det.edu_phd, det.edu_universe)
acs["pct_unemployed"] = pct(det.unemployed, det.labor_force)
acs["pct_uninsured"] = det.pct_uninsured

# ---------- PLACES county (long -> wide) ----------
print("PLACES 2025 county: pulling crude prevalence...")
meas_in = ",".join(f"'{m}'" for m in PLACES_MEASURES)
pl = fetch(PLACES_RES, {
    "$select": "locationid,measureid,data_value",
    "$where": f"datavaluetypeid='CrdPrv' AND measureid in({meas_in})",
    "$limit": 200000,
}, csv=True, dtype={"locationid": str})
pl["data_value"] = pd.to_numeric(pl["data_value"], errors="coerce")
wide = pl.pivot_table(index="locationid", columns="measureid", values="data_value", aggfunc="first")
wide = wide.rename(columns=PLACES_MEASURES).reset_index().rename(columns={"locationid": "GEOID"})
wide["GEOID"] = wide["GEOID"].str.zfill(5)
print(f"  {len(wide)} counties with PLACES")

# ---------- TIGER county geometry + land area ----------
zp = RAW / "tl_2023_us_county.zip"
if not zp.exists():
    print("downloading TIGER county shapefile...")
    r = requests.get(TIGER, timeout=600); r.raise_for_status()
    zp.write_bytes(r.content)
shp_dir = RAW / "tl_2023_us_county"
if not shp_dir.exists():
    with zipfile.ZipFile(zp) as z:
        z.extractall(shp_dir)
geo = gpd.read_file(shp_dir / "tl_2023_us_county.shp")[["GEOID", "NAMELSAD", "STATEFP", "ALAND", "geometry"]]
geo = geo[geo.STATEFP.isin(VALID_STATES)].copy()
geo["land_area_km2"] = geo.ALAND / 1e6

# ---------- merge + derive density ----------
df = geo.merge(acs, on="GEOID", how="left").merge(wide, on="GEOID", how="left")
df["pop_density_km2"] = (df.pop_total / df.land_area_km2).where(df.land_area_km2 > 0)

# state abbreviation for labels
STATE_ABBR = fetch(DET, {"get": "NAME", "for": "state:*", "key": KEY})
abbr_map = dict(zip(STATE_ABBR.state, STATE_ABBR.NAME))
df["county_name"] = df.NAMELSAD
df["state_name"] = df.STATEFP.map(abbr_map)

keep = ["GEOID", "county_name", "state_name", "pop_total"] + WEB_VARS
for c in WEB_VARS:
    if c in df:
        df[c] = pd.to_numeric(df[c], errors="coerce").round(2)
df = df[keep + ["geometry"]]

# simplify for web (counties tolerate more than tracts)
df["geometry"] = df.geometry.simplify(0.01, preserve_topology=True)
out = gpd.GeoDataFrame(df, geometry="geometry", crs=4326)
out.to_file(APP / "us_counties.geojson", driver="GeoJSON")
sz = (APP / "us_counties.geojson").stat().st_size / 1e6
print(f"wrote us_counties.geojson — {len(out)} counties, {sz:.1f} MB")

# ---------- national summary ----------
varstats = {}
for v in WEB_VARS:
    s = pd.to_numeric(out[v], errors="coerce").dropna()
    if len(s):
        varstats[v] = {"min": float(s.min()), "max": float(s.max()),
                       "mean": float(s.mean()), "median": float(s.median()),
                       "q": [float(s.quantile(q)) for q in (.2, .4, .6, .8)],
                       "n": int(len(s))}
summary = {"level": "county", "n_counties": int(len(out)),
           "n_states": int(out.state_name.nunique()), "varstats": varstats}
json.dump(summary, open(APP / "us_summary.json", "w"))
print("wrote us_summary.json")
print(out[["GEOID", "county_name", "state_name", "pop_density_km2",
           "median_hh_income", "pct_poverty", "diabetes_pct"]].head())
