"""
Phase A2 (part 2) — county economic context for all 58 California counties.

BEA  (key): CAINC1 per-capita personal income; CAGDP1 real GDP by county.
BLS  (key): LAUS county unemployment rate (annual avg, latest full year).
BLS QCEW (keyless open CSV): annual avg employment + average weekly wage,
         all-industry total covered.

Outputs (../data/clean/):
  econ_ca_county.parquet   58 rows, one per county, merged context block
"""
from pathlib import Path
import os, time
from io import StringIO
import requests
import pandas as pd
from dotenv import dotenv_values

BASE = Path(__file__).resolve().parents[1]
CLEAN = BASE / "data" / "clean"; CLEAN.mkdir(parents=True, exist_ok=True)
ENV = dotenv_values("/Users/ian/Projects/econscope/.env")
BEA_KEY = ENV.get("BEA_API_KEY") or os.environ.get("BEA_API_KEY")
BLS_KEY = ENV.get("BLS_API_KEY") or os.environ.get("BLS_API_KEY")
assert BEA_KEY and BLS_KEY, "need BEA + BLS keys"

CA_FIPS = [f"{i:03d}" for i in range(1, 116, 2)]   # 58 odd codes 001..115
GEO_CTY = [f"06{c}" for c in CA_FIPS]
LAUS_YEAR = "2024"
QCEW_YEAR = "2023"   # latest full QCEW annual at build time
BEA_YEAR = "2023"


def get(url, params, timeout=120):
    last = None
    for a in range(6):
        try:
            r = requests.get(url, params=params, timeout=timeout)
            if r.status_code == 200:
                return r
            last = f"{r.status_code}: {r.text[:150]}"
        except requests.exceptions.RequestException as e:
            last = repr(e)
        time.sleep(2 * (a + 1))
    raise RuntimeError(f"GET failed: {last}")


# ---------- BEA ----------
def bea_table(table, linecode):
    p = {"UserID": BEA_KEY, "method": "GetData", "datasetname": "Regional",
         "TableName": table, "LineCode": linecode, "GeoFips": "COUNTY",
         "Year": BEA_YEAR, "ResultFormat": "JSON"}
    j = get("https://apps.bea.gov/api/data", p).json()
    rows = j["BEAAPI"]["Results"]["Data"]
    d = pd.DataFrame(rows)
    d = d[d.GeoFips.str.startswith("06") & (d.GeoFips != "06000")].copy()
    d["val"] = pd.to_numeric(d["DataValue"].str.replace(",", ""), errors="coerce")
    return d[["GeoFips", "val"]].rename(columns={"GeoFips": "GEOID_county"})


print("BEA CAINC1 per-capita personal income...")
pci = bea_table("CAINC1", 3).rename(columns={"val": "per_capita_income"})
print("BEA CAGDP1 real GDP (chained $thousands)...")
gdp = bea_table("CAGDP1", 1).rename(columns={"val": "real_gdp_k"})

# ---------- BLS LAUS unemployment ----------
print("BLS LAUS county unemployment rate...")
series = [f"LAUCN06{c}0000000003" for c in CA_FIPS]
laus_rows = []
for i in range(0, len(series), 50):
    chunk = series[i:i + 50]
    body = {"seriesid": chunk, "startyear": LAUS_YEAR, "endyear": LAUS_YEAR,
            "annualaverage": True, "registrationkey": BLS_KEY}
    j = get("https://api.bls.gov/publicAPI/v2/timeseries/data/",
            {}, timeout=120) if False else requests.post(
        "https://api.bls.gov/publicAPI/v2/timeseries/data/", json=body, timeout=120).json()
    for s in j["Results"]["series"]:
        fips = s["seriesID"][5:10]            # 06xxx
        ann = [d for d in s["data"] if d["period"] == "M13"]
        val = float(ann[0]["value"]) if ann else (
            float(s["data"][0]["value"]) if s["data"] else None)
        laus_rows.append({"GEOID_county": fips, "unemployment_rate": val})
laus = pd.DataFrame(laus_rows)

# ---------- BLS QCEW annual (keyless CSV) ----------
print("BLS QCEW annual employment + avg weekly wage...")
qcew_rows = []
for c in GEO_CTY:
    url = f"https://data.bls.gov/cew/data/api/{QCEW_YEAR}/a/area/{c}.csv"
    try:
        r = get(url, {}, timeout=120)
        d = pd.read_csv(StringIO(r.text), dtype=str)
        tot = d[(d.industry_code == "10") & (d.own_code == "0") &
                (d.agglvl_code == "70")]
        if len(tot):
            row = tot.iloc[0]
            qcew_rows.append({"GEOID_county": c,
                              "avg_employment": pd.to_numeric(row["annual_avg_emplvl"], errors="coerce"),
                              "avg_weekly_wage": pd.to_numeric(row["annual_avg_wkly_wage"], errors="coerce")})
    except Exception as e:
        print(f"  QCEW {c} skipped: {e}")
qcew = pd.DataFrame(qcew_rows)

# ---------- merge ----------
out = pci.merge(gdp, on="GEOID_county", how="outer")
for extra in (laus, qcew):
    out = out.merge(extra, on="GEOID_county", how="outer")
out = out.sort_values("GEOID_county").reset_index(drop=True)
out.to_parquet(CLEAN / "econ_ca_county.parquet", index=False)
print(f"\ncounty econ: {len(out)} rows, {out.shape[1]} cols -> econ_ca_county.parquet")
print(out.head(8))
