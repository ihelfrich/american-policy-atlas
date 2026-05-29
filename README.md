# The American Policy Atlas

A teaching observatory for statistics, built on every county in the United States.

The atlas teaches a full statistics sequence on live national data — distributions,
conditional expectations, regression, statistical inference, spatial dependence, and
empirical-Bayes estimation — with each method computed in the browser from the same
3,144-county dataset. The 1939 redlining story (Los Angeles, census-tract resolution)
is the flagship case study inside the national atlas.

See [DESIGN.md](DESIGN.md) for the full information design.

## National data pipeline (`scripts/`)

| Script | Pulls | Output |
|---|---|---|
| `11_national_county.py` | ACS 2018–22 + CDC PLACES, all 3,144 counties (12 variables) | `app/public/data/us_counties.geojson`, `us_summary.json` |
| `12_national_moran.py` | Queen-contiguity Moran's I on raw TIGER geometry, 999-permutation test | merges `moran` block into `us_summary.json` |

Spatial contiguity is built from the full-resolution TIGER county shapefile (the
web GeoJSON is simplified for transfer), using an `intersects` test — a healthy
queen graph of ~5.9 neighbors per county, 0 islands, Moran's I ≈ 0.60 (p < 0.001)
for adult diabetes prevalence.

## California flagship pipeline (`scripts/`)

The redlining case study retains its own tract-level pipeline.

| Script | Pulls | Output |
|---|---|---|
| `10_pull_acs.py` | ACS 2018–22, tract + block group, all CA | `acs_ca_tract.parquet` (9,129) |
| `20_pull_places.py` | CDC PLACES tract prevalence | `places_ca_tract.parquet` (9,070) |
| `30_pull_bls_bea.py` | BEA income/GDP, BLS LAUS + QCEW | `econ_ca_county.parquet` (58) |
| `40_worldpop_zonal.py` | WorldPop 100 m → CA clip → zonal density | `worldpop_ca_*.parquet` |
| `50_assemble.py` | merge + HOLC area-weighting + South Central | web GeoJSON |
| `60_web_payload.py` | Moran's I, summary stats | `app/public/data/*` |

Raw downloads (rasters, shapefiles) are git-ignored and reproducible.

## Data sources

- **U.S. Census ACS 2018–2022** five-year estimates (income, poverty, education,
  race and ethnicity, unemployment, housing tenure, health insurance via S2701).
- **CDC PLACES** model-based adult prevalence (diabetes, obesity, hypertension).
- **BLS** LAUS unemployment + QCEW employment/wages; **BEA** per-capita income + real GDP.
- **WorldPop 2020** constrained 100 m population raster (California flagship only).
- **Mapping Inequality** (University of Richmond) HOLC 1939 grades.
- **TIGER/Line 2023** county, tract, and block-group geometry.

## Frontend (`app/`)

Vite + Tailwind CSS v4 + MapLibre GL JS + Observable Plot + Motion + scrollama + KaTeX.

```bash
cd app
npm install
npm run dev                 # local dev (base path "/")
npm run build               # static output in app/dist
```

Deploys to GitHub Pages via `.github/workflows/deploy.yml` (base `/american-policy-atlas/`).

## Research assistant (`worker/`)

An optional grounded-RAG question panel runs on Cloudflare Workers AI (free tier, no
API key shipped to the browser). The static site degrades to client-side retrieval
when no Worker endpoint is configured. See [`worker/README.md`](worker/README.md).
