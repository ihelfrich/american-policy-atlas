"""
Phase A2 (part 1) — CDC PLACES 2025 tract-level prevalence for ALL California.

Source: data.cdc.gov resource yjkw-uj5s
  "PLACES: Census Tract Data (GIS Friendly Format), 2025 release"
  (verified via Socrata catalog; same release the LA practicum used).

Output (../data/clean/):
  places_ca_tract.parquet  ~9,100 rows, crude adult prevalence (%) per measure
"""
from pathlib import Path
import time
import requests
import pandas as pd

BASE = Path(__file__).resolve().parents[1]
CLEAN = BASE / "data" / "clean"; CLEAN.mkdir(parents=True, exist_ok=True)
RES = "https://data.cdc.gov/resource/yjkw-uj5s.csv"

# crude-prevalence column -> friendly name (matches redlining practicum)
MEASURES = {
    "diabetes_crudeprev": "diabetes_pct", "bphigh_crudeprev": "hypertension_pct",
    "chd_crudeprev": "coronary_heart_disease_pct", "obesity_crudeprev": "obesity_pct",
    "mhlth_crudeprev": "poor_mental_health_pct", "phlth_crudeprev": "poor_physical_health_pct",
    "lpa_crudeprev": "no_physical_activity_pct", "csmoking_crudeprev": "smoking_pct",
    "casthma_crudeprev": "asthma_pct", "checkup_crudeprev": "routine_checkup_pct",
    "depression_crudeprev": "depression_pct", "stroke_crudeprev": "stroke_pct",
    "sleep_crudeprev": "short_sleep_pct", "access2_crudeprev": "no_health_insurance_pct",
    "copd_crudeprev": "copd_pct", "arthritis_crudeprev": "arthritis_pct",
    "cancer_crudeprev": "cancer_pct", "highchol_crudeprev": "high_cholesterol_pct",
}


def fetch(url, params):
    last = None
    for attempt in range(6):
        try:
            r = requests.get(url, params=params, timeout=180)
            if r.status_code == 200:
                from io import StringIO
                return pd.read_csv(StringIO(r.text), dtype={"tractfips": str})
            last = f"{r.status_code}: {r.text[:200]}"
        except requests.exceptions.RequestException as e:
            last = repr(e)
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"fetch failed after retries: {last}")


print("PLACES 2025: pulling California tracts...")
cols = ["tractfips", "totalpopulation"] + list(MEASURES)
df = fetch(RES, {"stateabbr": "CA", "$select": ",".join(cols), "$limit": 20000})
print(f"  raw rows: {len(df)}")

df = df.rename(columns={"tractfips": "GEOID", **MEASURES})
keep = ["GEOID"] + [v for v in MEASURES.values() if v in df.columns]
out = df[keep].copy()
out["GEOID"] = out["GEOID"].str.zfill(11)
for c in keep[1:]:
    out[c] = pd.to_numeric(out[c], errors="coerce")

out.to_parquet(CLEAN / "places_ca_tract.parquet", index=False)
print(f"  PLACES: {len(out)} rows, {out.shape[1]} cols -> places_ca_tract.parquet")
print(out[["GEOID", "diabetes_pct", "obesity_pct", "hypertension_pct"]].head())
