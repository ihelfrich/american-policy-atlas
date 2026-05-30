"""
Phase G1 / D1 — national county layer for the US-wide atlas.

The frontend classifies ~3,140 county polygons in the browser, so this script
produces one GeoJSON the map loads as the national base, a summary JSON with
national distribution stats, and the public download bundle (flat CSV + data
dictionary + manifest).

One CATALOG below is the single source of truth: it drives the variables we
fetch, the columns we ship, the national summary, and the data dictionary the
public downloads. The frontend VARS object in app/src/data.js mirrors it.

Sources, all verified live (2026-05):
  ACS 2018-22 5-year  — detailed tables (county:* in=state:*) + subject tables
                        S2701 (uninsured) and S1810 (disability)
  CDC PLACES 2025     — county crude prevalence (swc5-untb), long -> wide
  TIGER 2023          — county geometry + land area (tl_2023_us_county)

Writes:
  data/web/us_counties.geojson           full-res source (slim via script 90)
  app/public/data/us_summary.json        national distribution stats
  app/public/data/us_counties.csv        flat download (no geometry)
  app/public/data/data_dictionary.csv    variable / label / unit / source / def
  app/public/data/data_manifest.json     download bundle metadata
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
# Full-resolution county geometry is a build-time SOURCE (consumed by
# 12_national_moran.py and slimmed by 90_optimize_web_geometry.py), not a
# browser payload. It lives in data/web so app/public/data holds only the
# files the SPA actually downloads.
WEB = BASE / "data" / "web"; WEB.mkdir(parents=True, exist_ok=True)
KEY = (dotenv_values("/Users/ian/Projects/econscope/.env").get("CENSUS_API_KEY")
       or os.environ.get("CENSUS_API_KEY"))
assert KEY, "no census key"
YEAR = 2022
DET = f"https://api.census.gov/data/{YEAR}/acs/acs5"
SUBJ = f"https://api.census.gov/data/{YEAR}/acs/acs5/subject"
PLACES_RES = "https://data.cdc.gov/resource/swc5-untb.csv"
TIGER = "https://www2.census.gov/geo/tiger/TIGER2023/COUNTY/tl_2023_us_county.zip"
ACS_VINTAGE = "ACS 2018–22 5-year"
PLACES_VINTAGE = "CDC PLACES 2025 (county, crude prevalence)"

# 50 states + DC; drop territories (PLACES/ACS coverage is partial there)
VALID_STATES = {f"{i:02d}" for i in range(1, 57)} - {"03", "07", "14", "43", "52"}

# ───────────────────────── the catalogue ──────────────────────────
# Every shipped variable, in display order. `group` drives the grouped picker
# and the dictionary; `source` and `definition` are the public provenance.
CATALOG = [
    # — Demographics —
    dict(id="pop_density_km2", label="Population density", unit="people / km²", group="Demographics",
         source=f"{ACS_VINTAGE} + TIGER 2023 land area",
         definition="County population (ACS B01003) divided by TIGER land area in km²."),
    dict(id="median_age", label="Median age", unit="years", group="Demographics",
         source=ACS_VINTAGE, definition="Median age of the population (ACS B01002)."),
    dict(id="pct_hispanic", label="Hispanic / Latino share", unit="%", group="Demographics",
         source=ACS_VINTAGE, definition="Residents identifying as Hispanic or Latino (ACS B03003)."),
    dict(id="pct_black", label="Black share", unit="%", group="Demographics",
         source=ACS_VINTAGE, definition="Residents identifying as Black or African American (ACS B02001)."),
    dict(id="pct_foreign_born", label="Foreign-born share", unit="%", group="Demographics",
         source=ACS_VINTAGE, definition="Residents born outside the United States (ACS B05002)."),
    dict(id="pct_veteran", label="Veteran share (18+)", unit="%", group="Demographics",
         source=ACS_VINTAGE, definition="Civilian veterans among adults 18+ (ACS B21001)."),
    # — Economy —
    dict(id="median_hh_income", label="Median household income", unit="$", group="Economy",
         source=ACS_VINTAGE, definition="Median household income (ACS B19013)."),
    dict(id="income_per_capita", label="Income per capita", unit="$", group="Economy",
         source=ACS_VINTAGE, definition="Per-capita income in the past 12 months (ACS B19301)."),
    dict(id="gini", label="Income inequality (Gini)", unit="index 0–1", group="Economy",
         source=ACS_VINTAGE, definition="Gini index of household income inequality (ACS B19083)."),
    dict(id="pct_poverty", label="Poverty rate", unit="%", group="Economy",
         source=ACS_VINTAGE, definition="People below the federal poverty line (ACS B17001)."),
    dict(id="pct_unemployed", label="Unemployment", unit="%", group="Economy",
         source=ACS_VINTAGE, definition="Unemployed share of the civilian labor force (ACS B23025)."),
    # — Education —
    dict(id="pct_bachelor_plus", label="Bachelor's degree +", unit="%", group="Education",
         source=ACS_VINTAGE, definition="Adults 25+ with a bachelor's degree or higher (ACS B15003)."),
    # — Housing & mobility —
    dict(id="median_home_value", label="Median home value", unit="$", group="Housing & mobility",
         source=ACS_VINTAGE, definition="Median value of owner-occupied homes (ACS B25077)."),
    dict(id="median_gross_rent", label="Median gross rent", unit="$ / month", group="Housing & mobility",
         source=ACS_VINTAGE, definition="Median monthly gross rent (ACS B25064)."),
    dict(id="rent_burden_pct", label="Rent burden", unit="% of income", group="Housing & mobility",
         source=ACS_VINTAGE, definition="Median gross rent as a share of household income (ACS B25071)."),
    dict(id="pct_renter", label="Renter share", unit="%", group="Housing & mobility",
         source=ACS_VINTAGE, definition="Occupied units that are renter-occupied (ACS B25003)."),
    dict(id="pct_no_vehicle", label="No vehicle available", unit="%", group="Housing & mobility",
         source=ACS_VINTAGE, definition="Households with no vehicle available (ACS B08201)."),
    dict(id="pct_broadband", label="Broadband internet", unit="%", group="Housing & mobility",
         source=ACS_VINTAGE, definition="Households with a broadband subscription (ACS B28002)."),
    # — Health access —
    dict(id="pct_uninsured", label="Uninsured", unit="%", group="Health access",
         source=f"{ACS_VINTAGE} subject S2701",
         definition="Population without health insurance (ACS subject table S2701)."),
    dict(id="pct_disability", label="With a disability", unit="%", group="Health access",
         source=f"{ACS_VINTAGE} subject S1810",
         definition="Civilian noninstitutionalized population with a disability (ACS subject S1810)."),
    # — Chronic disease (CDC PLACES) —
    dict(id="diabetes_pct", label="Diabetes", unit="%", group="Chronic disease",
         source=PLACES_VINTAGE, definition="Adults with diagnosed diabetes (PLACES DIABETES)."),
    dict(id="obesity_pct", label="Obesity", unit="%", group="Chronic disease",
         source=PLACES_VINTAGE, definition="Adults with obesity, BMI ≥ 30 (PLACES OBESITY)."),
    dict(id="hypertension_pct", label="High blood pressure", unit="%", group="Chronic disease",
         source=PLACES_VINTAGE, definition="Adults with high blood pressure (PLACES BPHIGH)."),
    dict(id="high_chol_pct", label="High cholesterol", unit="%", group="Chronic disease",
         source=PLACES_VINTAGE, definition="Adults ever told they have high cholesterol (PLACES HIGHCHOL)."),
    dict(id="chd_pct", label="Coronary heart disease", unit="%", group="Chronic disease",
         source=PLACES_VINTAGE, definition="Adults with coronary heart disease (PLACES CHD)."),
    dict(id="stroke_pct", label="Stroke", unit="%", group="Chronic disease",
         source=PLACES_VINTAGE, definition="Adults who have ever had a stroke (PLACES STROKE)."),
    dict(id="copd_pct", label="COPD", unit="%", group="Chronic disease",
         source=PLACES_VINTAGE, definition="Adults with chronic obstructive pulmonary disease (PLACES COPD)."),
    dict(id="asthma_pct", label="Current asthma", unit="%", group="Chronic disease",
         source=PLACES_VINTAGE, definition="Adults with current asthma (PLACES CASTHMA)."),
    # — Behavioral & mental health (CDC PLACES) —
    dict(id="smoking_pct", label="Current smoking", unit="%", group="Behavioral & mental health",
         source=PLACES_VINTAGE, definition="Adults who currently smoke (PLACES CSMOKING)."),
    dict(id="no_exercise_pct", label="No leisure exercise", unit="%", group="Behavioral & mental health",
         source=PLACES_VINTAGE, definition="Adults reporting no leisure-time physical activity (PLACES LPA)."),
    dict(id="depression_pct", label="Depression", unit="%", group="Behavioral & mental health",
         source=PLACES_VINTAGE, definition="Adults with diagnosed depression (PLACES DEPRESSION)."),
    dict(id="mental_distress_pct", label="Frequent mental distress", unit="%", group="Behavioral & mental health",
         source=PLACES_VINTAGE, definition="Adults reporting ≥14 poor mental-health days/month (PLACES MHLTH)."),
    dict(id="phys_distress_pct", label="Frequent physical distress", unit="%", group="Behavioral & mental health",
         source=PLACES_VINTAGE, definition="Adults reporting ≥14 poor physical-health days/month (PLACES PHLTH)."),
]
WEB_VARS = [c["id"] for c in CATALOG]

# ACS detailed raw fields → working names (numerator/denominator pairs for rates)
ACS_VARS = {
    "B01003_001E": "pop_total",
    "B01002_001E": "median_age",
    "B02001_003E": "race_black",
    "B03003_003E": "hispanic", "B03003_001E": "hisp_universe",
    "B19013_001E": "median_hh_income",
    "B19301_001E": "income_per_capita",
    "B19083_001E": "gini",
    "B17001_001E": "pov_universe", "B17001_002E": "pov_below",
    "B15003_001E": "edu_universe", "B15003_022E": "edu_ba", "B15003_023E": "edu_ma",
    "B15003_024E": "edu_prof", "B15003_025E": "edu_phd",
    "B23025_003E": "labor_force", "B23025_005E": "unemployed",
    "B25003_001E": "tenure_total", "B25003_003E": "renter",
    "B25077_001E": "median_home_value",
    "B25064_001E": "median_gross_rent",
    "B25071_001E": "rent_burden_pct",
    "B08201_001E": "veh_universe", "B08201_002E": "veh_none",
    "B28002_001E": "bb_universe", "B28002_004E": "bb_broadband",
    "B05002_001E": "fb_universe", "B05002_013E": "foreign_born",
    "B21001_001E": "vet_universe", "B21001_002E": "veterans",
}
# CDC PLACES measure id → shipped column
PLACES_MEASURES = {
    "DIABETES": "diabetes_pct", "OBESITY": "obesity_pct", "BPHIGH": "hypertension_pct",
    "HIGHCHOL": "high_chol_pct", "CHD": "chd_pct", "STROKE": "stroke_pct",
    "COPD": "copd_pct", "CASTHMA": "asthma_pct",
    "CSMOKING": "smoking_pct", "LPA": "no_exercise_pct", "DEPRESSION": "depression_pct",
    "MHLTH": "mental_distress_pct", "PHLTH": "phys_distress_pct",
}


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
        df.loc[df[c] < -1e6, c] = pd.NA   # ACS missing sentinels (-666666666 etc.)
    return df


# ---------- ACS county (national, single detailed call) ----------
print("ACS county: detailed tables (county:* in=state:*)...")
det = fetch(DET, {"get": ",".join(ACS_VARS), "for": "county:*",
                  "in": "state:*", "key": KEY}).rename(columns=ACS_VARS)
det["GEOID"] = det.state + det.county
det = det[det.state.isin(VALID_STATES)].copy()
det = to_num(det, list(ACS_VARS.values()))
print(f"  {len(det)} counties")

print("ACS county: subject tables S2701 (uninsured) + S1810 (disability)...")
subj = fetch(SUBJ, {"get": "S2701_C05_001E,S1810_C03_001E",
                    "for": "county:*", "in": "state:*", "key": KEY})
subj["GEOID"] = subj.state + subj.county
subj["pct_uninsured"] = pd.to_numeric(subj["S2701_C05_001E"], errors="coerce")
subj["pct_disability"] = pd.to_numeric(subj["S1810_C03_001E"], errors="coerce")
for c in ("pct_uninsured", "pct_disability"):
    subj.loc[subj[c] < -1e6, c] = pd.NA
det = det.merge(subj[["GEOID", "pct_uninsured", "pct_disability"]], on="GEOID", how="left")

pct = lambda num, den: (num / den * 100).where(den > 0)
acs = pd.DataFrame({"GEOID": det.GEOID})
acs["pop_total"] = det.pop_total
acs["median_age"] = det.median_age
acs["median_hh_income"] = det.median_hh_income
acs["income_per_capita"] = det.income_per_capita
acs["gini"] = det.gini
acs["median_home_value"] = det.median_home_value
acs["median_gross_rent"] = det.median_gross_rent
acs["rent_burden_pct"] = det.rent_burden_pct
acs["pct_black"] = pct(det.race_black, det.pop_total)
acs["pct_hispanic"] = pct(det.hispanic, det.hisp_universe)
acs["pct_foreign_born"] = pct(det.foreign_born, det.fb_universe)
acs["pct_veteran"] = pct(det.veterans, det.vet_universe)
acs["pct_poverty"] = pct(det.pov_below, det.pov_universe)
acs["pct_renter"] = pct(det.renter, det.tenure_total)
acs["pct_no_vehicle"] = pct(det.veh_none, det.veh_universe)
acs["pct_broadband"] = pct(det.bb_broadband, det.bb_universe)
acs["pct_bachelor_plus"] = pct(det.edu_ba + det.edu_ma + det.edu_prof + det.edu_phd, det.edu_universe)
acs["pct_unemployed"] = pct(det.unemployed, det.labor_force)
acs["pct_uninsured"] = det.pct_uninsured
acs["pct_disability"] = det.pct_disability

# ---------- PLACES county (long -> wide) ----------
print(f"PLACES county: pulling {len(PLACES_MEASURES)} crude-prevalence measures...")
meas_in = ",".join(f"'{m}'" for m in PLACES_MEASURES)
pl = fetch(PLACES_RES, {
    "$select": "locationid,measureid,data_value",
    "$where": f"datavaluetypeid='CrdPrv' AND measureid in({meas_in})",
    "$limit": 400000,
}, csv=True, dtype={"locationid": str})
pl["data_value"] = pd.to_numeric(pl["data_value"], errors="coerce")
wide = pl.pivot_table(index="locationid", columns="measureid", values="data_value", aggfunc="first")
wide = wide.rename(columns=PLACES_MEASURES).reset_index().rename(columns={"locationid": "GEOID"})
wide["GEOID"] = wide["GEOID"].str.zfill(5)
print(f"  {len(wide)} counties with PLACES; measures: {sorted(set(PLACES_MEASURES.values()) & set(wide.columns))}")

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

# state name for labels
STATE_ABBR = fetch(DET, {"get": "NAME", "for": "state:*", "key": KEY})
abbr_map = dict(zip(STATE_ABBR.state, STATE_ABBR.NAME))
df["county_name"] = df.NAMELSAD
df["state_name"] = df.STATEFP.map(abbr_map)

keep = ["GEOID", "county_name", "state_name", "pop_total"] + WEB_VARS
for c in WEB_VARS:
    if c in df:
        df[c] = pd.to_numeric(df[c], errors="coerce").round(3 if c == "gini" else 2)
    else:
        print(f"  WARNING: {c} missing from merged frame")
        df[c] = pd.NA
df = df[keep + ["geometry"]]

# ---------- geometry source (slimmed for web by script 90) ----------
df["geometry"] = df.geometry.simplify(0.01, preserve_topology=True)
out = gpd.GeoDataFrame(df, geometry="geometry", crs=4326)
out.to_file(WEB / "us_counties.geojson", driver="GeoJSON")
sz = (WEB / "us_counties.geojson").stat().st_size / 1e6
print(f"wrote data/web/us_counties.geojson — {len(out)} counties, {len(WEB_VARS)} vars, {sz:.1f} MB"
      f"  (slim with scripts/90_optimize_web_geometry.py)")

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
           "n_states": int(out.state_name.nunique()),
           "n_vars": len(WEB_VARS), "varstats": varstats}
json.dump(summary, open(APP / "us_summary.json", "w"))
print("wrote us_summary.json")

# ---------- public download bundle ----------
flat = out.drop(columns="geometry")
flat.to_csv(APP / "us_counties.csv", index=False)
dd = pd.DataFrame([{"variable": c["id"], "label": c["label"], "unit": c["unit"],
                    "group": c["group"], "source": c["source"], "definition": c["definition"],
                    "n_counties": varstats.get(c["id"], {}).get("n", 0)} for c in CATALOG])
dd.to_csv(APP / "data_dictionary.csv", index=False)
manifest = {
    "title": "American Policy Atlas — county dataset",
    "vintage": {"acs": ACS_VINTAGE, "places": PLACES_VINTAGE, "geometry": "TIGER 2023"},
    "n_counties": int(len(out)), "n_variables": len(WEB_VARS),
    "geography": "US counties (50 states + DC)",
    "files": [
        {"name": "us_counties.csv", "format": "CSV", "desc": "Flat table, one row per county, all variables (no geometry).",
         "bytes": (APP / "us_counties.csv").stat().st_size},
        {"name": "us_counties.min.geojson", "format": "GeoJSON", "desc": "County polygons + all variables (topology-simplified).",
         "bytes": (APP / "us_counties.min.geojson").stat().st_size if (APP / "us_counties.min.geojson").exists() else None},
        {"name": "data_dictionary.csv", "format": "CSV", "desc": "Variable, label, unit, group, source, definition.",
         "bytes": (APP / "data_dictionary.csv").stat().st_size},
    ],
    "license": "Source data are public domain (US Census Bureau, CDC). Compiled by Ian Helfrich.",
}
json.dump(manifest, open(APP / "data_manifest.json", "w"), indent=1)
print(f"wrote download bundle: us_counties.csv ({flat.shape}), data_dictionary.csv, data_manifest.json")
print(out[["GEOID", "county_name", "state_name", "median_age", "income_per_capita",
           "gini", "depression_pct", "stroke_pct"]].head())
