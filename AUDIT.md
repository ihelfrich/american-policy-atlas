# Atlas audit and revision, October 5, 2026

This revision makes the existing prototype a question-led learning tool. It does not establish external validation, refresh source data, or complete the entire lesson library.

## Findings and corrections

| Finding | Cause and consequence | Correction and preventive check |
|---|---|---|
| Unsupported avoided-case totals | Adult modeled prevalence was multiplied by total population, then a descriptive gap was presented as an intervention effect. | Removed case counts. The slider now closes explicitly hypothetical gaps between equal-count poverty groups; tests cover both endpoints and absence of case totals. |
| Misleading empirical Bayes demonstration | County population was treated as survey sample size for already modeled PLACES estimates. | Replaced with a hypothetical normal-model demonstration with explicit uncertainty; tested analytical weights and invalid inputs. |
| Hidden health coverage gaps | Missing joined records disappeared from summaries without a prominent explanation. | Show available/total counts and excluded pairs. Tests assert 2,956 health observations of 3,144 geographies and the 188 missing records: Kentucky 120, Pennsylvania 67, Texas 1. The subsequent Evidence Lab research resolved these omissions as described below. |
| Overstated causal interpretation | Adjusted associations and a descriptive policy slider implied mediation or effects. | Reworded lessons, methods, and assistant corpus; clarify ecological inference, modeled outcomes, source periods, and equal county weights. |
| Inconsistent statistical presentation | Raw-scale fits appeared on a log axis; even-sized medians used one middle observation; Monte Carlo p-values were overstated. | Match fit and axes, use the mean of two central values, and report the stored Moran p-value as 0.001. Tests cover known fits, missingness, and degenerate scopes. |
| Product claims exceeded implementation | The landing page presented an extensive completed curriculum and blanket author verification. | Present a working prototype with three usable investigations; retain unfinished chapters as reading notes. Remove the unsupported verification claim. |
| Map projection failure during revision | GeoJSON ring winding differed from the D3 spherical convention. | Reverse copied polygon rings for display, leaving source data intact; visually checked the national map. |

## Experience added

Three starting questions cover prosperity and health, income and housing burden, and poverty and broadband. Each has a linked county map, scatterplot, state and variable selectors, two-place comparison, source notes, alternative-explanation prompts, locally saved notes, complete-case CSV export, and shareable view URLs. The landing page, navigation, mobile layout, focus treatment, and reduced-motion behavior were revised.

## Verification

- Seven automated tests pass, including all 33 stored variable means and nonmissing counts, unique geography IDs, analytical calculations, and CSV quoting.
- Production build succeeds with the GitHub Pages repository base path. Deployment runs tests before building.
- Browser checks passed for national and state scopes, an entirely missing health state, question changes, county search and comparisons, copyable URLs and reload persistence, both corrected sliders, locally persisted notes, and mobile width at 390px without horizontal overflow.
- No browser console errors observed during these checks. These are focused checks, not exhaustive accessibility or cross-browser certification.
- CSV generation is unit tested. The in-app browser did not return a completed download event, so end-to-end file download remains unverified there.

## Remaining limits and next work

The base data remains the existing ACS 2018–2022 / PLACES 2025-release snapshot, now supplemented with diabetes uncertainty and age-adjusted values. Source survey periods, adult denominators, geographic vintages, and model predictors need careful alignment before any substantive research claim. ACS margins of error and propagated coefficient uncertainty remain absent. The upstream extraction and geospatial modeling pipeline was not rerun. Advanced lessons remain uneven, and the existing assistant and WebGL atlas retain their prior architecture. This revision is appropriate for demonstrating exploratory teaching, not causal policy evaluation.

## Evidence Lab continuation

Dr. Helfrich requested more innovation in functionality, design, and research depth. The new `#/lab` workspace asks for a prediction before revealing eight descriptive specifications, then links the selected model to a residual map and county detail. The visual hierarchy distinguishes analytical choices, model results, measurement uncertainty, and the next research design. Three studies cover income/diabetes, income/rent share, and poverty/broadband.

### Methods

Each outcome uses a common complete sample across pooled, state-fixed-effect, median-age/log-density-adjusted, and combined specifications, each under equal-county and ACS total-population weights. Weighted within-state demeaning and an orthogonal projection implement Frisch–Waugh–Lovell residualization. Coefficients are shown in outcome percentage points per $10,000 of median income or 10 percentage points of poverty. Population weights change descriptive emphasis; they are not precision weights or person-level outcomes. The covariate set is illustrative, not a validated identification strategy. The choice set is inspired by specification-curve presentation, without implementing its inferential procedure.

The residual map displays observed minus fitted outcomes and recalculates symmetric color thresholds for each fit. Selected extreme residuals are prompts for inquiry, not anomalous-policy or performance claims. Fitted values are linear and unconstrained. No coefficient intervals are shown; spatial dependence, generated health estimates, and survey error have not been propagated through these fits.

### New source evidence

`scripts/12_diabetes_evidence.mjs` imports BRFSS 2023 diabetes estimates from CDC's 2025 county release, including crude and age-adjusted prevalence and their model-based 95% intervals. All 2,956 existing nonmissing crude values match exactly. The importer rejects duplicate estimate records, malformed intervals, unexpected coverage, and baseline mismatches. Published source counts and comparison denominators are kept distinct.

[CDC release notes](https://www.cdc.gov/places/current-release-notes/index.html) explain absent Kentucky and Pennsylvania estimates for the relevant 2023 measures. CDC's dataset reports Loving County's adult population as 30; its [FAQ](https://www.cdc.gov/places/faqs/index.html) specifies a reporting minimum of 50 adults. The UI and assistant corpus now explain these omissions. The supplement does not refresh or replace the broader Atlas snapshot.

### Verification and defects addressed

- Fourteen tests cover analytical known-answer regressions, a pooled/within-state sign reversal, weighted versus replicated observations, missing controls, collinearity, source intervals, and every shipped model variant against an independently generated R fixture.
- A separate base-R `lm` run checks all 32 variants. Maximum slope difference is below 5e-14; maximum checked residual difference is below 3e-11. Reproduce with `node scripts/validate_research.mjs`; test fixtures require no R in CI.
- The initial importer rejected Loving County's null records. It now preserves unavailable estimates explicitly; a regression test checks the null estimate and adult count of 30.
- A tiny positive housing coefficient initially triggered a direction-reversal headline. Interpretation now uses a disclosed ±0.05 pp descriptive threshold and reports near-zero fits without treating them as a significance result.
- Browser checks passed for prediction/reveal, all study switches, model switches, crude/age-adjusted outcome changes, unavailable Loving County data, source intervals, shared-view persistence, local notes, CSV preview/copy, and 390px mobile width without horizontal overflow. No console errors observed in those checks.
- Browser download completion remains unverified in the in-app browser. Export dialogs now expose the complete CSV/JSON as reviewable, copyable text and a download link, so access does not depend on download handling.
- Production build passes with the repository base path. These checks verify implemented calculations and interactions, not causal identification or external research validity.

The revision is local pending Dr. Helfrich's review and publication approval. No Bruce Cahan email was sent.
