"""
Phase A1 — pull ACS 2018-2022 (5-year) for ALL California.

Tracts: detailed B-tables (county wildcard) + subject table S2701 (uninsured).
Block groups: core B-table subset, looped over all 58 counties.

Outputs (../data/clean/):
  acs_ca_tract.parquet     ~9,100 rows, derived percentages
  acs_ca_blockgroup.parquet ~25,600 rows, core subset
"""
from pathlib import Path
import os, time, io
import requests
import pandas as pd
from dotenv import dotenv_values

BASE = Path(__file__).resolve().parents[1]
CLEAN = BASE / "data" / "clean"; CLEAN.mkdir(parents=True, exist_ok=True)
KEY = (dotenv_values("/Users/ian/Projects/econscope/.env").get("CENSUS_API_KEY")
       or os.environ.get("CENSUS_API_KEY"))
assert KEY, "no census key"
YEAR = 2022
DET = f"https://api.census.gov/data/{YEAR}/acs/acs5"
SUBJ = f"https://api.census.gov/data/{YEAR}/acs/acs5/subject"
ST = "06"

# raw detailed vars -> friendly name
TRACT_VARS = {
    "B01003_001E": "pop_total", "B01002_001E": "median_age",
    "B02001_002E": "race_white", "B02001_003E": "race_black", "B02001_005E": "race_asian",
    "B03003_003E": "hispanic", "B03003_001E": "hisp_universe",
    "B19013_001E": "median_hh_income",
    "B17001_001E": "pov_universe", "B17001_002E": "pov_below",
    "B15003_001E": "edu_universe", "B15003_022E": "edu_ba", "B15003_023E": "edu_ma",
    "B15003_024E": "edu_prof", "B15003_025E": "edu_phd",
    "B23025_003E": "labor_force", "B23025_005E": "unemployed",
    "B25003_001E": "tenure_total", "B25003_002E": "owner", "B25003_003E": "renter",
    "B25077_001E": "median_home_value", "B25064_001E": "median_gross_rent",
    "B25070_001E": "rentpct_universe", "B25070_007E": "rb_30", "B25070_008E": "rb_35",
    "B25070_009E": "rb_40", "B25070_010E": "rb_50",
    "B28002_001E": "net_universe", "B28002_013E": "no_internet",
    "B05002_001E": "nativity_universe", "B05002_013E": "foreign_born",
    "B08013_001E": "agg_travel", "B08301_001E": "commuters", "B08301_010E": "transit",
}
BG_VARS = {
    "B01003_001E": "pop_total",
    "B02001_002E": "race_white", "B02001_003E": "race_black", "B02001_005E": "race_asian",
    "B03003_003E": "hispanic", "B03003_001E": "hisp_universe",
    "B19013_001E": "median_hh_income",
    "B17001_001E": "pov_universe", "B17001_002E": "pov_below",
    "B25003_001E": "tenure_total", "B25003_002E": "owner", "B25003_003E": "renter",
    "B25064_001E": "median_gross_rent", "B25077_001E": "median_home_value",
}


def fetch(url, params):
    last = None
    for attempt in range(6):
        try:
            r = requests.get(url, params=params, timeout=180)
            if r.status_code == 200:
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
        df.loc[df[c] < -1e6, c] = pd.NA  # census null sentinels
    return df


# ---------- tracts: detailed (county wildcard) ----------
print("ACS tracts: detailed table...")
cols = list(TRACT_VARS)
det = fetch(DET, {"get": ",".join(cols), "for": "tract:*",
                  "in": f"state:{ST} county:*", "key": KEY}).rename(columns=TRACT_VARS)
det["GEOID"] = det.state + det.county + det.tract
det = to_num(det, list(TRACT_VARS.values()))

print("ACS tracts: subject S2701 (uninsured)...")
subj = fetch(SUBJ, {"get": "S2701_C05_001E", "for": "tract:*",
                    "in": f"state:{ST} county:*", "key": KEY})
subj["GEOID"] = subj.state + subj.county + subj.tract
subj["pct_uninsured"] = pd.to_numeric(subj["S2701_C05_001E"], errors="coerce")
subj.loc[subj.pct_uninsured < -1e6, "pct_uninsured"] = pd.NA
det = det.merge(subj[["GEOID", "pct_uninsured"]], on="GEOID", how="left")


def derive(d):
    out = pd.DataFrame({"GEOID": d.GEOID})
    out["pop_total"] = d.pop_total
    out["median_age"] = d.get("median_age")
    out["median_hh_income"] = d.median_hh_income
    out["median_home_value"] = d.median_home_value
    out["median_gross_rent"] = d.median_gross_rent
    pct = lambda num, den: (num / den * 100).where(den > 0)
    out["pct_white"] = pct(d.race_white, d.pop_total)
    out["pct_black"] = pct(d.race_black, d.pop_total)
    out["pct_asian"] = pct(d.race_asian, d.pop_total)
    out["pct_hispanic"] = pct(d.hispanic, d.hisp_universe)
    out["pct_poverty"] = pct(d.pov_below, d.pov_universe)
    out["pct_renter"] = pct(d.renter, d.tenure_total)
    if "edu_ba" in d:
        out["pct_bachelor_plus"] = pct(d.edu_ba + d.edu_ma + d.edu_prof + d.edu_phd, d.edu_universe)
        out["pct_unemployed"] = pct(d.unemployed, d.labor_force)
        out["pct_rent_burden30"] = pct(d.rb_30 + d.rb_35 + d.rb_40 + d.rb_50, d.rentpct_universe)
        out["pct_no_internet"] = pct(d.no_internet, d.net_universe)
        out["pct_foreign_born"] = pct(d.foreign_born, d.nativity_universe)
        out["pct_transit_commute"] = pct(d.transit, d.commuters)
        out["mean_commute_min"] = (d.agg_travel / d.commuters).where(d.commuters > 0)
        out["pct_uninsured"] = d.pct_uninsured
    return out


tract = derive(det).round(2)
tract.to_parquet(CLEAN / "acs_ca_tract.parquet", index=False)
print(f"  tracts: {len(tract)} rows, {tract.shape[1]} cols -> acs_ca_tract.parquet")

# ---------- block groups: loop counties ----------
print("ACS block groups: enumerate counties...")
cty = fetch(DET, {"get": "NAME", "for": "county:*", "in": f"state:{ST}", "key": KEY})
fips = sorted(cty["county"].tolist())
print(f"  {len(fips)} counties")
frames = []
for i, c in enumerate(fips, 1):
    d = fetch(DET, {"get": ",".join(BG_VARS), "for": "block group:*",
                    "in": f"state:{ST} county:{c} tract:*", "key": KEY}).rename(columns=BG_VARS)
    d["GEOID"] = d.state + d.county + d.tract + d["block group"]
    d = to_num(d, list(BG_VARS.values()))
    frames.append(derive(d))
    if i % 10 == 0:
        print(f"    {i}/{len(fips)} counties, running rows={sum(len(f) for f in frames)}")
bg = pd.concat(frames, ignore_index=True).round(2)
bg.to_parquet(CLEAN / "acs_ca_blockgroup.parquet", index=False)
print(f"  block groups: {len(bg)} rows -> acs_ca_blockgroup.parquet")
print("\nDONE. tract sample:")
print(tract[["GEOID", "pop_total", "median_hh_income", "pct_poverty", "pct_hispanic", "pct_uninsured"]].head())
