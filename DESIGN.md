# The California Policy Atlas
### Learning geospatial statistics with real data — from the state down to your block

A teaching observatory that grows the LA redlining practicum into a California-wide
platform for geospatial statistics, regression, conditional expectations, Bayesian
reasoning, and policy-impact analysis. The redlining story becomes the flagship case
study inside a much larger, modern, animated atlas.

---

## 0. Three honest reality checks (so the design is real, not aspirational)

1. **CPS is not a mappable layer.** The Current Population Survey has no tract or
   block-group geography; its smallest stable unit is state / large metro. We use CPS
   for *California state-level* labor-force time series (a teaching sidebar on sampling
   and survey design), not as a choropleth. Tract/block-group economic detail comes from
   **ACS**; county detail from **BLS (QCEW/LAUS)** and **BEA**.
2. **Disk is the constraint, not the APIs.** ~13 GB free rules out CONUS WorldPop. We
   download the **California clip only**, compute zonal stats, and delete the raster.
3. **This is a phased build, not one shot.** The data foundation and the new frontend
   skeleton come first; the seven teaching modules fill in after. Each phase ships
   something that works.

---

## 1. Geographies

| Geography | Count (CA) | Source | Use |
|---|---|---|---|
| Counties | 58 | TIGER 2023 | BLS/BEA economic context, overview map |
| Census tracts | ~9,100 | TIGER 2023 (have it) | primary analysis unit |
| Block groups | ~25,600 | TIGER 2023 | fine-grain density + ACS subset |
| LA County subset | ~2,500 tracts | derived | focus dataset |
| **South Central LA** | ~250 tracts | City of LA "South LA" + "Southeast LA" Community Plan Areas, realized as an explicit tract list | flagship focus |

"South Central LA" is defined explicitly (documented tract list from the City of LA
South LA + Southeast LA community plan areas, plus the historic core), not hand-waved.

---

## 2. Data layers (the "clean data")

**Tract + block group (where available):**
- **ACS 2018–2022** (Census API): total population, race/ethnicity shares, median HH
  income, poverty rate, educational attainment, unemployment, housing tenure / median
  value / median rent / rent burden, health-insurance coverage, commute mode + time,
  internet access, age structure, foreign-born share.
- **CDC PLACES 2025** (tract): diabetes, obesity, hypertension, poor mental health,
  physical inactivity, smoking, uninsured, routine checkup.
- **WorldPop 2020 constrained 100 m** → zonal stats → **population count + density**
  per tract and block group (the raster-clip-to-polygon GIS deliverable).

**County:**
- **BLS**: QCEW employment & average weekly wage; LAUS unemployment rate.
- **BEA**: CAINC1 per-capita personal income; CAGDP county GDP.

**Historic:**
- **HOLC 1939** redlining — extended beyond LA to every graded California city in
  Mapping Inequality (LA, SF, Oakland, San Diego, Sacramento, Fresno, San Jose,
  Stockton), area-weighted onto modern tracts.

**Two packaged datasets:**
1. `california_master` — all tracts / block groups / counties, all variables (Parquet + GeoJSON/PMTiles).
2. `la_focus` — LA County + South Central LA, with HOLC grades and the deeper health/redlining variables.

---

## 3. GIS methods taught (each is a module beat, not just a backend step)

- Spatial join, area-weighted (HOLC → tracts) — already built.
- **Raster clipping** WorldPop → California, then to county/tract polygons.
- **Zonal statistics** (population sum, density mean) per polygon.
- Dasymetric / population-weighted interpolation (concept + demo).
- Choropleth **classification** (quantile vs equal-interval vs Jenks) and how the break
  choice changes the story.
- **Spatial autocorrelation** (Moran's I): "nearby places resemble each other."
- 3D **extrusion** of population density (MapLibre fill-extrusion).

---

## 4. Technology — objectively modern, static-deployable

| Layer | Choice | Why |
|---|---|---|
| Build | **Vite** | fast, simple, GitHub-Pages friendly |
| CSS | **Tailwind CSS v4** | modern utility styling, design tokens |
| Maps | **MapLibre GL JS** (WebGL) | vector tiles, data-driven choropleths, 3D extrusions, smooth flyTo |
| Tiles | **PMTiles** | serve all-CA block-group geometry as a single static file, no tile server |
| Stats viz | **Observable Plot** + **D3** | binscatter/CEF, regression, distributions, custom Bayesian animation |
| In-browser analytics | **DuckDB-WASM** + Arrow | run real SQL / regressions on the full CA dataset, no backend |
| Animation | **Motion** (motion.dev) + **scrollama** | enter/scroll animation + scrollytelling map steps |
| Math | **KaTeX** | fast equation rendering |

The combination — Vite + Tailwind v4 + MapLibre + PMTiles + Plot + DuckDB-WASM + Motion +
scrollama + KaTeX — is the current state of the art for a static, data-rich, animated
teaching site, and every piece deploys to GitHub Pages with no server.

---

## 5. Site architecture (information design)

1. **Atlas home** — full-screen MapLibre map of California; choose any variable → live
   choropleth; animated hero; flyTo LA.
2. **M1 · Reading a map** — choropleths & classification; interactive break switcher.
3. **M2 · Population from space** — rasters, clipping, zonal stats; WorldPop → density;
   3D extrusion.
4. **M3 · Conditional expectations** — E[Y|X] as a binscatter; animated binning; the CEF
   as nonparametric regression.
5. **M4 · Regression** — simple & multiple OLS; redlining→health state-wide as the
   running example; add/remove controls live; **residual map** motivates spatial models.
6. **M5 · Spatial dependence** — Moran's I, spatial-lag intuition.
7. **M6 · Bayesian thinking** — prior → data → posterior for small-area rates; shrinkage;
   ties to why PLACES is model-based; animated posterior.
8. **M7 · Policy impact & forecasting** — difference-in-differences intuition, a simple
   projection, "what closing the gap would mean."
9. **Data Explorer** — DuckDB-WASM: pick variables / run SQL on the full CA dataset; download.
10. **Redlining flagship** — the original LA story, upgraded and extended to multiple CA cities.
11. **Practice** — per-module questions, numbers computed live.
12. **Methods & sources** — full reproducible documentation.

---

## 6. Build phases

- **A — Data pipeline:** all-CA ACS (tract + block group), PLACES, BLS, BEA, HOLC
  multi-city, WorldPop clip + zonal. Output Parquet/CSV + GeoJSON/PMTiles. Build LA +
  South Central subsets.
- **B — Frontend scaffold:** Vite + Tailwind v4 + MapLibre + Plot + Motion + KaTeX +
  DuckDB-WASM; Pages deploy pipeline.
- **C — Atlas map + classification** (M1–M2) on PMTiles.
- **D — Stats modules** (M3–M7): CEF, regression, spatial, Bayesian, policy.
- **E — Data Explorer, redlining flagship, quiz, methods.**
- **F — Polish, verify in browser, deploy, bundle for the student.**

---

*Prepared with AI assistance (Anthropic Claude) for tutoring purposes. Worked solutions and data verified by Ian Helfrich, PhD.*
